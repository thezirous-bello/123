import { useEffect, useState } from "react";
import { api, type ProviderHealth } from "../api/client.js";
import { useBotEvent, useRefreshSignal } from "../hooks/useRefreshSignal.js";

/** Aggregated real stats across every provider this app talks to (Solana
 * RPC, Jupiter, Helius, Dexscreener, Bybit, exchanges, ...) — same
 * ProviderHealth rows the NetworkMapPanel instances render per-bot, just
 * summed across all of them for a single always-visible strip. No data
 * here is synthetic: it's a reduce over /api/providers/status plus the
 * live provider_health_changed stream. */
export function CommandBar({ running }: { running: boolean }) {
  const tick = useRefreshSignal();
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({});
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    api
      .providerStatus()
      .then((rows) => setHealth(Object.fromEntries(rows.map((r) => [r.provider, r]))))
      .catch(() => {});
  }, [tick]);

  useBotEvent<ProviderHealth>("provider_health_changed", (entry) => {
    setHealth((prev) => ({ ...prev, [entry.provider]: entry }));
  });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const rows = Object.values(health);
  const totalCalls = rows.reduce((s, r) => s + r.totalCalls, 0);
  const totalFailures = rows.reduce((s, r) => s + r.totalFailures, 0);
  const active = rows.filter((r) => r.totalCalls > 0 && r.consecutiveFailures === 0).length;
  const successRate = totalCalls > 0 ? (((totalCalls - totalFailures) / totalCalls) * 100).toFixed(1) : "—";
  const time = now.toLocaleTimeString("en-US", { hour12: false });

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-sm border border-[#1b2530] bg-[#0B1017]/90 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-white/50">
      <div className="flex items-center gap-2">
        <span className="font-bold text-white/80">Meme&#8203;Bot Core</span>
        <span className={`flex items-center gap-1.5 ${running ? "text-[#00FFC8]" : "text-white/30"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${running ? "animate-node-idle bg-[#00FFC8]" : "bg-white/30"}`} style={running ? { filter: "drop-shadow(0 0 4px #00FFC8)" } : undefined} />
          {running ? "LIVE" : "IDLE"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span>
          CALLS <span className="text-[#4DFFD6]">{totalCalls.toLocaleString()}</span>
        </span>
        <span>
          FAILED <span className={totalFailures > 0 ? "text-amber-300" : "text-white/40"}>{totalFailures.toLocaleString()}</span>
        </span>
        <span>
          SUCCESS <span className="text-[#00E5FF]">{successRate}{successRate !== "—" ? "%" : ""}</span>
        </span>
        <span>
          CONNECTIONS <span className="text-[#FF2D9B]">{active}</span>
        </span>
        <span className="text-white/60">{time}</span>
      </div>
    </div>
  );
}
