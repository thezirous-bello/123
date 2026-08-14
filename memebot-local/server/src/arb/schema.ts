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

// ~500 real coin tickers spanning majors, L1/L2s, DeFi, oracles/infra,
// gaming/metaverse, AI/DePIN, meme, exchange tokens, privacy, RWA/payments,
// staking derivatives, and several exchange-specific ecosystems (Cosmos,
// Polkadot, BSC, Solana) — deduplicated (case-insensitive) at build time, see
// the superRefine check below which would otherwise reject a duplicate. A
// symbol missing on a given exchange just doesn't get a quote there for that
// scan (see findBestOpportunity), so this list can safely run far wider than
// any one exchange's actual overlap — the point is maximum coverage of
// cross-listed pairs, not that every symbol here trades everywhere. Every
// extra symbol costs nothing extra network-wise: each exchange's adapter is
// one "all tickers" call regardless of list size, only the in-memory Map
// lookups scale with it.
export const DEFAULT_ARB_SYMBOLS: string[] = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "DOT",
  "LTC", "BCH", "TRX", "MATIC", "POL", "UNI", "ATOM", "APT", "ARB", "OP",
  "ICP", "FIL", "ETC", "XLM", "HBAR", "VET", "ALGO", "AAVE", "MKR", "GRT",
  "NEAR", "SUI", "SEI", "TIA", "INJ", "KAS", "TON", "EGLD", "FLOW", "ZIL",
  "ONE", "NEO", "WAVES", "QTUM", "IOTA", "XTZ", "EOS", "ROSE", "CELO", "KAVA",
  "FTM", "S", "STRK", "ZK", "MANTA", "METIS", "BLAST", "MODE", "SCRT", "CANTO",
  "KDA", "ELF", "ONT", "ICX", "ZRX", "LSK", "ARDR", "STEEM", "SC", "DGB",
  "RVN", "NANO", "XEM", "BTS", "STRAX", "ARK", "SYS", "NULS", "WAN", "SXP",
  "CRV", "SNX", "COMP", "YFI", "SUSHI", "BAL", "1INCH", "LDO", "RPL", "FXS",
  "GMX", "DYDX", "CVX", "PENDLE", "RDNT", "JOE", "SPELL", "ALPHA", "BADGER", "RUNE",
  "OSMO", "PERP", "DODO", "BNT", "KNC", "REN", "STG", "GNS", "GAINS", "VELO",
  "AERO", "RAY", "ORCA", "JTO", "JUP", "PYTH", "DRIFT", "MNGO", "SRM", "CAKE",
  "BAKE", "BURGER", "AUTO", "BEL", "LINA", "TWT", "XVS", "ALPACA", "MDX", "API3",
  "BAND", "TRB", "UMA", "DIA", "FLUX", "ANKR", "RENDER", "AR", "STORJ", "OCEAN",
  "FET", "AGIX", "NMR", "CTXC", "AKT", "GLM", "HNT", "IOTX", "MOBILE", "IOT",
  "RSS3", "POKT", "THETA", "TFUEL", "LPT", "STX", "SAND", "MANA", "AXS", "GALA",
  "IMX", "ENJ", "CHZ", "ILV", "YGG", "GHST", "ALICE", "TLM", "SLP", "PYR",
  "UOS", "REVV", "SUPER", "VOXEL", "MAGIC", "GODS", "PRIME", "BIGTIME", "PIXEL", "PORTAL",
  "XAI", "NAKA", "ACE", "BEAM", "RON", "MAVIA", "TAO", "NFP", "AI", "ARKM",
  "WLD", "GRASS", "IO", "PROMPT", "AIOZ", "NOS", "PHB", "SHIB", "PEPE", "WIF",
  "BONK", "FLOKI", "BOME", "MEME", "MEW", "POPCAT", "BRETT", "TURBO", "MOG", "NEIRO",
  "PNUT", "GOAT", "ACT", "MOODENG", "CHILLGUY", "AI16Z", "PENGU", "SPX", "FARTCOIN", "GIGA",
  "BABYDOGE", "ELON", "SAMO", "MYRO", "WOJAK", "LADYS", "OKB", "HT", "KCS", "GT",
  "MX", "LEO", "CRO", "FTT", "WOO", "BGB", "BMX", "COIN", "NEXO", "CEL",
  "XMR", "ZEC", "DASH", "GRIN", "ARRR", "FIRO", "XVG", "ONDO", "XDC", "RIO",
  "POLYX", "TRU", "CFG", "MPL", "GFI", "PAXG", "XAUT", "QNT", "RLC", "ANT",
  "REQ", "UTK", "DUSK", "SD", "PSTAKE", "STMATIC", "SWETH", "ETHFI", "RETH", "BSV",
  "DCR", "ZEN", "KMD", "PIVX", "NAV", "VTC", "GRS", "BTG", "W", "ENA",
  "REZ", "OMNI", "SAGA", "TNSR", "ZRO", "DYM", "ALT", "AEVO", "MERL", "BB",
  "NOT", "CATI", "HMSTR", "DOGS", "PONKE", "SLERF", "ZEUS", "PARCL", "SANTOS", "PORTO",
  "LAZIO", "USUAL", "ME", "MORPHO", "SYRUP", "SCR", "ORDI", "SATS", "1000SATS", "RATS",
  "CKB", "TAIKO", "SAFE", "PARTI", "BIO", "COOKIE", "KAITO", "HOT", "WAXP", "TLOS",
  "HIVE", "CTC", "MTL", "POWR", "AGLD", "HIGH", "RARE", "LOOKS", "BLUR", "X2Y2",
  "SUDO", "NFTX", "WHALE", "DAR", "MOVR", "GLMR", "ASTR", "ACA", "KAR", "PHA",
  "CFX", "KLAY", "XPRT", "JASMY", "CVC", "OXT", "POLY", "FUN", "DENT", "WIN",
  "BTT", "SUN", "NFT", "JST", "REEF", "COTI", "CELR", "OGN", "SKL", "JUNO",
  "REGEN", "STARS", "CRE", "DVPN", "IRIS", "SOMM", "UMEE", "KUJI", "GRAV", "AXL",
  "STRD", "CMDX", "PARA", "EFI", "INTR", "BNC", "KILT", "UNQ", "RING", "PDEX",
  "CRU", "AIR", "MGX", "SFP", "TKO", "FRONT", "ALPINE", "CITY", "PSG", "JUV",
  "STEP", "MEDIA", "PORT", "COPE", "SLND", "TULIP", "SUNNY", "SBR", "ATLAS", "POLIS",
  "WOOF", "GENE", "GST", "GMT", "SHDW", "HONEY", "PRISM", "MANEKI", "RETARDIO", "GRIFFAIN",
  "ZEREBRO", "BAR", "ATM", "ASR", "ACM", "POLYS", "AZUR", "OG", "SOCIOS", "CORE",
  "AVAIL", "FUEL", "SOON", "MOVE", "INIT", "HYPE", "PUMP", "BOOK", "HARAMBE", "MICHI",
  "CAT", "SUNDOG", "DOG", "TOSHI", "DEGEN", "HIGHER", "NORMIE", "KEYCAT", "APU", "PEIPEI",
  "PEEZY", "SIGMA", "GIGACHAD", "RADIANT", "SILO", "EULER", "IPOR", "TERM", "NOTIONAL", "FLUID",
  "CLEARPOOL", "MAPLE", "GOLDFINCH", "CENTRIFUGE", "TRUEFI", "IOST", "WAX", "TOMO", "STMX", "CTSI",
  "MASK", "LRC", "ENS", "APE", "LOOM", "STPT", "PERL", "ORN", "FOR", "VITE",
  "MTA", "MITH", "KEY", "WING", "TCT", "DATA", "MDT", "AUCTION", "IDEX", "DEXE",
  "PROS", "TVK", "ERN", "PUNDIX", "BOND", "FIDA", "MLN", "NKN", "OAX", "PNT",
  "QUICK", "RAD", "TORN", "UFT", "VGX", "WNXM", "XNO", "ZKS", "ARPA", "BLZ",
  "CTK", "DEGO", "EPX",
];

