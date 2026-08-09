import { config as loadDotenv } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Resolve the project-root .env regardless of the process's cwd (npm
// workspaces run package scripts with cwd set to the package directory, not
// the repo root, so a bare `dotenv/config` import would miss it).
const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: join(__dirname, "..", "..", ".env") });

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),

  DASHBOARD_USERNAME: z.string().min(1).default("admin"),
  DASHBOARD_PASSWORD: z.string().min(1).default("change-me"),
  SESSION_SECRET: z.string().min(16).default("dev-only-insecure-secret-change-me-before-real-use"),

  DEALBOT_MODE: z.enum(["demo", "production"]).default("demo"),
  SCAN_INTERVAL_MINUTES: z.coerce.number().int().positive().default(10),

  // Publicly reachable base URL for this server, used for the /r/:slug
  // click-tracking redirect embedded in Telegram posts. Without it,
  // clicks can't be tracked (a localhost URL would be dead for anyone
  // clicking from their phone) — posts fall back to the raw affiliate
  // URL instead of a broken redirect link.
  PUBLIC_BASE_URL: z.string().url().optional(),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  DEFAULT_AFFILIATE_TAG: z.string().optional(),
  ADMIN_TELEGRAM_CHAT_ID: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export const isDemoMode = env.DEALBOT_MODE === "demo";
export const isTelegramConfigured = !!env.TELEGRAM_BOT_TOKEN;
