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
  healthy: "#00FFC8",
  degraded: "#FFB020",
  down: "#FF3B5C",
};

const REQUEST_COLOR = "#00E5FF"; // outbound "request sent" pulse — distinct from the status-colored response

function curvePath(from: { x: number; y: number }, to: { x: number; y: number }, curveStrength = 34): string {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  // Perpendicular offset so the connector arcs instead of running straight.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const offsetX = (-dy / len) * curveStrength;
  const offsetY = (dx / len) * curveStrength;
  return `M${from.x},${from.y} Q${midX + offsetX},${midY + offsetY} ${to.x},${to.y}`;
}

const VIEW_W = 800;
const VIEW_H = 520;
const LOCAL = { x: VIEW_W / 2, y: VIEW_H / 2 };

/** Deterministic 0..1 hash of a string, used only for stable per-node
 * radius/curve jitter so the fan-out looks organic instead of a perfect
 * ring, without re-randomizing on every render. */
function hash01(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/** Arranges every service node in a radial fan around the local hub —
 * real provider count drives the angle spacing, so a 6-exchange map and an
 * 11-provider map both read as a dense "spider web" radiating outward,
 * matching the reference layout instead of the old fixed hand-placed grid. */
function radialLayout(services: ServiceNode[]): Array<ServiceNode & { x: number; y: number; curve: number }> {
  const n = services.length;
  const baseRadius = Math.min(VIEW_W, VIEW_H * 1.7) * 0.4;
  return services.map((s, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const jitter = hash01(s.id + i) * 46 - 23;
    const r = baseRadius + jitter;
    return {
      ...s,
      x: LOCAL.x + Math.cos(angle) * r,
      y: LOCAL.y + Math.sin(angle) * r * 0.82,
      curve: 22 + hash01(s.id) * 30,
    };
  });
}

export interface NetworkMapPanelProps {
  title?: string;
  hubLabel: string;
  services: ServiceNode[];
  action?: React.ReactNode;
  /** Returns an extra hint appended to the red down-provider banner (e.g.
   * "try a different RPC URL"), or null/undefined for no extra hint. */
  hintForDownProvider?: (providerId: ProviderId, health: ProviderHealth) => string | null | undefined;
}

/** Real call-graph + live provider health, reused by all four bots — same
 * component, a different service list and hub label per caller. Node
 * positions are illustrative layout only, not geodata: these are cloud/CDN
 * services with no single real location. The dense particle web behind the
 * real nodes is purely decorative ambient motion (constant, not tied to any
 * data) so the map reads as "alive" even between real calls; every actual
 * request still fires its own two-stage pulse — an outbound dot toward the
 * service, then a status-colored response dot traveling back — along the
 * real connection lines. */
export function NetworkMapPanel({ title = "Network Map", hubLabel, services, action, hintForDownProvider }: NetworkMapPanelProps) {
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({});
  const [pulses, setPulses] = useState<Record<string, number>>({});
  const pulseCounter = useRef(0);
  const particles = useParticleField(services.length);
  const mesh = useMemo(() => buildMesh(particles), [particles]);
  const laidOut = useMemo(() => radialLayout(services), [services]);

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
    <Panel
      title={title}
      action={
        <div className="flex items-center gap-3">
          <Legend />
          {action}
        </div>
      }
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-white/40">
        <span>Real call graph + live provider health — node positions are illustrative, not geodata.</span>
        <span className="flex gap-3">
          <span>
            CALLS <span className="text-[#4DFFD6]">{stats.totalCalls}</span>
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

      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full">
        <defs>
          <radialGradient id="hub-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF2D9B" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#FF2D9B" stopOpacity={0} />
          </radialGradient>
        </defs>

        <ParticleWeb particles={particles} mesh={mesh} />

        {laidOut.map((service) => {
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
              curveStrength={service.curve}
            />
          );
        })}

        {/* Local hub — layered glow + rotating dashed ring, the visual
            centerpiece every connection radiates from/to. */}
        <circle cx={LOCAL.x} cy={LOCAL.y} r={70} fill="url(#hub-glow)" />
        <circle cx={LOCAL.x} cy={LOCAL.y} r={38} fill="none" stroke="#FF2D9B" strokeOpacity={0.35} strokeDasharray="3 5" className="animate-radar-spin" style={{ transformOrigin: `${LOCAL.x}px ${LOCAL.y}px` }} />
        <circle cx={LOCAL.x} cy={LOCAL.y} r={26} fill="#FF2D9B" fillOpacity={0.14} className="animate-node-idle" />
        <circle cx={LOCAL.x} cy={LOCAL.y} r={17} fill="#FF2D9B" fillOpacity={0.22} />
        <circle cx={LOCAL.x} cy={LOCAL.y} r={9} fill="#FF2D9B" style={{ filter: "drop-shadow(0 0 10px #FF2D9B)" }} />
        <text x={LOCAL.x} y={LOCAL.y + 52} textAnchor="middle" className="fill-white/80" style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, letterSpacing: 1 }}>
          {hubLabel}
        </text>

        {laidOut.map((service) => {
          const h = health[service.id];
          const status = statusOf(h);
          const color = STATUS_COLOR[status];
          const active = !!pulses[service.id];
          return (
            <g key={`node-${service.id}`}>
              {active && <circle cx={service.x} cy={service.y} r={14} fill="none" stroke={color} className="animate-ping-ring" />}
              <circle cx={service.x} cy={service.y} r={7} fill={color} className={status === "healthy" ? "animate-node-idle" : undefined} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
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

/** Two-stage pulse: an outbound "request" dot travels hub -> service, then
 * — timed to start right as the first lands — a status-colored "response"
 * dot travels the same path back service -> hub. Same connection line,
 * opposite direction, so it reads as one round trip rather than two
 * unrelated blips. */
function ConnectionLine({
  from,
  to,
  color,
  active,
  pulseKey,
  curveStrength,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  active: boolean;
  pulseKey: number | undefined;
  curveStrength?: number;
}) {
  const d = curvePath(from, to, curveStrength);
  return (
    <>
      <path d={d} fill="none" stroke={active ? color : "rgba(255,255,255,0.08)"} strokeWidth={active ? 1.75 : 1} />
      {active && (
        <g key={pulseKey}>
          <circle r={3} fill={REQUEST_COLOR} style={{ filter: `drop-shadow(0 0 4px ${REQUEST_COLOR})` }}>
            <animateMotion dur="0.45s" begin="0s" path={d} />
          </circle>
          <circle r={3} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
            <animateMotion dur="0.5s" begin="0.4s" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path={d} />
          </circle>
        </g>
      )}
    </>
  );
}

function Legend() {
  const items: Array<[string, string]> = [
    ["#00E5FF", "REQUEST"],
    ["#00FFC8", "RESPONSE"],
    ["#FF3B5C", "ERROR"],
  ];
  return (
    <div className="hidden items-center gap-3 font-mono text-[9px] uppercase tracking-wide text-white/40 sm:flex">
      {items.map(([color, label]) => (
        <span key={label} className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
          {label}
        </span>
      ))}
    </div>
  );
}

interface Particle {
  x: number;
  y: number;
  r: number;
  color: string;
  opacity: number;
  dur: number;
  delay: number;
  dx: number;
  dy: number;
}

const PARTICLE_PALETTE = ["#00FFC8", "#00FFC8", "#00FFC8", "#00E5FF", "#FF2D9B", "#FF3B5C"];

/** A dense field of small, constantly-drifting ambient particles — purely
 * decorative background motion so the map feels alive even when no real
 * call is in flight, not tied to any provider data. Count scales gently
 * with how many real service nodes this map has, so a 6-exchange map and
 * an 11-provider map both feel appropriately busy without either looking
 * sparse or cluttered. Generated once per mount, not re-randomized on
 * every render (that would make the "drift" read as jittery teleporting
 * instead of smooth motion). */
function useParticleField(serviceCount: number): Particle[] {
  return useMemo(() => {
    const count = Math.min(160, 70 + serviceCount * 9);
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: 15 + Math.random() * (VIEW_W - 30),
        y: 15 + Math.random() * (VIEW_H - 30),
        r: 0.5 + Math.random() * 1.3,
        color: PARTICLE_PALETTE[Math.floor(Math.random() * PARTICLE_PALETTE.length)]!,
        opacity: 0.12 + Math.random() * 0.3,
        dur: 3.5 + Math.random() * 5,
        delay: Math.random() * 5,
        dx: (Math.random() - 0.5) * 10,
        dy: (Math.random() - 0.5) * 10,
      });
    }
    return particles;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Connects each particle to its 1-2 nearest neighbors within range,
 * de-duplicated — the faint "spider web" mesh texture behind the real
 * nodes. Computed once alongside the particle field itself. */
function buildMesh(particles: Particle[]): Array<[Particle, Particle]> {
  const maxDist = 65;
  const maxLinksPerNode = 2;
  const seen = new Set<string>();
  const lines: Array<[Particle, Particle]> = [];
  for (let i = 0; i < particles.length; i++) {
    const neighbors = particles
      .map((p, j) => ({ j, d: Math.hypot(p.x - particles[i]!.x, p.y - particles[i]!.y) }))
      .filter((e) => e.j !== i && e.d < maxDist)
      .sort((a, b) => a.d - b.d)
      .slice(0, maxLinksPerNode);
    for (const n of neighbors) {
      const key = i < n.j ? `${i}-${n.j}` : `${n.j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push([particles[i]!, particles[n.j]!]);
    }
  }
  return lines;
}

function ParticleWeb({ particles, mesh }: { particles: Particle[]; mesh: Array<[Particle, Particle]> }) {
  return (
    <g>
      <g>
        {mesh.map(([a, b], i) => (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeOpacity={0.055} strokeWidth={0.6} />
        ))}
      </g>
      <g>
        {particles.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={p.color}
            className="animate-particle-drift"
            style={
              {
                "--p-op": p.opacity,
                "--dur": `${p.dur}s`,
                "--delay": `${p.delay}s`,
                "--dx": `${p.dx}px`,
                "--dy": `${p.dy}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </g>
    </g>
  );
}
