import { describe, expect, it } from "bun:test";
import { Singleflight } from "../src/singleflight";

describe("Singleflight", () => {
  it("should deduplicate concurrent requests", async () => {
    const sf = new Singleflight<number>();
    let callCount = 0;

    const fn = async () => {
      callCount++;
      await new Promise(resolve => setTimeout(resolve, 100));
      return 42;
    };

    // Launch 3 concurrent requests for the same key
    const [result1, result2, result3] = await Promise.all([
      sf.do("key1", fn),
      sf.do("key1", fn),
      sf.do("key1", fn),
    ]);

    expect(result1).toBe(42);
    expect(result2).toBe(42);
    expect(result3).toBe(42);
    expect(callCount).toBe(1); // Only called once
  });

  it("should allow different keys to execute independently", async () => {
    const sf = new Singleflight<number>();
    let callCount = 0;

    const fn = async (value: number) => {
      callCount++;
      await new Promise(resolve => setTimeout(resolve, 50));
      return value;
    };

    const [result1, result2] = await Promise.all([
      sf.do("key1", () => fn(1)),
      sf.do("key2", () => fn(2)),
    ]);

    expect(result1).toBe(1);
    expect(result2).toBe(2);
    expect(callCount).toBe(2);
  });

  it("should clean up after request completes", async () => {
    const sf = new Singleflight<number>();

    await sf.do("key1", async () => 42);
    expect(sf.size).toBe(0);

    // Should be able to make a new request for the same key
    const result = await sf.do("key1", async () => 100);
    expect(result).toBe(100);
  });

  it("should handle errors correctly", async () => {
    const sf = new Singleflight<number>();

    const failingFn = async () => {
      throw new Error("Test error");
    };

    // All concurrent requests should fail
    await expect(
      Promise.all([
        sf.do("key1", failingFn),
        sf.do("key1", failingFn),
      ]),
    ).rejects.toThrow("Test error");

    // Should clean up after error
    expect(sf.size).toBe(0);
  });
});
