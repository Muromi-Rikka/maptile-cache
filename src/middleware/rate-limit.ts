import type { Context, Next } from "hono";

/**
 * Rate limit record for a single IP
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiting middleware
 * @param {object} options - Rate limit options
 * @param {number} [options.windowMs=1000] - Time window in milliseconds
 * @param {number} [options.max=50] - Maximum requests per window
 * @returns {Function} Hono middleware function
 */
export function rateLimit(options: { windowMs?: number; max?: number } = {}) {
  const { windowMs = 1000, max = 50 } = options;
  const hits = new Map<string, RateLimitRecord>();

  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    hits.forEach((record, ip) => {
      if (now > record.resetTime) {
        hits.delete(ip);
      }
    });
  }, windowMs * 2);

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
      return c.json({ error: "Too many requests", code: 429 }, 429);
    }

    record.count++;
    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(max - record.count));
    await next();
  };
}
