import pino from "pino";

const REDACTED_PATHS = [
  "apiKey",
  "*.apiKey",
  "token",
  "*.token",
  "TELEGRAM_BOT_TOKEN",
  "SESSION_SECRET",
  "DASHBOARD_PASSWORD",
  "authorization",
  "*.authorization",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: { paths: REDACTED_PATHS, censor: "[REDACTED]" },
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } },
});
