import logger from "./logger.js";
import { MemoryCache } from "./memory-cache.js";
import { s3 } from "./storage.js";

// Memory cache for hot tiles (default: 1000 tiles, 5 min TTL, 256MB max)
const memoryCache = new MemoryCache<Uint8Array>({
  maxSize: Number(Bun.env.MEMORY_CACHE_MAX_SIZE) || 1000,
  ttlMs: Number(Bun.env.MEMORY_CACHE_TTL_MS) || 5 * 60 * 1000,
  maxBytes: Number(Bun.env.MEMORY_CACHE_MAX_BYTES) || 256 * 1024 * 1024,
});

// Index cache: maps tile identity to its file extension
// Key: "prefix:z:x:y" → Value: "png" | "jpg" | "webp"
const extensionIndex = new MemoryCache<string>({
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
 * @param {string} [cachePrefix] - Optional cache prefix override
 * @param {string} [extension] - Optional file extension (png, jpg, or webp)
 * @returns {string} The S3 object key path
 */
function generateTileKey(
  { x, y, z, mapSource }: TileCacheKey,
  cachePrefix?: string,
  extension: string = "png",
): string {
  const prefix = cachePrefix || mapSource;
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const tilePath = `tiles/${z}/${x}/${y}.${extension}`;

  return cleanPrefix ? `${cleanPrefix}/${tilePath}` : tilePath;
}

/**
 * Generate the index key for extension lookup
 * @param {TileCacheKey} key - The tile coordinates and map source
 * @param {string} [cachePrefix] - Optional cache prefix override
 * @returns {string} The index key
 */
function generateIndexKey(
  { x, y, z, mapSource }: TileCacheKey,
  cachePrefix?: string,
): string {
  const prefix = cachePrefix || mapSource;
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
  return cleanPrefix ? `${cleanPrefix}:${z}:${x}:${y}` : `${z}:${x}:${y}`;
}

/**
 * Get tile from cache (L1 memory → L2 S3)
 * Uses an extension index to avoid probing multiple extensions.
 * @param {TileCacheKey} key - The tile coordinates and map source to retrieve
 * @param {string} [cachePrefix] - Optional cache prefix override
 * @returns {Promise<{ data: Uint8Array; imageType: string } | null>} The tile data and type, or null
 */
export async function getCachedTile(
  key: TileCacheKey,
  cachePrefix?: string,
): Promise<{ data: Uint8Array; imageType: string } | null> {
  try {
    const indexKey = generateIndexKey(key, cachePrefix);

    // Try the known extension first (from index or previous S3 lookup)
    const knownExt = extensionIndex.get(indexKey);
    const extensions = knownExt
      ? [knownExt, "png", "jpg", "webp"].filter((v, i, a) => a.indexOf(v) === i)
      : ["png", "jpg", "webp"];

    for (const ext of extensions) {
      const objectKey = generateTileKey(key, cachePrefix, ext);

      // L1: Check memory cache
      const memoryResult = memoryCache.get(objectKey);
      if (memoryResult) {
        logger.debug(`Memory cache hit for tile: ${objectKey}`);
        extensionIndex.set(indexKey, ext);
        return { data: memoryResult, imageType: ext };
      }

      // L2: Check S3 cache
      const file = s3.file(objectKey);
      const exists = await file.exists();

      if (exists) {
        const buffer = new Uint8Array(await file.arrayBuffer());

        // Populate L1 and index for future requests
        memoryCache.set(objectKey, buffer);
        extensionIndex.set(indexKey, ext);
        logger.debug(`S3 cache hit for tile: ${objectKey}`);

        return { data: buffer, imageType: ext };
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
 * Cache tile to S3 and memory with specified image type
 * @param {TileCacheKey} key - The tile coordinates and map source to cache
 * @param {Uint8Array} data - The tile image data as Uint8Array
 * @param {string} [cachePrefix] - Optional cache prefix override
 * @param {string} [imageType] - Image type (png, jpg, or webp)
 * @returns {Promise<void>} Resolves when tile is successfully cached
 */
export async function cacheTileWithType(
  key: TileCacheKey,
  data: Uint8Array,
  cachePrefix?: string,
  imageType: string = "png",
): Promise<void> {
  try {
    const objectKey = generateTileKey(key, cachePrefix, imageType);
    const indexKey = generateIndexKey(key, cachePrefix);
    logger.info(`Caching tile to S3: ${objectKey}`);

    const file = s3.file(objectKey);
    const contentType = imageType === "jpg" ? "image/jpeg" : imageType === "webp" ? "image/webp" : "image/png";
    await file.write(data, {
      type: contentType,
    });

    // Also store in memory cache and update extension index
    memoryCache.set(objectKey, data);
    extensionIndex.set(indexKey, imageType);

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
export function getMemoryCacheStats(): { size: number; hits: number; misses: number; hitRate: number; bytes: number } {
  return memoryCache.getStats();
}
