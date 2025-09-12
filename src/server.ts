import app from "./index";
import logger from "./logger";

const port = 5000;

logger.info(`Server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
