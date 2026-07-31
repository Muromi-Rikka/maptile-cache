/**
 * Simple LRU (Least Recently Used) cache implementation
 * Uses Map's insertion order for LRU eviction
 * @template V - The type of cached values
 */
export class MemoryCache<V> {
  private cache = new Map<string, { value: V; expires: number }>();
  private readonly maxSize: number;
  private readonly ttl: number;
  private hits = 0;
  private misses = 0;

  /**
   * Create a new MemoryCache instance
   * @param {object} options - Cache options
   * @param {number} [options.maxSize=1000] - Maximum number of items to cache
   * @param {number} [options.ttlMs=300000] - Time-to-live in milliseconds (default: 5 minutes)
   */
  constructor(options: { maxSize?: number; ttlMs?: number } = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.ttl = options.ttlMs ?? 5 * 60 * 1000;
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
   * @param {value} value - The value to cache
   */
  set(key: string, value: V): void {
    // If key exists, delete it first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl,
    });
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}
