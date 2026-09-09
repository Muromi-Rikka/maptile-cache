/**
 * Metrics collector for tile cache service
 */
export class Metrics {
  private cacheHits = 0;
  private cacheMisses = 0;
  private errors = 0;
  private requests = 0;
  private readonly startTime = Date.now();
  private totalLatency = 0;

  /**
   * Get metrics snapshot
   *
   * @returns {object} Current metrics
   */
  getSnapshot(): {
    avgLatencyMs: number;
    cacheHitRate: number;
    cacheHits: number;
    cacheMisses: number;
    errors: number;
    memoryCacheStats: { bytes: number; hitRate: number; hits: number; misses: number; size: number };
    requests: number;
    uptime: number;
  } {
    const totalCache = this.cacheHits + this.cacheMisses;
    return {
      avgLatencyMs: this.requests > 0 ? this.totalLatency / this.requests : 0,
      cacheHitRate: totalCache > 0 ? this.cacheHits / totalCache : 0,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      errors: this.errors,
      memoryCacheStats: { bytes: 0, hitRate: 0, hits: 0, misses: 0, size: 0 },
      requests: this.requests,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /**
   * Record an error
   */
  recordError(): void {
    this.errors++;
  }

  /**
   * Record a tile request
   *
   * @param {boolean} isCacheHit - Whether the request was a cache hit
   * @param {number} latencyMs - Request latency in milliseconds
   */
  recordRequest(isCacheHit: boolean, latencyMs: number): void {
    this.requests++;
    this.totalLatency += latencyMs;
    if (isCacheHit) {
      this.cacheHits++;
    }
    else {
      this.cacheMisses++;
    }
  }
}

// Singleton instance
export const metrics = new Metrics();
