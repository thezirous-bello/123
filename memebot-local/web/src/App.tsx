import { useEffect, useState } from "react";
import { api, type BotStatus } from "./api/client.js";
import { useRefreshSignal } from "./hooks/useRefreshSignal.js";
import { StatusBar } from "./components/StatusBar.js";
import { WalletCard } from "./components/WalletCard.js";
import { StrategyPanel } from "./components/StrategyPanel.js";
import { TokenScanner } from "./components/TokenScanner.js";
import { PositionsTable } from "./components/PositionsTable.js";
import { TradeHistory } from "./components/TradeHistory.js";
import { PnLSummary } from "./components/PnLSummary.js";
import { RiskSettings } from "./components/RiskSettings.js";
import { LogsPanel } from "./components/LogsPanel.js";
import { LiveFeed } from "./components/LiveFeed.js";
import { FuturesPanel } from "./components/FuturesPanel.js";

const TABS = ["Dashboard", "Live", "Strategy", "Scanner", "Positions", "History", "Risk", "Logs"] as const;
type Tab = (typeof TABS)[number];
type BotKind = "meme" | "futures";

export default function App() {
  const tick = useRefreshSignal();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [botKind, setBotKind] = useState<BotKind>("meme");

  useEffect(() => {
    api.status().then(setStatus).catch(() => {});
  }, [tick]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Meme<span className="text-violet-400">Bot</span> Local
          </h1>
          <p className="text-xs text-white/40">Local Solana meme-coin trading bot — runs only on this machine.</p>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === t ? "bg-violet-600 text-white" : "text-white/60 hover:bg-white/10"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <div className="mb-6">
        <StatusBar status={status} onChanged={() => api.status().then(setStatus)} />
      </div>

      {tab === "Dashboard" && status && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <WalletCard mode={status.mode} />
          <PnLSummary mode={status.mode} />
          <div className="lg:col-span-2">
            <PositionsTable statusFilter="open" />
          </div>
        </div>
      )}

      {tab === "Live" && (
        <div className="space-y-4">
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1 w-fit">
            {(["meme", "futures"] as const).map((kind) => (
              <button
                key={kind}
                onClick={() => setBotKind(kind)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  botKind === kind ? "bg-violet-600 text-white" : "text-white/60 hover:bg-white/10"
                }`}
              >
                {kind === "meme" ? "Meme Coins (Solana)" : "Bybit Futures"}
              </button>
            ))}
          </div>
          {botKind === "meme" ? <LiveFeed running={status?.running ?? false} mode={status?.mode ?? "paper"} /> : <FuturesPanel />}
        </div>
      )}
      {tab === "Strategy" && <StrategyPanel />}
      {tab === "Scanner" && <TokenScanner />}
      {tab === "Positions" && (
        <div className="space-y-4">
          <PositionsTable statusFilter="open" />
          <PositionsTable statusFilter="closed" />
        </div>
      )}
      {tab === "History" && <TradeHistory />}
      {tab === "Risk" && <RiskSettings />}
      {tab === "Logs" && <LogsPanel />}

      <footer className="mt-10 space-y-1 border-t border-white/10 pt-4 text-xs text-white/30">
        <p>
          Risk disclosure: meme coins can lose all value; liquidity can disappear; token checks can miss malicious behavior; stops may execute below
          their intended price; transactions can fail; network congestion and MEV can affect execution. Nothing in this app is financial advice, and
          nothing here is guaranteed.
        </p>
      </footer>
    </div>
  );
}
