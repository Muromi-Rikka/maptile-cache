import { Hono } from "hono";
import { cors } from "hono/cors";
import { cacheTileWithType, getCachedTile, getMemoryCacheStats } from "./cache";
import { mapConfig } from "./config";
import logger from "./logger";
import { metrics } from "./metrics";
import { rateLimit } from "./middleware/rate-limit";
import { Singleflight } from "./singleflight";

/**
 * Standard error response interface
 */
interface ErrorResponse {
  error: string;
  code: number;
}

/**
 * Create a standardized error response
 * @param {Context} c - Hono context
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Response} JSON error response
 */
function errorResponse(c: any, message: string, status: number) {
  return c.json({ error: message, code: status } satisfies ErrorResponse, status);
}

/**
 * Hono application instance for map tile caching service
 * @remarks
 * Provides RESTful API endpoints for serving cached map tiles
 * with automatic S3 caching functionality and multi-map source support
 */
const app = new Hono();

// CORS middleware
app.use("*", cors());

// Rate limiting middleware (50 requests per second per IP)
app.use("*", rateLimit({
  windowMs: Number(Bun.env.RATE_LIMIT_WINDOW_MS) || 1000,
  max: Number(Bun.env.RATE_LIMIT_MAX) || 50,
}));

// Singleflight instance for tile request deduplication
const tileSingleflight = new Singleflight<Uint8Array | null>();

// Configuration initialization flag
let isConfigLoaded = false;

/**
 * Ensure configuration is loaded before handling requests
 * @returns {Promise<void>}
 */
async function ensureConfigLoaded(): Promise<void> {
  if (!isConfigLoaded) {
    await mapConfig.loadConfig();
    isConfigLoaded = true;
  }
}

/**
 * Fetch with timeout and retry support
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options with timeout and retry
 * @param {Record<string, string>} options.headers - Request headers
 * @param {number} [options.timeout=10000] - Request timeout in ms
 * @param {number} [options.retries=3] - Max retry attempts
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(
  url: string,
  options: {
    headers: Record<string, string>;
    timeout?: number;
    retries?: number;
  },
): Promise<Response> {
  const { timeout = 10000, retries = 3, ...fetchOptions } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok || attempt === retries) {
        return res;
      }
    }
    catch (error) {
      clearTimeout(timer);
      if (attempt === retries) {
        throw error;
      }
      // Exponential backoff: 100ms, 200ms, 400ms
      await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
    }
  }

  throw new Error("Unreachable");
}

/**
 * Detect image type from buffer
 * @param {Uint8Array} buffer - Image buffer
 * @returns {string} Image type ('jpg', 'png', or 'webp')
 */
function detectImageType(buffer: Uint8Array): string {
  // JPEG signature: FF D8 FF
  if (buffer.length >= 3
    && buffer[0] === 0xFF
    && buffer[1] === 0xD8
    && buffer[2] === 0xFF) {
    return "jpg";
  }

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4E
    && buffer[3] === 0x47
    && buffer[4] === 0x0D
    && buffer[5] === 0x0A
    && buffer[6] === 0x1A
    && buffer[7] === 0x0A) {
    return "png";
  }

  // WebP signature: 52 49 46 46 ... 57 45 42 50
  if (buffer.length >= 12
    && buffer[0] === 0x52 && buffer[1] === 0x49
    && buffer[2] === 0x46 && buffer[3] === 0x46
    && buffer[8] === 0x57 && buffer[9] === 0x45
    && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return "webp";
  }

  // Default to png if unknown
  return "png";
}

/**
 * Get content type from image type
 * @param {string} imageType - Image type ('jpg', 'png', or 'webp')
 * @returns {string} MIME content type
 */
function getContentType(imageType: string): string {
  switch (imageType) {
    case "jpg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      return "image/png";
  }
}

/**
 * GET /maps - List available map sources
 * @route GET /maps
 * @returns {Response} List of available map sources with metadata
 * @example
 * GET /maps
 * Returns: { "maps": { "osm": { "name": "OpenStreetMap", ... }, ... } }
 */
app.get("/maps", async (c) => {
  await ensureConfigLoaded();
  const sources = mapConfig.getAllMapSources();
  const response = Object.entries(sources).reduce((acc, [id, source]) => {
    acc[id] = {
      name: source.name,
      description: source.description,
    };
    return acc;
  }, {} as Record<string, any>);

  return c.json({ maps: response });
});

/**
 * GET /tiles.png - Get tile with multi-source support
 * @route GET /tiles.png
 * @param {object} c - Hono context
 * @param {object} c.req.query - Query parameters
 * @param {string} c.req.query.source - Map source identifier
 * @param {string} c.req.query.x - The x coordinate of the tile
 * @param {string} c.req.query.y - The y coordinate of the tile
 * @param {string} c.req.query.z - The zoom level of the tile
 * @returns {Promise<Response>} PNG image response with appropriate headers
 * @throws {400} Invalid parameters or zoom level
 * @throws {404} Map source not found
 * @throws {500} Configuration error or fetch failure
 * @example
 * GET /tiles.png?source=osm&z=3&x=1&y=2
 * Returns: PNG image with Cache-Control headers
 */
