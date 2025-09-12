import { Hono } from "hono";
import { cacheTile, getCachedTile } from "./cache";
import { mapConfig } from "./config";
import logger from "./logger";

/**
 * Hono application instance for map tile caching service
 * @remarks
 * Provides RESTful API endpoints for serving cached map tiles
 * with automatic S3 caching functionality and multi-map source support
 */
const app = new Hono();

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
      maxZoom: source.maxZoom,
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
  const { source, x, y, z } = c.req.query();

  // Validate parameters
  if (!source || !x || !y || !z) {
    const errorMsg = "Missing required query parameters: source, x, y, z";
    logger.warn(errorMsg);
    return c.text(errorMsg, 400);
  }

  // Parse and validate numeric values
  const zoom = Number.parseInt(z, 10);
  const xCoord = Number.parseInt(x, 10);
  const yCoord = Number.parseInt(y, 10);

  if (Number.isNaN(zoom) || Number.isNaN(xCoord) || Number.isNaN(yCoord)) {
    const errorMsg = "Invalid coordinate format";
    logger.warn(errorMsg);
    return c.text(errorMsg, 400);
  }

  // Ensure configuration is loaded
  await ensureConfigLoaded();

  // Get map source configuration
  const mapSource = mapConfig.getMapSource(source);
  if (!mapSource) {
    const errorMsg = `Map source not found: ${source}`;
    logger.warn(errorMsg);
    return c.text(errorMsg, 404);
  }

  // Check zoom level bounds
  if (zoom < 0 || zoom > mapSource.maxZoom) {
    const errorMsg = `Zoom level out of range. Max zoom: ${mapSource.maxZoom}`;
    logger.warn(errorMsg);
    return c.text(errorMsg, 400);
  }

  // Build tile cache key
  const cacheKey = {
    x,
    y,
    z,
    mapSource: source,
  };

  // Check cache
  const cachedTile = await getCachedTile(cacheKey, mapSource.cachePrefix);

  if (cachedTile) {
    logger.info(`Cache hit for tile: tiles?source=${source}&z=${z}&x=${x}&y=${y}`);

    // Set appropriate response headers
    const headers = new Headers();
    headers.set("Content-Type", "image/png");
    headers.set("Cache-Control", "public, max-age=86400");
    headers.set("X-Cache", "HIT");

    return new Response(cachedTile, {
      status: 200,
      headers,
    });
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

  logger.info(`Cache miss, fetching tile: tiles.png?source=${source}&z=${z}&x=${x}&y=${y} from ${url}`);

  try {
    // Prepare headers
    const requestHeaders: Record<string, string> = {
      "User-Agent": mapSource.headers?.["User-Agent"] || "MapTileCache/1.0",
      ...mapSource.headers,
    };

    const res = await fetch(url, {
      headers: requestHeaders,
    });

    if (!res.ok) {
      const errorMsg = `Failed to fetch tile from source: ${res.statusText}`;
      logger.error(errorMsg);
      return c.text(errorMsg, 500);
    }

    const tileBuffer = new Uint8Array(await res.arrayBuffer());

    // Cache tile to S3 asynchronously
    cacheTile(cacheKey, tileBuffer, mapSource.cachePrefix).catch((error) => {
      logger.error(`Failed to cache tile: ${error}`);
    });

    // Set appropriate response headers
    const headers = new Headers();

    logger.info(`Tile fetched and cached successfully: tiles.png?source=${source}&z=${z}&x=${x}&y=${y}`);

    return new Response(tileBuffer, {
      status: 200,
      headers,
    });
  }
  catch (error) {
    const errorMsg = `Error fetching tile: ${error}`;
    logger.error(errorMsg);
    return c.text("Internal server error", 500);
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
 * Default export of the Hono application
 * @type {Hono}
 */
export default app;
