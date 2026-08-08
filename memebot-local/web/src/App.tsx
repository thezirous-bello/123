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
import { SpotPanel } from "./components/SpotPanel.js";
import { FuturesPanel } from "./components/FuturesPanel.js";
import { ArbitragePanel } from "./components/ArbitragePanel.js";
import { AllBotsBalances } from "./components/AllBotsBalances.js";
import { CommandBar } from "./components/CommandBar.js";

const TABS = ["Dashboard", "Live", "Strategy", "Scanner", "Positions", "History", "Risk", "Logs"] as const;
type Tab = (typeof TABS)[number];
type BotKind = "meme" | "spot" | "futures" | "arb";

const BOT_KIND_LABELS: Record<BotKind, string> = {
  meme: "Meme Coins (Solana)",
  spot: "Bybit Spot",
  futures: "Bybit Futures",
  arb: "Arbitrage",
};

export default function App() {
  const tick = useRefreshSignal();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [botKind, setBotKind] = useState<BotKind>("meme");

  useEffect(() => {
    api.status().then(setStatus).catch(() => {});
  }, [tick]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight text-white/90">
            MEME<span className="text-[#FF2D9B]" style={{ textShadow: "0 0 10px rgba(255,45,155,0.5)" }}>BOT</span> <span className="text-white/30">LOCAL</span>
          </h1>
          <p className="text-xs text-white/40">Local Solana meme-coin trading bot — runs only on this machine.</p>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-sm border border-[#1b2530] bg-[#0B1017]/80 p-1 font-mono">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-sm px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition ${
                tab === t ? "bg-[#FF2D9B]/15 text-[#FF2D9B] shadow-[inset_0_0_0_1px_rgba(255,45,155,0.4)]" : "text-white/50 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <CommandBar running={status?.running ?? false} />

      <div className="mb-6">
        <StatusBar status={status} onChanged={() => api.status().then(setStatus)} />
      </div>

      {tab === "Dashboard" && status && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <AllBotsBalances />
          </div>
          <WalletCard mode={status.mode} />
          <PnLSummary mode={status.mode} />
          <div className="lg:col-span-2">
            <PositionsTable statusFilter="open" />
          </div>
        </div>
      )}

      {tab === "Live" && (
        <div className="space-y-4">
          <div className="flex w-fit items-center gap-1 rounded-sm border border-[#1b2530] bg-[#0B1017]/80 p-1 font-mono">
            {(["meme", "spot", "futures", "arb"] as const).map((kind) => (
              <button
                key={kind}
                onClick={() => setBotKind(kind)}
                className={`rounded-sm px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition ${
                  botKind === kind ? "bg-[#00E5FF]/15 text-[#00E5FF] shadow-[inset_0_0_0_1px_rgba(0,229,255,0.4)]" : "text-white/50 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                {BOT_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
          {botKind === "meme" && <LiveFeed running={status?.running ?? false} mode={status?.mode ?? "paper"} />}
          {botKind === "spot" && <SpotPanel />}
          {botKind === "futures" && <FuturesPanel />}
          {botKind === "arb" && <ArbitragePanel />}
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
