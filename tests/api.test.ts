import { describe, expect, it } from "bun:test";
import app from "../src/index";

describe("API Endpoints", () => {
  describe("GET /maps", () => {
    it("should return list of map sources", async () => {
      const req = new Request("http://localhost/maps");
      const res = await app.fetch(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("maps");
      expect(typeof data.maps).toBe("object");
    });
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const req = new Request("http://localhost/health");
      const res = await app.fetch(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("status", "ok");
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("service", "maptile-cache");
      expect(data).toHaveProperty("version", "1.0.0");
      expect(data).toHaveProperty("availableSources");
    });
  });

  describe("GET /metrics", () => {
    it("should return metrics snapshot", async () => {
      const req = new Request("http://localhost/metrics");
      const res = await app.fetch(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("uptime");
      expect(data).toHaveProperty("requests");
      expect(data).toHaveProperty("cacheHits");
      expect(data).toHaveProperty("cacheMisses");
      expect(data).toHaveProperty("cacheHitRate");
      expect(data).toHaveProperty("errors");
      expect(data).toHaveProperty("avgLatencyMs");
      expect(data).toHaveProperty("memoryCacheStats");
    });
  });

  describe("GET /tiles", () => {
    it("should return 400 for missing parameters", async () => {
      const req = new Request("http://localhost/tiles");
      const res = await app.fetch(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data).toHaveProperty("code", 400);
    });

    it("should return 400 for invalid coordinates", async () => {
      const req = new Request("http://localhost/tiles?source=test&z=abc&x=1&y=2");
      const res = await app.fetch(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data).toHaveProperty("code", 400);
    });

    it("should return 404 for unknown map source", async () => {
      const req = new Request("http://localhost/tiles?source=nonexistent&z=0&x=0&y=0");
      const res = await app.fetch(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data).toHaveProperty("error");
      expect(data).toHaveProperty("code", 404);
    });

    it("should return 400 for negative zoom level", async () => {
      // Use a valid source from config/maps.json
      const req = new Request("http://localhost/tiles?source=satellite&z=-1&x=0&y=0");
      const res = await app.fetch(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data).toHaveProperty("code", 400);
    });
  });
});