app.get("/tiles", async (c) => {
  const startTime = Date.now();
  const { source, x, y, z } = c.req.query();

  // Validate parameters
  if (!source || !x || !y || !z) {
    const errorMsg = "Missing required query parameters: source, x, y, z";
    logger.warn(errorMsg);
    return errorResponse(c, errorMsg, 400);
  }

  // Parse and validate numeric values
  const zoom = Number.parseInt(z, 10);
  const xCoord = Number.parseInt(x, 10);
  const yCoord = Number.parseInt(y, 10);

  if (Number.isNaN(zoom) || Number.isNaN(xCoord) || Number.isNaN(yCoord)) {
    const errorMsg = "Invalid coordinate format";
    logger.warn(errorMsg);
    return errorResponse(c, errorMsg, 400);
  }

  // Ensure configuration is loaded
  await ensureConfigLoaded();

  // Get map source configuration
  const mapSource = mapConfig.getMapSource(source);
  if (!mapSource) {
    const errorMsg = `Map source not found: ${source}`;
    logger.warn(errorMsg);
    return errorResponse(c, errorMsg, 404);
  }

  // Check zoom level bounds (minimum 0, no maximum limit)
  if (zoom < 0) {
    const errorMsg = "Zoom level must be non-negative";
    logger.warn(errorMsg);
    return errorResponse(c, errorMsg, 400);
  }

  // Build tile cache key
  const cacheKey = {
    x,
    y,
    z,
    mapSource: source,
  };

  // Use singleflight to deduplicate concurrent requests for the same tile
  const sfKey = `${source}:${z}:${x}:${y}`;
  const isCacheHit = { value: false };

  try {
    const tileBuffer = await tileSingleflight.do(sfKey, async () => {
      // Check cache first
      const cachedTile = await getCachedTile(cacheKey, mapSource.cachePrefix);

      if (cachedTile) {
        logger.debug(`Cache hit for tile: tiles?source=${source}&z=${z}&x=${x}&y=${y}`);
        isCacheHit.value = true;
        return cachedTile;
      }

      // Build tile URL
      let url = mapSource.urlTemplate;
      url = url.replace("{z}", z);
      url = url.replace("{x}", x);
      url = url.replace("{y}", y);

      // Handle subdomain rotation
      if (mapSource.subdomains && mapSource.subdomains.length > 0) {
        const subdomainIndex = (xCoord + yCoord + zoom) % mapSource.subdomains.length;
        url = url.replace("{s}", mapSource.subdomains[subdomainIndex]);
      }

      logger.debug(`Cache miss, fetching tile: tiles?source=${source}&z=${z}&x=${x}&y=${y} from ${url}`);

      // Prepare headers
      const requestHeaders: Record<string, string> = {
        "User-Agent": mapSource.headers?.["User-Agent"] || "MapTileCache/1.0",
        ...mapSource.headers,
      };

      const res = await fetchWithRetry(url, {
        headers: requestHeaders,
        timeout: mapSource.timeout,
        retries: mapSource.retryAttempts,
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch tile from source: ${res.statusText}`);
      }

      const buffer = new Uint8Array(await res.arrayBuffer());

      // Detect image format from response content-type or file signature
      const contentType = res.headers.get("content-type") || "";
      let imageType = "png";
      if (contentType.includes("jpeg") || contentType.includes("jpg")) {
        imageType = "jpg";
      }
      else if (contentType.includes("png")) {
        imageType = "png";
      }
      else {
        // Fallback to file signature detection
        imageType = detectImageType(buffer);
      }

      // Cache tile to S3 asynchronously
      cacheTileWithType(cacheKey, buffer, mapSource.cachePrefix, imageType).catch((error) => {
        logger.error(`Failed to cache tile: ${error}`);
      });

      return buffer;
    });

    if (!tileBuffer) {
      return errorResponse(c, "Tile not found", 404);
    }

    // Detect image format for response
    const imageType = detectImageType(tileBuffer);

    // Set appropriate response headers
    const headers = new Headers();
    headers.set("Content-Type", getContentType(imageType));
    headers.set("Cache-Control", `public, max-age=${mapSource.cacheMaxAge || 86400}`);
    headers.set("X-Cache", isCacheHit.value ? "HIT" : "MISS");
    headers.set("Content-Disposition", "inline"); // Enable browser preview

    logger.info(`Tile served: tiles?source=${source}&z=${z}&x=${x}&y=${y} [${isCacheHit.value ? "HIT" : "MISS"}]`);

    // Record metrics
    metrics.recordRequest(isCacheHit.value, Date.now() - startTime);

    return new Response(tileBuffer, {
      status: 200,
      headers,
    });
  }
  catch (error) {
    const errorMsg = `Error fetching tile: ${error}`;
    logger.error(errorMsg);
    metrics.recordError();
    return errorResponse(c, "Internal server error", 500);
  }
});

/**
 * GET /health - Health check endpoint
 * @route GET /health
 * @returns {Response} Health status response
 * @example
 * GET /health
 * Returns: { "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z", "service": "maptile-cache", "version": "1.0.0" }
 */
app.get("/health", async (c) => {
  await ensureConfigLoaded();
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "maptile-cache",
    version: "1.0.0",
    availableSources: mapConfig.getAvailableSources(),
  });
});

/**
 * GET /metrics - Metrics endpoint
 * @route GET /metrics
 * @returns {Response} Metrics snapshot
 * @example
 * GET /metrics
 * Returns: { "uptime": 3600, "requests": 1000, "cacheHits": 800, ... }
 */
app.get("/metrics", async (c) => {
  const snapshot = metrics.getSnapshot();
  snapshot.memoryCacheStats = getMemoryCacheStats();
  return c.json(snapshot);
});

/**
 * Default export of the Hono application
 * @type {Hono}
 */
export default app;
