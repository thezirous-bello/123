import { useEffect, useState } from "react";
import { api, type EquityPoint } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Sparkline } from "./Sparkline.js";

export function PortfolioOverview({ mode }: { mode: "paper" | "live" }) {
  const tick = useRefreshSignal();
  const [curve, setCurve] = useState<EquityPoint[]>([]);

  useEffect(() => {
    api.equityCurve(24).then(setCurve).catch(() => {});
  }, [tick]);

  const current = curve[curve.length - 1]?.balance ?? null;
  const start = curve[0]?.balance ?? null;
  const change = current !== null && start !== null ? current - start : null;
  const changePct = current !== null && start !== null && start !== 0 ? (change! / start) * 100 : null;
  const positive = (change ?? 0) >= 0;

  return (
    <Panel title="Portfolio Overview">
      {mode === "live" && (
        <p className="mb-2 text-[11px] text-amber-300/80">
          Equity curve tracks the PAPER account. Live-mode equity depends on unsold token value too, which this simple curve doesn't reconstruct.
        </p>
      )}
      <p className="text-xs uppercase tracking-wide text-white/40">
        {mode === "paper" ? "Paper" : "Live"} Balance {mode === "live" && "(cash side only)"}
      </p>
      <p className="text-4xl font-bold tracking-tight text-glow-green text-[#4DFFD6]">
        {current !== null ? `$${current.toFixed(2)}` : "—"}
      </p>
      {change !== null && changePct !== null && (
        <p className={`mt-1 text-sm font-semibold ${positive ? "text-emerald-400" : "text-red-400"}`}>
          {positive ? "+" : ""}
          {change.toFixed(2)} ({positive ? "+" : ""}
          {changePct.toFixed(2)}%) / 24h
        </p>
      )}
      <div className="mt-3">
        <Sparkline values={curve.map((p) => p.balance)} color={positive ? "#00FFC8" : "#FF3B5C"} width={280} height={64} />
      </div>
      {curve.length <= 1 && <p className="mt-2 text-xs text-white/30">No trades in the last 24h yet — curve will fill in as the bot trades.</p>}
    </Panel>
  );
}
