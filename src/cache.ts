import logger from "./logger.js";
import { s3 } from "./storage.js";

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
 * @returns {string} The S3 object key path
 * @example
 * generateTileKey({ x: "1", y: "2", z: "3", mapSource: "osm" })
 * // Returns: "osm/tiles/3/1/2.png"
 */
function generateTileKey(
  { x, y, z, mapSource }: TileCacheKey,
  cachePrefix?: string,
): string {
  const prefix = cachePrefix || mapSource;
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, ""); // Remove leading and trailing slashes
  const tilePath = `tiles/${z}/${x}/${y}.png`;

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
    const objectKey = generateTileKey(key, cachePrefix);
    logger.info(`Checking S3 cache for tile: ${objectKey}`);

    const file = s3.file(objectKey);
    const exists = await file.exists();

    if (!exists) {
      logger.info(`Cache miss for tile: ${objectKey}`);
      return null;
    }

    const buffer = await file.arrayBuffer();
    logger.info(`Cache hit for tile: ${objectKey}`);
    return new Uint8Array(buffer);
  }
  catch (error) {
    logger.warn(`Error reading from cache: ${error}`);
    return null;
  }
}

/**
 * Cache tile to S3
 * @param {TileCacheKey} key - The tile coordinates and map source to cache
 * @param {Uint8Array} data - The tile image data as Uint8Array
 * @param {string} [cachePrefix] - Optional cache prefix override
 * @returns {Promise<void>} Resolves when tile is successfully cached
 * @throws {Error} Logs error if caching fails
 * @example
 * const response = await fetch(tileUrl);
 * const data = new Uint8Array(await response.arrayBuffer());
 * await cacheTile({ x: "1", y: "2", z: "3", mapSource: "osm" }, data);
 */
export async function cacheTile(
  key: TileCacheKey,
  data: Uint8Array,
  cachePrefix?: string,
): Promise<void> {
  try {
    const objectKey = generateTileKey(key, cachePrefix);
    logger.info(`Caching tile to S3: ${objectKey}`);

    const file = s3.file(objectKey);
    await file.write(data, {
      type: "image/png",
    });

    logger.info(`Tile cached successfully: ${objectKey}`);
  }
  catch (error) {
    logger.error(`Error caching tile: ${error}`);
  }
}

/**
 * Check if tile is cached
 * @param {TileCacheKey} key - The tile coordinates and map source to check
 * @param {string} [cachePrefix] - Optional cache prefix override
 * @returns {Promise<boolean>} True if tile exists in cache, false otherwise
 * @throws {Error} Logs warning if error occurs during check
 * @example
 * const exists = await isTileCached({ x: "1", y: "2", z: "3", mapSource: "osm" });
 * if (exists) {
 *   // Tile is cached
 * }
 */
export async function isTileCached(
  key: TileCacheKey,
  cachePrefix?: string,
): Promise<boolean> {
  try {
    const objectKey = generateTileKey(key, cachePrefix);
    const file = s3.file(objectKey);
    return await file.exists();
  }
  catch (error) {
    logger.warn(`Error checking cache: ${error}`);
    return false;
  }
}
