/**
 * LRU (Least Recently Used) cache implementation
 * Uses Map's insertion order for LRU eviction
 * Supports both entry count and byte size limits
 *
 * @template V - The type of cached values
 */
export class MemoryCache<V> {
  private cache = new Map<string, { bytes: number; expires: number; value: V }>();
  private currentBytes = 0;
  private hits = 0;
  private readonly maxBytes: number;
  private readonly maxSize: number;
  private misses = 0;
  private readonly ttl: number;

  /**
   * Create a new MemoryCache instance
   *
   * @param {object} options - Cache options
   * @param {number} [options.maxSize] - Maximum number of items to cache
   * @param {number} [options.ttlMs] - Time-to-live in milliseconds (default: 5 minutes)
   * @param {number} [options.maxBytes] - Maximum total byte size of cached values
   */
  constructor(options: { maxBytes?: number; maxSize?: number; ttlMs?: number } = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.ttl = options.ttlMs ?? 5 * 60 * 1000;
    this.maxBytes = options.maxBytes ?? Infinity;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.currentBytes = 0;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get a value from the cache
   *
   * @param {string} key - The cache key
   * @returns {V | null} The cached value or null if not found/expired
   */
  get(key: string): null | V {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.currentBytes -= entry.bytes;
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // LRU: move to end by deleting and re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  /**
   * Get cache statistics
   *
   * @returns {object} Cache statistics
   */
  getStats(): { bytes: number; hitRate: number; hits: number; misses: number; size: number } {
    const total = this.hits + this.misses;
    return {
      bytes: this.currentBytes,
      hitRate: total > 0 ? this.hits / total : 0,
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
    };
  }

  /**
   * Estimate byte size of a value
   *
   * @param {V} value - The value to measure
   * @returns {number} Estimated byte size
   */
  private estimateBytes(value: V): number {
    if (value instanceof Uint8Array) {
      return value.byteLength;
    }
    if (typeof value === "string") {
      return value.length * 2; // UTF-16
    }
    // Rough estimate for other types
    try {
      return JSON.stringify(value).length * 2;
    }
    catch {
      return 64; // fallback estimate
    }
  }

  /**
   * Set a value in the cache
   *
   * @param {string} key - The cache key
   * @param {V} value - The value to cache
   */
  set(key: string, value: V): void {
    const bytes = this.estimateBytes(value);

    // If key exists, delete it first to update position and byte count
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentBytes -= existing.bytes;
      this.cache.delete(key);
    }

    // Evict oldest entries until we have room (by count and bytes)
    while (this.cache.size >= this.maxSize || (this.currentBytes + bytes > this.maxBytes && this.cache.size > 0)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey === undefined) {
        break;
      }
      const evicted = this.cache.get(firstKey)!;
      this.currentBytes -= evicted.bytes;
      this.cache.delete(firstKey);
    }

    // Skip caching if a single item exceeds the byte limit
    if (bytes > this.maxBytes) {
      return;
    }

    this.cache.set(key, {
      bytes,
      expires: Date.now() + this.ttl,
      value,
    });
    this.currentBytes += bytes;
  }
}
