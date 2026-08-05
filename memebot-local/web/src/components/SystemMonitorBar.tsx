import { useEffect, useState } from "react";
import { api, type SystemStats } from "../api/client.js";

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(bytesPerMin: number): string {
  if (bytesPerMin < 1024) return `${bytesPerMin.toFixed(0)}B/min`;
  if (bytesPerMin < 1024 * 1024) return `${(bytesPerMin / 1024).toFixed(1)}KB/min`;
  return `${(bytesPerMin / 1024 / 1024).toFixed(2)}MB/min`;
}

export function SystemMonitorBar() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const load = () => api.systemStats().then(setStats).catch(() => {});
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  return (
    <div className="terminal-surface flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/10 px-4 py-2 font-mono text-xs">
      <div className="flex flex-wrap items-center gap-5 text-white/60">
        <Metric label="CPU" value={stats ? `${stats.cpuPercent.toFixed(0)}%` : "—"} warn={stats ? stats.cpuPercent > 80 : false} />
        <Metric
          label="RAM"
          value={stats ? `${stats.memUsedMb.toFixed(0)}MB` : "—"}
          warn={stats ? stats.memUsedMb / stats.memTotalMb > 0.8 : false}
        />
        <Metric label="UPTIME" value={stats ? formatUptime(stats.uptimeSeconds) : "—"} />
        <Metric
          label="NET"
          value={stats ? `↓${formatBytes(stats.bytesInPerMin)} ↑${formatBytes(stats.bytesOutPerMin)}` : "—"}
        />
        <Metric label="REQ/MIN" value={stats ? String(stats.requestsPerMin) : "—"} />
      </div>
      <div className="text-glow-green text-[#5dffab]">{now.toLocaleTimeString()}</div>
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <span>
      <span className="text-white/30">{label}</span>{" "}
      <span className={warn ? "text-amber-300" : "text-[#5dffab]"}>{value}</span>
    </span>
  );
}
