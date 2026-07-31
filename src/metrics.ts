/**
 * Metrics collector for tile cache service
 */
export class Metrics {
  private requests = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private errors = 0;
  private totalLatency = 0;
  private readonly startTime = Date.now();

  /**
   * Record a tile request
   * @param {boolean} cacheHit - Whether the request was a cache hit
   * @param {number} latencyMs - Request latency in milliseconds
   */
  recordRequest(cacheHit: boolean, latencyMs: number): void {
    this.requests++;
    this.totalLatency += latencyMs;
    if (cacheHit) {
      this.cacheHits++;
    }
    else {
      this.cacheMisses++;
    }
  }

  /**
   * Record an error
   */
  recordError(): void {
    this.errors++;
  }

  /**
   * Get metrics snapshot
   * @returns {object} Current metrics
   */
  getSnapshot(): {
    uptime: number;
    requests: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    errors: number;
    avgLatencyMs: number;
    memoryCacheStats: { size: number; hits: number; misses: number; hitRate: number };
  } {
    const totalCache = this.cacheHits + this.cacheMisses;
    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      requests: this.requests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: totalCache > 0 ? this.cacheHits / totalCache : 0,
      errors: this.errors,
      avgLatencyMs: this.requests > 0 ? this.totalLatency / this.requests : 0,
      memoryCacheStats: { size: 0, hits: 0, misses: 0, hitRate: 0 },
    };
  }
}

// Singleton instance
export const metrics = new Metrics();
