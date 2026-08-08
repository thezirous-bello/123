import { useEffect, useState } from "react";
import { api, type PaperAccountInfo, type WalletInfo } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";

export function WalletCard({ mode }: { mode: "paper" | "live" }) {
  const tick = useRefreshSignal();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [paperAccount, setPaperAccount] = useState<PaperAccountInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.wallet().then(setWallet).catch(() => {});
    api.paperAccount().then(setPaperAccount).catch(() => {});
  }, [tick]);

  function copyAddress() {
    if (!wallet?.address) return;
    navigator.clipboard.writeText(wallet.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Panel title="Wallet Balance">
      {mode === "paper" && paperAccount && (
        <div className="mb-4 rounded-sm border border-violet-500/20 bg-violet-500/5 p-3">
          <p className="text-xs uppercase tracking-wide text-white/50">Paper cash balance</p>
          <p className="text-2xl font-bold text-violet-200">${Number(paperAccount.cashBalanceUsd).toFixed(2)}</p>
          <p className="text-xs text-white/40">Started at ${Number(paperAccount.startingBalanceUsd).toFixed(2)} (virtual, no real funds)</p>
        </div>
      )}

      {!wallet?.configured ? (
        <p className="text-sm text-white/60">
          No dedicated trading wallet configured. Run <code className="rounded bg-black/40 px-1 py-0.5">npm run wallet:generate -w server</code> in
          your terminal, or set <code className="rounded bg-black/40 px-1 py-0.5">SOLANA_PRIVATE_KEY</code> in .env, then restart.
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">Trading wallet address</p>
            <div className="flex items-center gap-2">
              <code className="truncate text-sm text-white/80">{wallet.address}</code>
              <button onClick={copyAddress} className="rounded border border-white/15 px-2 py-0.5 text-xs hover:bg-white/10">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">SOL balance</p>
            <p className="text-xl font-bold">{wallet.solBalance ? Number(wallet.solBalance).toFixed(4) : "0"} SOL</p>
          </div>
          {wallet.tokenBalances.length > 0 && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-white/50">Token balances</p>
              <ul className="space-y-1 text-sm text-white/70">
                {wallet.tokenBalances.map((t) => (
                  <li key={t.mint} className="flex justify-between">
                    <span className="truncate font-mono text-xs">{t.mint.slice(0, 4)}…{t.mint.slice(-4)}</span>
                    <span>{Number(t.uiAmount).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-amber-300/80">Only fund this wallet with money you can afford to lose.</p>
        </div>
      )}
    </Panel>
  );
}
