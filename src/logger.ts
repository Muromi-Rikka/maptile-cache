import { pino } from "pino";

const logger = pino({
  name: "maptile-cache",
  level: Bun.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
      ignore: "pid,hostname",
    },
  },
});

export default logger;
