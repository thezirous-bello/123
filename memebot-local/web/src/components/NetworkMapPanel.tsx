import { useRef, useState } from "react";
import { api, type LogEntry, type Trade } from "../api/client.js";
import { useBotEvent } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";

type ServiceId = "dexscreener" | "solanaRpc" | "jupiter" | "helius";

interface ServiceNode {
  id: ServiceId;
  label: string;
  x: number;
  y: number;
}

// Positions are illustrative layout only — these providers are cloud/CDN
// services with no single real location, so this is a diagram of the
// bot's actual call graph, not a claim about where any server physically
// sits.
const SERVICES: ServiceNode[] = [
  { id: "dexscreener", label: "DEXSCREENER", x: 640, y: 90 },
  { id: "solanaRpc", label: "SOLANA RPC", x: 640, y: 230 },
  { id: "jupiter", label: "JUPITER", x: 640, y: 370 },
  { id: "helius", label: "HELIUS (optional)", x: 100, y: 370 },
];

const LOCAL = { x: 370, y: 230 };

export function NetworkMapPanel() {
  const [pulses, setPulses] = useState<Partial<Record<ServiceId, number>>>({});
  const pulseCounter = useRef(0);
  const [callCounts, setCallCounts] = useState<Partial<Record<ServiceId, number>>>({});

  function pulse(id: ServiceId) {
    pulseCounter.current += 1;
    const key = pulseCounter.current;
    setPulses((prev) => ({ ...prev, [id]: key }));
    setCallCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    setTimeout(() => {
      setPulses((prev) => (prev[id] === key ? { ...prev, [id]: undefined } : prev));
    }, 1200);
  }

  useBotEvent<LogEntry>("log_created", (log) => {
    if (log.category === "strategy_evaluation" || log.category === "discovery") {
      pulse("dexscreener");
      pulse("solanaRpc");
      pulse("jupiter");
    }
  });

  useBotEvent<Trade>("trade_created", () => {
    pulse("jupiter");
    pulse("solanaRpc");
  });

  return (
    <Panel
      title="Network Map"
      action={
        <button
          onClick={() => api.discoverTokens().catch(() => {})}
          className="rounded border border-white/15 px-2 py-1 text-[10px] font-mono text-white/50 hover:bg-white/10"
          title="Runs a real discovery pass now, same as the Scanner tab's Discover Now button"
        >
          DISCOVER NOW
        </button>
      }
    >
      <p className="mb-2 text-[11px] text-white/30">
        Real call graph, not a geography — node positions are illustrative. Lines light up when the bot actually calls that service.
      </p>
      <svg viewBox="0 0 760 440" className="w-full">
        <WorldBackdrop />

        {SERVICES.map((service) => {
          const active = pulses[service.id] !== undefined;
          return (
            <g key={service.id}>
              <ConnectionLine from={LOCAL} to={service} active={active} pulseKey={pulses[service.id]} />
            </g>
          );
        })}

        {/* Local node */}
        <circle cx={LOCAL.x} cy={LOCAL.y} r={16} fill="#a78bfa" fillOpacity={0.15} />
        <circle cx={LOCAL.x} cy={LOCAL.y} r={7} fill="#a78bfa" style={{ filter: "drop-shadow(0 0 6px #a78bfa)" }} />
        <text x={LOCAL.x} y={LOCAL.y + 32} textAnchor="middle" className="fill-white/70" style={{ fontSize: 11, fontFamily: "monospace" }}>
          MEMEBOT (LOCAL)
        </text>

        {SERVICES.map((service) => {
          const active = pulses[service.id] !== undefined;
          const count = callCounts[service.id] ?? 0;
          const color = active ? "#22ff88" : "#38bdf8";
          return (
            <g key={`node-${service.id}`}>
              {active && <circle cx={service.x} cy={service.y} r={14} fill="none" stroke={color} className="animate-ping-ring" />}
              <circle cx={service.x} cy={service.y} r={6} fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
              <text x={service.x} y={service.y - 16} textAnchor="middle" className="fill-white/60" style={{ fontSize: 10, fontFamily: "monospace" }}>
                {service.label}
              </text>
              <text x={service.x} y={service.y + 24} textAnchor="middle" className="fill-white/30" style={{ fontSize: 9, fontFamily: "monospace" }}>
                {count} call{count === 1 ? "" : "s"}
              </text>
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
  active,
  pulseKey,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  active: boolean;
  pulseKey: number | undefined;
}) {
  const pathId = `path-${to.x}-${to.y}`;
  const d = `M${from.x},${from.y} L${to.x},${to.y}`;
  return (
    <>
      <path id={pathId} d={d} fill="none" stroke={active ? "#22ff88" : "rgba(255,255,255,0.08)"} strokeWidth={active ? 1.5 : 1} />
      {active && (
        <circle key={pulseKey} r={3} fill="#22ff88" style={{ filter: "drop-shadow(0 0 4px #22ff88)" }}>
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
      // Rough landmass-ish blobs so it reads as "a map" without claiming precision.
      const inBlob =
        (x > 40 && x < 260 && y > 40 && y < 200) || // "north america"
        (x > 300 && x < 460 && y > 30 && y < 400) || // "africa/europe"
        (x > 500 && x < 740 && y > 60 && y < 340) || // "asia"
        (x > 120 && x < 260 && y > 260 && y < 400); // "south america"
      if (inBlob && Math.random() > 0.35) dots.push([x, y]);
    }
  }
  return (
    <g opacity={0.35}>
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1} fill="#22ff88" />
      ))}
    </g>
  );
}
