import { useEffect, useState } from "react";
import { api, type LogEntry } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";

const LEVEL_COLOR: Record<string, string> = {
  debug: "text-white/30",
  info: "text-white/70",
  warn: "text-amber-300",
  error: "text-red-400",
};

export function LogsPanel() {
  const tick = useRefreshSignal();
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    api.logs(300).then(setLogs).catch(() => {});
  }, [tick]);

  return (
    <Panel title="Logs">
      <div className="max-h-[36rem] space-y-1 overflow-y-auto font-mono text-xs">
        {logs.map((l) => (
          <div key={l.id} className={LEVEL_COLOR[l.level]}>
            <span className="text-white/30">{new Date(l.created_at).toLocaleTimeString()}</span>{" "}
            <span className="text-white/40">[{l.category}]</span> {l.message}
          </div>
        ))}
        {logs.length === 0 && <p className="text-white/40">No log entries yet.</p>}
      </div>
    </Panel>
  );
}
