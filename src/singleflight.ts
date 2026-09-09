/**
 * Singleflight pattern implementation
 * Prevents duplicate concurrent requests for the same key
 *
 * @template T - The type of the result
 */
export class Singleflight<T> {
  /**
   * Get the number of currently in-flight requests
   *
   * @returns {number} Number of in-flight requests
   */
  get size(): number {
    return this.inflight.size;
  }

  private inflight = new Map<string, Promise<T>>();

  /**
   * Execute a function with singleflight deduplication
   * If a request for the same key is already in flight,
   * subsequent calls will wait for the first request's result.
   * On error, the entry is removed so the next caller can retry.
   *
   * @param {string} key - The deduplication key
   * @param {() => Promise<T>} fn - The function to execute
   * @returns {Promise<T>} The result of the function
   */
  async do(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    const promise = fn().catch((error) => {
      // Remove on failure so the next caller can retry
      this.inflight.delete(key);
      throw error;
    }).finally(() => {
      // Only delete on success (error path already deleted)
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }
}
