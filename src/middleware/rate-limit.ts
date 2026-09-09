import type { Context, Next } from "hono";

/**
 * Rate limit record for a single IP
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * Cleanup handle for the periodic timer
 */
let cleanupTimer: null | ReturnType<typeof setInterval> = null;

/**
 * Simple in-memory rate limiting middleware
 *
 * @param {object} options - Rate limit options
 * @param {number} [options.windowMs] - Time window in milliseconds
 * @param {number} [options.max] - Maximum requests per window
 * @returns {Function} Hono middleware function
 */
export function rateLimit(options: { max?: number; windowMs?: number } = {}) {
  const { max = 50, windowMs = 1000 } = options;
  const hits = new Map<string, RateLimitRecord>();

  // Cleanup old entries periodically
  if (cleanupTimer !== null) {
    clearInterval(cleanupTimer);
  }
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    hits.forEach((record, ip) => {
      if (now > record.resetTime) {
        hits.delete(ip);
      }
    });
  }, windowMs * 2);

  // Allow the process to exit even if the timer is active
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }

  return async (c: Context, next: Next) => {
    const ip = c.req.header("x-forwarded-for")
      || c.req.header("x-real-ip")
      || "unknown";
    const now = Date.now();
    const record = hits.get(ip);

    if (!record || now > record.resetTime) {
      hits.set(ip, { count: 1, resetTime: now + windowMs });
      c.header("X-RateLimit-Limit", String(max));
      c.header("X-RateLimit-Remaining", String(max - 1));
      await next();
      return;
    }

    if (record.count >= max) {
      c.header("X-RateLimit-Limit", String(max));
      c.header("X-RateLimit-Remaining", "0");
      c.header("Retry-After", String(Math.ceil((record.resetTime - now) / 1000)));
      return c.json({ code: 429, error: "Too many requests" }, 429);
    }

    record.count++;
    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(max - record.count));
    await next();
  };
}

/**
 * Cleanup the rate limit periodic timer (call during shutdown)
 */
export function rateLimitCleanup(): void {
  if (cleanupTimer === null) {
    return;
  }

  clearInterval(cleanupTimer);
  cleanupTimer = null;
}
