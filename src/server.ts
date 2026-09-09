import process from "node:process";
import app, { getInflightRequests } from "./index";
import logger from "./logger";
import { rateLimitCleanup } from "./middleware/rate-limit";

const port = Number(Bun.env.PORT) || 5000;
const shutdownTimeoutMs = Number(Bun.env.SHUTDOWN_TIMEOUT_MS) || 15000;

logger.info(`Server starting on port ${port}`);

let isShuttingDown = false;

const server = Bun.serve({
  fetch: app.fetch,
  port,
});

/**
 * Graceful shutdown: stop accepting connections, wait for in-flight requests
 */
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.stop();

  // Clean up rate limit timer
  rateLimitCleanup();

  // Wait for in-flight requests to complete
  const deadline = Date.now() + shutdownTimeoutMs;
  let remaining = getInflightRequests();

  while (remaining > 0 && Date.now() < deadline) {
    logger.info(`Waiting for ${remaining} in-flight request(s)...`);
    await new Promise(resolve => setTimeout(resolve, 500));
    remaining = getInflightRequests();
  }

  if (remaining > 0) {
    logger.warn(`Shutdown timeout reached with ${remaining} request(s) still in flight`);
  }
  else {
    logger.info("All in-flight requests completed");
  }

  process.exit(remaining > 0 ? 1 : 0);
}

// Register signal handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default server;
