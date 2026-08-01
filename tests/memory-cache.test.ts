import { describe, expect, it } from "bun:test";
import { MemoryCache } from "../src/memory-cache";

describe("MemoryCache", () => {
  it("should store and retrieve values", () => {
    const cache = new MemoryCache<string>();

    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("should return null for missing keys", () => {
    const cache = new MemoryCache<string>();

    expect(cache.get("missing")).toBeNull();
  });

  it("should evict least recently used items when at capacity", () => {
    const cache = new MemoryCache<string>({ maxSize: 3 });

    cache.set("key1", "value1");
    cache.set("key2", "value2");
    cache.set("key3", "value3");

    // Access key1 to make it recently used
    cache.get("key1");

    // Add key4, should evict key2 (least recently used)
    cache.set("key4", "value4");

    expect(cache.get("key1")).toBe("value1"); // Recently accessed
    expect(cache.get("key2")).toBeNull(); // Evicted
    expect(cache.get("key3")).toBe("value3");
    expect(cache.get("key4")).toBe("value4");
  });

  it("should expire entries after TTL", async () => {
    const cache = new MemoryCache<string>({ ttlMs: 100 });

    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(cache.get("key1")).toBeNull();
  });

  it("should update existing keys", () => {
    const cache = new MemoryCache<string>();

    cache.set("key1", "value1");
    cache.set("key1", "value2");

    expect(cache.get("key1")).toBe("value2");
  });

  it("should track hit/miss statistics", () => {
    const cache = new MemoryCache<string>();

    cache.set("key1", "value1");

    cache.get("key1"); // Hit
    cache.get("key1"); // Hit
    cache.get("missing"); // Miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.667, 2);
  });

  it("should clear all entries", () => {
    const cache = new MemoryCache<string>();

    cache.set("key1", "value1");
    cache.set("key2", "value2");
    cache.clear();

    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key2")).toBeNull();
    expect(cache.getStats().size).toBe(0);
  });
});
