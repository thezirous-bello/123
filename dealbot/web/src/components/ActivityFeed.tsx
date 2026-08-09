import { useEffect, useRef, useState } from "react";
import { api, type ActivityRecord } from "../api/client.js";
import { useBotEvent } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";

const LEVEL_COLOR: Record<ActivityRecord["level"], string> = {
  debug: "text-white/30",
  info: "text-teal-300",
  warn: "text-amber-300",
  error: "text-red-400",
};

const MAX_LINES = 200;

export function ActivityFeed() {
  const [logs, setLogs] = useState<ActivityRecord[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .activity(MAX_LINES)
      .then((rows) => setLogs(rows.slice().reverse()))
      .catch(() => {});
  }, []);

  useBotEvent<ActivityRecord>("activity_logged", (row) => {
    setLogs((prev) => [...prev.slice(-(MAX_LINES - 1)), row]);
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  return (
    <Panel title="Live Activity">
      <div ref={scrollRef} className="h-80 overflow-y-auto rounded-sm border border-white/10 bg-black/30 p-3 font-mono text-[12px] leading-relaxed">
        {logs.length === 0 && <p className="text-white/30">Waiting for activity — start the bot or trigger a scan.</p>}
        {logs.map((log) => (
          <div key={log.id} className={`animate-fade-slide-in ${LEVEL_COLOR[log.level]}`}>
            <span className="text-white/25">{new Date(log.created_at).toLocaleTimeString()}</span>{" "}
            <span className="text-white/40">[{log.category.toUpperCase()}]</span> {log.message}
          </div>
        ))}
      </div>
    </Panel>
  );
}
