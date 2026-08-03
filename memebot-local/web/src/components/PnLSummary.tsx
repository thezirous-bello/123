import { useEffect, useState } from "react";
import { api, type Position } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";

export function PnLSummary({ mode }: { mode: "paper" | "live" }) {
  const tick = useRefreshSignal();
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    api.listPositions(mode).then(setPositions).catch(() => {});
  }, [tick, mode]);

  const closed = positions.filter((p) => p.status === "closed");
  const open = positions.filter((p) => p.status === "open");
  const realized = closed.reduce((sum, p) => sum + Number(p.realizedPnlUsd), 0);
  const wins = closed.filter((p) => Number(p.realizedPnlUsd) > 0);
  const losses = closed.filter((p) => Number(p.realizedPnlUsd) < 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : null;
  const avgWinner = wins.length > 0 ? wins.reduce((s, p) => s + Number(p.realizedPnlUsd), 0) / wins.length : 0;
  const avgLoser = losses.length > 0 ? losses.reduce((s, p) => s + Number(p.realizedPnlUsd), 0) / losses.length : 0;
  const grossProfit = wins.reduce((s, p) => s + Number(p.realizedPnlUsd), 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + Number(p.realizedPnlUsd), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;
  const openExposure = open.reduce((s, p) => s + Number(p.costBasisUsd), 0);

  return (
    <Panel title={`Profit & Loss (${mode.toUpperCase()})`}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Realized PnL" value={`$${realized.toFixed(2)}`} tone={realized >= 0 ? "good" : "bad"} />
        <Stat label="Open Exposure" value={`$${openExposure.toFixed(2)}`} />
        <Stat label="Closed Trades" value={String(closed.length)} />
        <Stat label="Win Rate" value={winRate === null ? "—" : `${winRate.toFixed(0)}%`} />
        <Stat label="Avg Winner" value={`$${avgWinner.toFixed(2)}`} tone="good" />
        <Stat label="Avg Loser" value={`$${avgLoser.toFixed(2)}`} tone="bad" />
        <Stat label="Profit Factor" value={profitFactor === null ? "—" : profitFactor.toFixed(2)} />
        <Stat label="Open Positions" value={String(open.length)} />
      </div>
      <p className="mt-3 text-xs text-white/40">
        Historical results shown here — including paper-trading results — do not guarantee future performance. Paper fills are simulated and cannot
        perfectly reproduce real slippage, MEV, or failed transactions.
      </p>
    </Panel>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-white";
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
