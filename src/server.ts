import app from "./index";
import logger from "./logger";

const port = Number(Bun.env.PORT) || 5000;

logger.info(`Server starting on port ${port}`);

// Track active connections for graceful shutdown
let isShuttingDown = false;

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.stop();

  // Give active requests 10 seconds to complete
  const shutdownTimeout = setTimeout(() => {
    logger.warn("Shutdown timeout reached, forcing exit");
    process.exit(1);
  }, 10000);

  // Wait a bit for active requests to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  clearTimeout(shutdownTimeout);
  logger.info("Graceful shutdown completed");
  process.exit(0);
}

// Register signal handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default server;
