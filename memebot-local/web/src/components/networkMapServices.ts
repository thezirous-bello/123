import type { ServiceNode } from "./NetworkMapPanel.js";

// Shared across all four bots (meme/Solana, Bybit spot, Bybit futures,
// cross-exchange arbitrage) — provider health is tracked globally on the
// server (one Map<ProviderId,...>, not per-bot), so one combined map
// showing every provider any bot talks to is both accurate and simpler
// than four partial maps. Positions are illustrative layout only, not
// geodata.
export const ALL_BOT_SERVICES: ServiceNode[] = [
  { id: "dexscreener", label: "DEXSCREENER", x: 600, y: 60 },
  { id: "solanaRpc", label: "SOLANA RPC", x: 690, y: 230 },
  { id: "jupiter", label: "JUPITER", x: 600, y: 400 },
  { id: "jupiterPrice", label: "JUPITER PRICE", x: 630, y: 480 },
  { id: "birdeye", label: "BIRDEYE (optional)", x: 250, y: 480 },
  { id: "helius", label: "HELIUS (optional)", x: 350, y: 420 },
  { id: "bybit", label: "BYBIT", x: 100, y: 340 },
  { id: "fearGreed", label: "FEAR & GREED", x: 100, y: 100 },
  { id: "binance", label: "BINANCE", x: 450, y: 60 },
  { id: "okx", label: "OKX", x: 230, y: 190 },
  { id: "kucoin", label: "KUCOIN", x: 480, y: 340 },
  { id: "gateio", label: "GATE.IO", x: 620, y: 170 },
  { id: "mexc", label: "MEXC", x: 300, y: 320 },
  { id: "kraken", label: "KRAKEN", x: 700, y: 300 },
  { id: "bitstamp", label: "BITSTAMP", x: 150, y: 400 },
  { id: "coingecko", label: "COINGECKO", x: 400, y: 50 },
];

export const ALL_BOTS_HUB_LABEL = "ALL BOTS (LOCAL)";

// The arbitrage bot's own map — the eight exchanges it actually compares
// prices across, plus CoinGecko for cross-exchange coin-identity
// verification, laid out around the local hub.
export const ARB_BOT_SERVICES: ServiceNode[] = [
  { id: "binance", label: "BINANCE", x: 550, y: 230 },
  { id: "okx", label: "OKX", x: 450, y: 57 },
  { id: "kucoin", label: "KUCOIN", x: 250, y: 57 },
  { id: "bybit", label: "BYBIT", x: 150, y: 230 },
  { id: "gateio", label: "GATE.IO", x: 250, y: 403 },
  { id: "mexc", label: "MEXC", x: 450, y: 403 },
  { id: "kraken", label: "KRAKEN", x: 620, y: 340 },
  { id: "bitstamp", label: "BITSTAMP", x: 80, y: 340 },
  { id: "coingecko", label: "COINGECKO (identity)", x: 350, y: 470 },
];

export const ARB_BOT_HUB_LABEL = "ARBITRAGE SCANNER (LOCAL)";

export function hintForDownProvider(providerId: string): string | null {
  if (providerId === "solanaRpc") return "try a free Helius RPC URL in .env (SOLANA_RPC_URL) — the public RPC rate-limits easily";
  if (providerId === "bybit") return "check your BYBIT_TESTNET_API_KEY/_SECRET (or BYBIT_API_KEY/_SECRET for live) in .env";
  return null;
}
