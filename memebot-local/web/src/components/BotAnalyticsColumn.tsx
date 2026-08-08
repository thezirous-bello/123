import { useEffect, useState } from "react";
import { api, type SystemStats } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Donut } from "./Donut.js";

export interface PnlStats {
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  totalVolumeUsd: number;
  avgRoiPct: number | null;
}

/** Left analytics column: real win/loss donut + performance stats for the
 * active bot, plus real host system load (same numbers SystemMonitorBar
 * already shows elsewhere) — no fabricated model/confidence stats. */
export function BotAnalyticsColumn({ stats }: { stats: PnlStats }) {
  const tick = useRefreshSignal();
  const [sys, setSys] = useState<SystemStats | null>(null);

  useEffect(() => {
    api.systemStats().then(setSys).catch(() => {});
  }, [tick]);

  const winRate = stats.winRate;

  return (
    <div className="space-y-4">
      <Panel title="Performance">
        <div className="flex justify-center">
          <Donut
            size={124}
            centerValue={winRate == null ? "—" : `${winRate.toFixed(0)}%`}
            centerLabel="WIN RATE"
            segments={[
              { label: "Wins", value: stats.wins, color: "#00FFC8" },
              { label: "Losses", value: stats.losses, color: "#FF3B5C" },
            ]}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-[11px]">
          <Stat label="Closed Trades" value={String(stats.closedTrades)} />
          <Stat label="Winning" value={String(stats.wins)} tone="good" />
          <Stat label="Losing" value={String(stats.losses)} tone="bad" />
          <Stat label="Avg ROI" value={stats.avgRoiPct == null ? "—" : `${stats.avgRoiPct >= 0 ? "+" : ""}${stats.avgRoiPct.toFixed(1)}%`} tone={stats.avgRoiPct != null && stats.avgRoiPct >= 0 ? "good" : "bad"} />
          <div className="col-span-2">
            <Stat label="Total Volume" value={`$${stats.totalVolumeUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
          </div>
        </div>
      </Panel>

      <Panel title="System Load">
        {!sys ? (
          <p className="font-mono text-xs text-white/30">Loading…</p>
        ) : (
          <div className="space-y-2 font-mono text-[11px]">
            <LoadBar label="CPU" pct={sys.cpuPercent} />
            <LoadBar label="RAM" pct={(sys.memUsedMb / Math.max(1, sys.memTotalMb)) * 100} suffix={`${sys.memUsedMb}MB`} />
            <div className="flex items-center justify-between text-white/50">
              <span>UPTIME</span>
              <span className="text-white/70">{Math.floor(sys.uptimeSeconds / 3600)}h {Math.floor((sys.uptimeSeconds % 3600) / 60)}m</span>
            </div>
            <div className="flex items-center justify-between text-white/50">
              <span>REQ/MIN</span>
              <span className="text-[#00E5FF]">{sys.requestsPerMin}</span>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-[#4DFFD6]" : tone === "bad" ? "text-red-400" : "text-white/80";
  return (
    <div>
      <p className="uppercase tracking-wide text-white/35">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function LoadBar({ label, pct, suffix }: { label: string; pct: number; suffix?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = clamped > 85 ? "#FF3B5C" : clamped > 60 ? "#FFB020" : "#00FFC8";
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-white/50">
        <span>{label}</span>
        <span style={{ color }}>{suffix ?? `${clamped.toFixed(0)}%`}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${clamped}%`, background: color }} />
      </div>
    </div>
  );
}
