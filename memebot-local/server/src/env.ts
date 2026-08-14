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

  // Bybit bots (spot + futures) — completely separate credentials/wallet
  // from the Solana meme-coin bot above. The same Bybit API keys are shared
  // between the spot and futures bots (one Bybit account, one UNIFIED
  // wallet), but each bot has its own independent live-trading gate:
  // testnet keys are used by default, mainnet keys are only ever touched
  // when that bot's own *_LIVE_TRADING_ENABLED=true AND the dashboard sends
  // an explicit confirmation, mirroring LIVE_TRADING_ENABLED above.
  BYBIT_TESTNET_API_KEY: z.string().optional(),
  BYBIT_TESTNET_API_SECRET: z.string().optional(),
  BYBIT_API_KEY: z.string().optional(),
  BYBIT_API_SECRET: z.string().optional(),
  SPOT_LIVE_TRADING_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .pipe(z.boolean()),
  FUTURES_LIVE_TRADING_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .pipe(z.boolean()),

  // Arbitrage bot exchange credentials — READ-ONLY keys only (no trade, no
  // withdrawal permission needed or wanted). Used exclusively for two
  // read-only checks: (1) is deposit currently enabled for a given coin on
  // this exchange, so the bot never buys into a dead end it can't move out
  // of, and (2) this exchange's real account balance, so the bot can warn
  // about (and never spend) funds it didn't itself move there. The arb bot
  // never places a real order or withdrawal on any of these — all trade
  // execution stays paper/simulated. Bybit reuses BYBIT_API_KEY/_SECRET
  // above rather than a separate pair. Every one of these is optional; an
  // exchange with no key configured just can't have its deposit-status
  // verified, which (per the arb strategy's identity/deposit gates) means
  // the bot won't complete a trade landing on it.
  BINANCE_API_KEY: z.string().optional(),
  BINANCE_API_SECRET: z.string().optional(),
  OKX_API_KEY: z.string().optional(),
  OKX_API_SECRET: z.string().optional(),
  OKX_API_PASSPHRASE: z.string().optional(),
  KUCOIN_API_KEY: z.string().optional(),
  KUCOIN_API_SECRET: z.string().optional(),
  KUCOIN_API_PASSPHRASE: z.string().optional(),
  GATEIO_API_KEY: z.string().optional(),
  GATEIO_API_SECRET: z.string().optional(),
  MEXC_API_KEY: z.string().optional(),
  MEXC_API_SECRET: z.string().optional(),
  KRAKEN_API_KEY: z.string().optional(),
  KRAKEN_API_SECRET: z.string().optional(),
  BITSTAMP_API_KEY: z.string().optional(),
  BITSTAMP_API_SECRET: z.string().optional(),
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

/** Whether live (mainnet, real-money) Bybit spot trading is permitted at all by server configuration. */
export const spotLiveTradingAllowedByConfig = env.SPOT_LIVE_TRADING_ENABLED === true;

/** Whether live (mainnet, real-money) Bybit futures trading is permitted at all by server configuration. */
export const futuresLiveTradingAllowedByConfig = env.FUTURES_LIVE_TRADING_ENABLED === true;
