import { useEffect, useMemo, useRef, useState } from "react";
import { api, type ProviderHealth, type ProviderId } from "../api/client.js";
import { useBotEvent } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";

export interface ServiceNode {
  id: ProviderId;
  label: string;
  x: number;
  y: number;
}

type Status = "unused" | "healthy" | "degraded" | "down";

function statusOf(health: ProviderHealth | undefined): Status {
  if (!health || health.totalCalls === 0) return "unused";
  if (health.consecutiveFailures >= 3) return "down";
  if (health.consecutiveFailures > 0) return "degraded";
  return "healthy";
}

const STATUS_COLOR: Record<Status, string> = {
  unused: "#3b4252",
  healthy: "#22ff88",
  degraded: "#fbbf24",
  down: "#f87171",
};

function curvePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  // Perpendicular offset so the connector arcs instead of running straight.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const curveStrength = 28;
  const offsetX = (-dy / len) * curveStrength;
  const offsetY = (dx / len) * curveStrength;
  return `M${from.x},${from.y} Q${midX + offsetX},${midY + offsetY} ${to.x},${to.y}`;
}

const LOCAL = { x: 350, y: 230 };

export interface NetworkMapPanelProps {
  title?: string;
  hubLabel: string;
  services: ServiceNode[];
  action?: React.ReactNode;
  /** Returns an extra hint appended to the red down-provider banner (e.g.
   * "try a different RPC URL"), or null/undefined for no extra hint. */
  hintForDownProvider?: (providerId: ProviderId, health: ProviderHealth) => string | null | undefined;
}

/** Real call-graph + live provider health, reused by the meme-coin bot (its
 * own DexScreener/Solana RPC/Jupiter/Helius calls) and the Bybit spot/
 * futures bots (their own Bybit + Fear&Greed calls) — same component, a
 * different service list and hub label per caller. Node positions are
 * illustrative layout only, not geodata: these are cloud/CDN services with
 * no single real location. */
