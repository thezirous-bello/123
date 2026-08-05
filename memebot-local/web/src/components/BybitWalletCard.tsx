import type { BybitMode } from "../api/client.js";
import { Panel } from "./Panel.js";
import { Badge } from "./Badge.js";

export interface BybitWalletLike {
  configured: boolean;
  mode: BybitMode;
  totalEquityUsd: number | null;
  availableBalanceUsd: number | null;
}

/** Prominent real-time balance card, same visual weight as the Solana
 * bot's WalletCard — the small inline text line this used to be was easy
 * to miss. Refreshes on the same tick as the rest of the panel (every bot
 * event, plus a 5s fallback poll), so it tracks real trades as they land. */
export function BybitWalletCard({ botLabel, wallet }: { botLabel: string; wallet: BybitWalletLike | null }) {
  if (!wallet) {
    return (
      <Panel title={`${botLabel} Wallet Balance`}>
        <p className="text-sm text-white/40">Loading…</p>
      </Panel>
    );
  }

  return (
    <Panel
      title={`${botLabel} Wallet Balance`}
      action={<Badge tone={wallet.mode === "live" ? "danger" : "accent"}>{wallet.mode === "live" ? "LIVE (MAINNET)" : "TESTNET"}</Badge>}
    >
      {!wallet.configured ? (
        <p className="text-sm text-white/60">
          No Bybit {wallet.mode} API keys configured. Set <code className="rounded bg-black/40 px-1 py-0.5">BYBIT_{wallet.mode === "testnet" ? "TESTNET_" : ""}API_KEY</code>{" "}
          / <code className="rounded bg-black/40 px-1 py-0.5">_SECRET</code> in .env, then restart.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
            <p className="text-xs uppercase tracking-wide text-white/50">Total equity</p>
            <p className="text-2xl font-bold text-violet-200">{wallet.totalEquityUsd != null ? `$${wallet.totalEquityUsd.toFixed(2)}` : "—"}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-wide text-white/50">Available balance</p>
            <p className="text-2xl font-bold">{wallet.availableBalanceUsd != null ? `$${wallet.availableBalanceUsd.toFixed(2)}` : "—"}</p>
          </div>
        </div>
      )}
      {wallet.mode === "testnet" && wallet.configured && (
        <p className="mt-2 text-xs text-white/30">Testnet balance is fake — get free funds from Bybit's testnet faucet at testnet.bybit.com.</p>
      )}
    </Panel>
  );
}
