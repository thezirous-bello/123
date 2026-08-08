import { Panel } from "./Panel.js";

export type AlertSeverity = "critical" | "warning" | "success" | "info";

export interface AlertRow {
  id: string;
  time: string;
  severity: AlertSeverity;
  message: string;
  meta?: string;
}

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: "#FF3B5C",
  warning: "#FFB020",
  success: "#00FFC8",
  info: "#00E5FF",
};

const SEVERITY_ICON: Record<AlertSeverity, string> = {
  critical: "✕",
  warning: "▲",
  success: "✓",
  info: "●",
};

/** Compact severity-colored alert stream — built from the bot's own real
 * risk_event / log rows (category "risk" or level "warn"/"error"), not a
 * separately invented alerting system. */
export function SystemAlertsFeed({ alerts }: { alerts: AlertRow[] }) {
  return (
    <Panel title="System Alerts">
      <div className="max-h-80 space-y-1.5 overflow-y-auto font-mono text-[11px]">
        {alerts.length === 0 && <p className="text-white/30">No alerts.</p>}
        {alerts.map((a) => (
          <div key={a.id} className="animate-flash-in flex items-start gap-2">
            <span style={{ color: SEVERITY_COLOR[a.severity] }}>{SEVERITY_ICON[a.severity]}</span>
            <span className="text-white/30">{a.time}</span>
            <span className="flex-1" style={{ color: SEVERITY_COLOR[a.severity] }}>
              {a.message}
              {a.meta && <span className="ml-2 text-white/40">{a.meta}</span>}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
