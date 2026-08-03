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
  PORT: z.coerce.number().int().positive().default(3000),
  DEFAULT_TRADING_MODE: z.enum(["paper", "live"]).default("paper"),

  SOLANA_RPC_URL: z.string().url().default("https://api.mainnet-beta.solana.com"),
  SOLANA_PRIVATE_KEY: z.string().optional(),

  JUPITER_API_URL: z.string().url().default("https://lite-api.jup.ag/swap/v1"),
  JUPITER_API_KEY: z.string().optional(),

  DEXSCREENER_API_URL: z.string().url().default("https://api.dexscreener.com"),
  HELIUS_API_KEY: z.string().optional(),
  BIRDEYE_API_KEY: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),

  LIVE_TRADING_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .pipe(z.boolean()),
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

/** Whether live (real-money) trading is permitted at all by server configuration. */
export const liveTradingAllowedByConfig = env.LIVE_TRADING_ENABLED === true;
