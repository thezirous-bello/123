import type { ServiceNode } from "./NetworkMapPanel.js";

// Shared across all three bots (meme/Solana, Bybit spot, Bybit futures) —
// provider health is tracked globally on the server (one Map<ProviderId,...>,
// not per-bot), so one combined map showing every provider any bot talks to
// is both accurate and simpler than three partial maps. Positions are
// illustrative layout only, not geodata.
export const ALL_BOT_SERVICES: ServiceNode[] = [
  { id: "dexscreener", label: "DEXSCREENER", x: 600, y: 60 },
  { id: "solanaRpc", label: "SOLANA RPC", x: 690, y: 230 },
  { id: "jupiter", label: "JUPITER", x: 600, y: 400 },
  { id: "helius", label: "HELIUS (optional)", x: 350, y: 420 },
  { id: "bybit", label: "BYBIT (spot + futures)", x: 100, y: 340 },
  { id: "fearGreed", label: "FEAR & GREED", x: 100, y: 100 },
];

export const ALL_BOTS_HUB_LABEL = "ALL BOTS (LOCAL)";

export function hintForDownProvider(providerId: string): string | null {
  if (providerId === "solanaRpc") return "try a free Helius RPC URL in .env (SOLANA_RPC_URL) — the public RPC rate-limits easily";
  if (providerId === "bybit") return "check your BYBIT_TESTNET_API_KEY/_SECRET (or BYBIT_API_KEY/_SECRET for live) in .env";
  return null;
}
