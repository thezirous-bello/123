import pino from "pino";

/**
 * Field names that must never appear in logs. Applied both as pino redaction
 * paths and as a scrubbing pass over free-text log messages, since a secret
 * can leak through an interpolated string as easily as through a structured
 * field.
 */
const REDACTED_PATHS = [
  "privateKey",
  "*.privateKey",
  "secretKey",
  "*.secretKey",
  "seedPhrase",
  "*.seedPhrase",
  "apiKey",
  "*.apiKey",
  "ANTHROPIC_API_KEY",
  "HELIUS_API_KEY",
  "BIRDEYE_API_KEY",
  "JUPITER_API_KEY",
  "SOLANA_PRIVATE_KEY",
  "authorization",
  "*.authorization",
];

const SECRET_LIKE_PATTERN = /[1-9A-HJ-NP-Za-km-z]{64,}/g;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: { paths: REDACTED_PATHS, censor: "[REDACTED]" },
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } },
});

/**
 * Extra safety net for the audit/bot-log table (persisted, user-visible in the
 * dashboard), independent of pino's structured redaction: strips anything
 * shaped like a base58 secret key before it is ever written to SQLite.
 */
export function scrubSecrets(message: string): string {
  return message.replace(SECRET_LIKE_PATTERN, "[REDACTED]");
}
