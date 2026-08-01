/**
 * LRU (Least Recently Used) cache implementation
 * Uses Map's insertion order for LRU eviction
 * Supports both entry count and byte size limits
 * @template V - The type of cached values
 */
export class MemoryCache<V> {
  private cache = new Map<string, { value: V; expires: number; bytes: number }>();
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly maxBytes: number;
  private currentBytes = 0;
  private hits = 0;
  private misses = 0;

  /**
   * Create a new MemoryCache instance
   * @param {object} options - Cache options
   * @param {number} [options.maxSize] - Maximum number of items to cache
   * @param {number} [options.ttlMs] - Time-to-live in milliseconds (default: 5 minutes)
   * @param {number} [options.maxBytes] - Maximum total byte size of cached values
   */
  constructor(options: { maxSize?: number; ttlMs?: number; maxBytes?: number } = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.ttl = options.ttlMs ?? 5 * 60 * 1000;
    this.maxBytes = options.maxBytes ?? Infinity;
  }

  /**
   * Estimate byte size of a value
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
   * Get a value from the cache
   * @param {string} key - The cache key
   * @returns {V | null} The cached value or null if not found/expired
   */
  get(key: string): V | null {
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
   * Set a value in the cache
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
      if (firstKey !== undefined) {
        const evicted = this.cache.get(firstKey)!;
        this.currentBytes -= evicted.bytes;
        this.cache.delete(firstKey);
      }
      else {
        break;
      }
    }

    // Skip caching if a single item exceeds the byte limit
    if (bytes > this.maxBytes) {
      return;
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl,
      bytes,
    });
    this.currentBytes += bytes;
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getStats(): { size: number; hits: number; misses: number; hitRate: number; bytes: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      bytes: this.currentBytes,
    };
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
}
