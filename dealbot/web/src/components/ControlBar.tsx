import { useEffect, useState } from "react";
import { api, type BotState } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Badge } from "./Badge.js";

export function ControlBar() {
  const tick = useRefreshSignal();
  const [status, setStatus] = useState<BotState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.status().then(setStatus).catch(() => {});
  }, [tick]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      setStatus(await api.status());
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  const running = !!status.running;
  const paused = !!status.paused;

  return (
    <div className="glass-panel mb-4 flex flex-wrap items-center gap-4 rounded-sm border border-[#1c232c] p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${running ? "animate-pulse-dot bg-emerald-400" : "bg-red-500"}`} />
        <span className="font-mono text-sm font-bold">{running ? (paused ? "🟡 BOT PAUSED" : "🟢 BOT RUNNING") : "🔴 BOT STOPPED"}</span>
        {status.demoMode && <Badge tone="warn">DEMO MODE</Badge>}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {!running ? (
          <button disabled={busy} onClick={() => run(api.start)} className="rounded-sm bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40">
            START
          </button>
        ) : (
          <button disabled={busy} onClick={() => run(api.stop)} className="rounded-sm bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 disabled:opacity-40">
            STOP
          </button>
        )}
        {running &&
          (paused ? (
            <button disabled={busy} onClick={() => run(api.resume)} className="rounded-sm border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-40">
              RESUME
            </button>
          ) : (
            <button disabled={busy} onClick={() => run(api.pause)} className="rounded-sm border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-40">
              PAUSE
            </button>
          ))}
        <button
          disabled={busy}
          onClick={() => run(api.scanNow)}
          className="rounded-sm border border-teal-500/40 px-4 py-2 text-sm font-semibold text-teal-300 hover:bg-teal-500/10 disabled:opacity-40"
        >
          SCAN NOW
        </button>
      </div>

      <div className="flex w-full gap-4 font-mono text-[11px] text-white/40 sm:w-auto">
        <span>
          Last scan: <span className="text-white/70">{status.last_scan_at ? new Date(status.last_scan_at).toLocaleTimeString() : "—"}</span>
        </span>
        <span>
          Next scan: <span className="text-white/70">{status.next_scan_at ? new Date(status.next_scan_at).toLocaleTimeString() : "—"}</span>
        </span>
        <span>
          Found: <span className="text-white/70">{status.last_scan_products_found}</span>
        </span>
      </div>
    </div>
  );
}