export function NetworkMapPanel({ title = "Network Map", hubLabel, services, action, hintForDownProvider }: NetworkMapPanelProps) {
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({});
  const [pulses, setPulses] = useState<Record<string, number>>({});
  const pulseCounter = useRef(0);

  useEffect(() => {
    api
      .providerStatus()
      .then((rows) => setHealth(Object.fromEntries(rows.map((r) => [r.provider, r]))))
      .catch(() => {});
  }, []);

  useBotEvent<ProviderHealth>("provider_health_changed", (entry) => {
    setHealth((prev) => ({ ...prev, [entry.provider]: entry }));
    pulseCounter.current += 1;
    const key = pulseCounter.current;
    setPulses((prev) => ({ ...prev, [entry.provider]: key }));
    setTimeout(() => {
      setPulses((prev) => (prev[entry.provider] === key ? { ...prev, [entry.provider]: 0 } : prev));
    }, 1100);
  });

  const relevantHealth = useMemo(() => {
    const ids = new Set(services.map((s) => s.id));
    return Object.values(health).filter((h) => ids.has(h.provider));
  }, [health, services]);

  const stats = useMemo(() => {
    const totalCalls = relevantHealth.reduce((s, r) => s + r.totalCalls, 0);
    const totalFailures = relevantHealth.reduce((s, r) => s + r.totalFailures, 0);
    const down = relevantHealth.filter((r) => statusOf(r) === "down").length;
    return { totalCalls, totalFailures, down };
  }, [relevantHealth]);

  return (
    <Panel title={title} action={action}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-white/40">
        <span>Real call graph + live provider health — node positions are illustrative, not geodata.</span>
        <span className="flex gap-3">
          <span>
            CALLS <span className="text-[#5dffab]">{stats.totalCalls}</span>
          </span>
          <span>
            FAILED <span className={stats.totalFailures > 0 ? "text-amber-300" : "text-white/40"}>{stats.totalFailures}</span>
          </span>
          <span>
            DOWN <span className={stats.down > 0 ? "text-red-400" : "text-white/40"}>{stats.down}</span>
          </span>
        </span>
      </div>

      {stats.down > 0 && (
        <p className="mb-2 rounded border border-red-500/30 bg-red-500/5 px-2 py-1 text-[11px] text-red-300">
          {relevantHealth
            .filter((h) => statusOf(h) === "down")
            .map((h) => `${h.provider}: ${h.lastError ?? "failing"}${hintForDownProvider ? ` — ${hintForDownProvider(h.provider, h) ?? ""}` : ""}`)
            .join(" · ")}
          {" — this will block trades."}
        </p>
      )}

      <svg viewBox="0 0 760 440" className="w-full">
        <WorldBackdrop />

        {services.map((service) => {
          const status = statusOf(health[service.id]);
          const active = !!pulses[service.id];
          return (
            <ConnectionLine
              key={service.id}
              from={LOCAL}
              to={service}
              color={STATUS_COLOR[status]}
              active={active}
              pulseKey={pulses[service.id]}
            />
          );
        })}

        {/* Local hub */}
        <circle cx={LOCAL.x} cy={LOCAL.y} r={22} fill="#a78bfa" fillOpacity={0.12} />
        <circle cx={LOCAL.x} cy={LOCAL.y} r={16} fill="#a78bfa" fillOpacity={0.18} />
        <circle cx={LOCAL.x} cy={LOCAL.y} r={7} fill="#a78bfa" style={{ filter: "drop-shadow(0 0 6px #a78bfa)" }} />
        <text x={LOCAL.x} y={LOCAL.y + 40} textAnchor="middle" className="fill-white/70" style={{ fontSize: 11, fontFamily: "monospace" }}>
          {hubLabel}
        </text>

        {services.map((service) => {
          const h = health[service.id];
          const status = statusOf(h);
          const color = STATUS_COLOR[status];
          const active = !!pulses[service.id];
          return (
            <g key={`node-${service.id}`}>
              {active && <circle cx={service.x} cy={service.y} r={14} fill="none" stroke={color} className="animate-ping-ring" />}
              <circle cx={service.x} cy={service.y} r={7} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
              <text x={service.x} y={service.y - 18} textAnchor="middle" className="fill-white/70" style={{ fontSize: 10, fontFamily: "monospace" }}>
                {service.label}
              </text>
              <text x={service.x} y={service.y + 22} textAnchor="middle" style={{ fontSize: 9, fontFamily: "monospace", fill: color }}>
                {status === "unused" ? "no calls yet" : status.toUpperCase()}
                {h?.lastLatencyMs != null && status !== "unused" ? ` · ${h.lastLatencyMs}ms` : ""}
              </text>
              {h && h.totalCalls > 0 && (
                <text x={service.x} y={service.y + 34} textAnchor="middle" className="fill-white/30" style={{ fontSize: 8, fontFamily: "monospace" }}>
                  {h.totalCalls} calls{h.totalFailures > 0 ? `, ${h.totalFailures} failed` : ""}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </Panel>
  );
}

function ConnectionLine({
  from,
  to,
  color,
  active,
  pulseKey,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  active: boolean;
  pulseKey: number | undefined;
}) {
  const d = curvePath(from, to);
  return (
    <>
      <path d={d} fill="none" stroke={active ? color : "rgba(255,255,255,0.08)"} strokeWidth={active ? 1.75 : 1} />
      {active && (
        <circle key={pulseKey} r={3} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
          <animateMotion dur="0.9s" repeatCount="1" path={d} />
        </circle>
      )}
    </>
  );
}

/** Faint dot-grid continents — purely decorative backdrop, not geodata. */
function WorldBackdrop() {
  const dots: Array<[number, number]> = [];
  for (let x = 20; x < 760; x += 22) {
    for (let y = 20; y < 420; y += 22) {
      const inBlob =
        (x > 40 && x < 260 && y > 40 && y < 200) ||
        (x > 300 && x < 460 && y > 30 && y < 400) ||
        (x > 500 && x < 740 && y > 60 && y < 340) ||
        (x > 120 && x < 260 && y > 260 && y < 400);
      if (inBlob && Math.random() > 0.35) dots.push([x, y]);
    }
  }
  return (
    <g opacity={0.3}>
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1} fill="#22ff88" />
      ))}
    </g>
  );
}
