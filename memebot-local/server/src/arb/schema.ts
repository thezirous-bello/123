import { z } from "zod";
import type { ExchangeId } from "./exchanges/index.js";
import { ALL_EXCHANGE_IDS } from "./exchanges/index.js";

// Cross-exchange arbitrage, paper-only. Watches best bid/ask for the same
// coin across several exchanges; when the highest bid on one exchange beats
// the lowest ask on another by more than the estimated round-trip fee (plus
// a safety buffer), it simulates buying on the cheap one and selling on the
// expensive one. See arb/controller.ts for why this stays paper-only rather
// than wiring up real cross-exchange execution.
const ExchangeIdSchema = z.enum(ALL_EXCHANGE_IDS as [ExchangeId, ...ExchangeId[]]);

export const ArbStrategyConfigObjectSchema = z
  .object({
    enabled: z.boolean().default(false),

    exchanges: z.array(ExchangeIdSchema).min(2).default(["binance", "bybit", "okx", "kucoin", "gateio", "mexc"]),
    // ~100 of the most liquid coins, cross-listed with USDT pairs on
    // essentially every exchange above — a symbol missing on a given
    // exchange just doesn't get a quote there for that scan (see
    // findBestOpportunity), so this list can safely run wider than any one
    // exchange's actual overlap. Every extra symbol here costs nothing
    // extra network-wise: each exchange's adapter is one "all tickers" call
    // regardless of how many symbols this list has, only the in-memory
    // Map lookups scale with it.
    symbols: z
      .array(z.string())
      .min(1)
      .default([
        "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "DOT",
        "LTC", "BCH", "TRX", "MATIC", "UNI", "ATOM", "NEAR", "APT", "ARB", "OP",
        "ICP", "FIL", "ETC", "XLM", "HBAR", "VET", "ALGO", "AAVE", "MKR", "GRT",
        "SAND", "MANA", "AXS", "EOS", "XTZ", "THETA", "FTM", "EGLD", "FLOW", "CHZ",
        "KAVA", "ZEC", "DASH", "COMP", "SNX", "CRV", "YFI", "ENJ", "BAT", "ZIL",
        "ONE", "IOTA", "NEO", "WAVES", "QTUM", "OMG", "ANKR", "CELO", "ROSE", "RUNE",
        "INJ", "DYDX", "GMX", "LDO", "RPL", "FXS", "PEPE", "SHIB", "WIF", "BONK",
        "FLOKI", "SUI", "SEI", "TIA", "JTO", "JUP", "PYTH", "STRK", "W", "ENA",
        "ONDO", "ORDI", "TAO", "RENDER", "FET", "AGIX", "OCEAN", "IMX", "GALA", "MASK",
        "LRC", "1INCH", "SUSHI", "BAL", "KSM", "ZRX", "STORJ", "SKL", "CTSI", "BNT",
      ]),

    scanIntervalSeconds: z.number().gt(0).default(10),
    positionSizeUsd: z.number().gt(0).default(500),
    maxTradesPerScan: z.number().int().gt(0).default(3),
    perSymbolCooldownSeconds: z.number().gte(0).default(30), // don't re-trade the same symbol every single scan tick

    // Net spread = gross spread - (buy fee + sell fee) - safetyBufferPct.
    // A trade only simulates when net spread is still positive after all of
    // that — otherwise it's just logged as a skipped/observed opportunity.
    takerFeePctOverride: z.number().gte(0).nullable().default(null), // null -> use each exchange's own defaultTakerFeePct
    safetyBufferPct: z.number().gte(0).default(0.05),
    minNetSpreadPct: z.number().gte(0).default(0.02),

    startingBalanceUsd: z.number().gt(0).default(10_000),
  })
  .strict();

export const ArbStrategyConfigSchema = ArbStrategyConfigObjectSchema.superRefine((cfg, ctx) => {
  if (new Set(cfg.exchanges).size !== cfg.exchanges.length) {
    ctx.addIssue({ code: "custom", path: ["exchanges"], message: "exchanges cannot contain duplicates." });
  }
  if (new Set(cfg.symbols.map((s) => s.toUpperCase())).size !== cfg.symbols.length) {
    ctx.addIssue({ code: "custom", path: ["symbols"], message: "symbols cannot contain duplicates." });
  }
});

export type ArbStrategyConfig = z.infer<typeof ArbStrategyConfigSchema>;
