import { pino } from "pino";

const logger = pino({
  level: Bun.env.LOG_LEVEL || "info",
  name: "maptile-cache",
  transport: {
    options: {
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
    },
    target: "pino-pretty",
  },
});

export default logger;