export const ArbStrategyConfigObjectSchema = z
  .object({
    enabled: z.boolean().default(false),

    exchanges: z.array(ExchangeIdSchema).min(2).default(["binance", "bybit", "okx", "kucoin", "gateio", "mexc", "kraken", "bitstamp"]),
    symbols: z.array(z.string()).min(1).default(DEFAULT_ARB_SYMBOLS),

    scanIntervalSeconds: z.number().gt(0).default(10),
    positionSizeUsd: z.number().gt(0).default(500),
    maxTradesPerScan: z.number().int().gt(0).default(3),
    perSymbolCooldownSeconds: z.number().gte(0).default(30), // don't re-trade the same symbol every single scan tick

    // Net spread = gross spread - (buy fee + sell fee) - safetyBufferPct.
    // A trade only simulates when net spread is still positive after all of
    // that — otherwise it's just logged as a skipped/observed opportunity.
    takerFeePctOverride: z.number().gte(0).nullable().default(null), // null -> use each exchange's own defaultTakerFeePct
    safetyBufferPct: z.number().gte(0).default(0.05),
    // Must clear >1% net (after fees + buffer) to qualify as a real trade,
    // not just a fee-eating rounding blip.
    minNetSpreadPct: z.number().gte(0).default(1),

    // ---- Sequential capital-moving simulation (buy -> withdraw -> sell ->
    // chain-or-return-home) — see arb/journeyEngine.ts for the state machine.
    // None of this is a real transfer time/fee table (this app has no way to
    // know that per-asset/per-network without a live account), so these are
    // deliberately simple, clearly-labeled estimates, configurable rather
    // than hardcoded.
    simulatedWithdrawalFeeUsd: z.number().gte(0).default(2),
    simulatedTransferMinutes: z.number().gt(0).default(5),
    // How long, after landing with cash on the sell exchange, to keep
    // checking for a fresh opportunity to chain into before giving up and
    // wiring principal + profit back to the exchange this journey started on.
    reverseCheckWindowSeconds: z.number().gt(0).default(30),
    // Safety cap on capital-at-risk: how many journeys can be in flight
    // (bought but not yet fully returned home) at once.
    maxConcurrentJourneys: z.number().int().gt(0).default(5),
    // Both gates default ON — this is the direct fix for "traded a same-
    // symbol-different-coin" and "bought into a platform where deposits
    // were blocked." Turning either off is a deliberate, explicit opt-out,
    // not the default.
    requireCoinIdentityVerified: z.boolean().default(true),
    requireDepositVerified: z.boolean().default(true),

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
