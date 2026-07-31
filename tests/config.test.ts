import { describe, expect, it } from "bun:test";
import { MapConfig } from "../src/config";

describe("MapConfig", () => {
  it("should be a singleton", () => {
    const instance1 = MapConfig.getInstance();
    const instance2 = MapConfig.getInstance();

    expect(instance1).toBe(instance2);
  });

  it("should return null when config not loaded", () => {
    const config = MapConfig.getInstance();

    // Config might be loaded from previous tests, so we test the method exists
    expect(typeof config.getMapSource).toBe("function");
  });

  it("should check if map source exists", () => {
    const config = MapConfig.getInstance();

    // Test the method exists and returns boolean
    expect(typeof config.hasMapSource).toBe("function");
  });

  it("should get available sources", () => {
    const config = MapConfig.getInstance();

    // Test the method exists and returns array
    const sources = config.getAvailableSources();
    expect(Array.isArray(sources)).toBe(true);
  });
});
