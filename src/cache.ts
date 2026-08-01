import logger from "./logger.js";
import { MemoryCache } from "./memory-cache.js";
import { s3 } from "./storage.js";

// Memory cache for hot tiles (default: 1000 tiles, 5 min TTL)
const memoryCache = new MemoryCache<Uint8Array>({
  maxSize: Number(Bun.env.MEMORY_CACHE_MAX_SIZE) || 1000,
  ttlMs: Number(Bun.env.MEMORY_CACHE_TTL_MS) || 5 * 60 * 1000,
});

/**
 * Enhanced tile cache key interface with map source support
 * @interface
 * @property {string} x - The x coordinate of the tile
 * @property {string} y - The y coordinate of the tile
 * @property {string} z - The zoom level of the tile
 * @property {string} mapSource - The map source identifier
 */
export interface TileCacheKey {
  x: string;
  y: string;
  z: string;
  mapSource: string;
}

/**
 * Generate S3 object key based on tile coordinates and map source
 * @param {TileCacheKey} key - The tile coordinates and map source
 * @param {string} key.x - The x coordinate
 * @param {string} key.y - The y coordinate
 * @param {string} key.z - The zoom level
 * @param {string} key.mapSource - The map source identifier
 * @param {string} [cachePrefix] - Optional cache prefix override
 * @param {string} [extension] - Optional file extension (png or jpg)
 * @returns {string} The S3 object key path
 * @example
 * generateTileKey({ x: "1", y: "2", z: "3", mapSource: "osm" })
 * // Returns: "osm/tiles/3/1/2.png"
 */
function generateTileKey(
  { x, y, z, mapSource }: TileCacheKey,
  cachePrefix?: string,
  extension: string = "png",
): string {
  const prefix = cachePrefix || mapSource;
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, ""); // Remove leading and trailing slashes
  const tilePath = `tiles/${z}/${x}/${y}.${extension}`;

  return cleanPrefix ? `${cleanPrefix}/${tilePath}` : tilePath;
}

/**
 * Get tile from S3 cache
 * @param {TileCacheKey} key - The tile coordinates and map source to retrieve
 * @param {string} [cachePrefix] - Optional cache prefix override
 * @returns {Promise<Uint8Array | null>} The tile data as Uint8Array if found, null otherwise
 * @throws {Error} Logs warning if error occurs during S3 operations
 * @example
 * const tile = await getCachedTile({ x: "1", y: "2", z: "3", mapSource: "osm" });
 * if (tile) {
 *   // Use cached tile
 * }
 */
export async function getCachedTile(
  key: TileCacheKey,
  cachePrefix?: string,
): Promise<Uint8Array | null> {
  try {
    // Try multiple extensions to find cached tile
    const extensions = ["png", "jpg", "webp"];

    for (const ext of extensions) {
      const objectKey = generateTileKey(key, cachePrefix, ext);

      // Check memory cache first (L1)
      const memoryResult = memoryCache.get(objectKey);
      if (memoryResult) {
        logger.debug(`Memory cache hit for tile: ${objectKey}`);
        return memoryResult;
      }

      // Check S3 cache (L2)
      const file = s3.file(objectKey);
      const exists = await file.exists();

      if (exists) {
        const buffer = new Uint8Array(await file.arrayBuffer());

        // Store in memory cache for future requests
        memoryCache.set(objectKey, buffer);
        logger.debug(`S3 cache hit for tile: ${objectKey}`);

        return buffer;
      }
    }

    logger.debug(`Cache miss for tile: ${key.mapSource}/tiles/${key.z}/${key.x}/${key.y}`);
    return null;
  }
  catch (error) {
    logger.warn(`Error reading from cache: ${error}`);
    return null;
  }
}

/**
 * Cache tile to S3 with specified image type
 * @param {TileCacheKey} key - The tile coordinates and map source to cache
 * @param {Uint8Array} data - The tile image data as Uint8Array
 * @param {string} [cachePrefix] - Optional cache prefix override
 * @param {string} [imageType] - Image type (png or jpg)
 * @returns {Promise<void>} Resolves when tile is successfully cached
 * @throws {Error} Logs error if caching fails
 * @example
 * const response = await fetch(tileUrl);
 * const data = new Uint8Array(await response.arrayBuffer());
 * await cacheTileWithType({ x: "1", y: "2", z: "3", mapSource: "osm" }, data, "osm", "jpg");
 */
export async function cacheTileWithType(
  key: TileCacheKey,
  data: Uint8Array,
  cachePrefix?: string,
  imageType: string = "png",
): Promise<void> {
  try {
    const objectKey = generateTileKey(key, cachePrefix, imageType);
    logger.info(`Caching tile to S3: ${objectKey}`);

    const file = s3.file(objectKey);
    const contentType = imageType === "jpg" ? "image/jpeg" : imageType === "webp" ? "image/webp" : "image/png";
    await file.write(data, {
      type: contentType,
    });

    // Also store in memory cache
    memoryCache.set(objectKey, data);

    logger.debug(`Tile cached successfully: ${objectKey}`);
  }
  catch (error) {
    logger.error(`Error caching tile: ${error}`);
  }
}

/**
 * Get memory cache statistics
 * @returns {object} Memory cache statistics
 */
export function getMemoryCacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
  return memoryCache.getStats();
}
