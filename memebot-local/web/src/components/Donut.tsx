export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/** Dependency-free SVG donut. Purely presentational — every caller feeds
 * it real, already-computed numbers (win/loss counts, open-position
 * notional by symbol); it never derives or fabricates its own data. */
export function Donut({ segments, centerLabel, centerValue, size = 132 }: { segments: DonutSegment[]; centerLabel?: string; centerValue?: string; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((seg) => {
      const frac = total > 0 ? seg.value / total : 0;
      const dash = frac * circumference;
      const arc = (
        <circle
          key={seg.label}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={10}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={-offset}
          strokeLinecap="butt"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 3px ${seg.color}90)` }}
        />
      );
      offset += dash;
      return arc;
    });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff" strokeOpacity={0.06} strokeWidth={10} />
        {total > 0 ? arcs : null}
        {centerValue && (
          <text x={cx} y={cy - 2} textAnchor="middle" className="fill-white" style={{ fontSize: 17, fontWeight: 700, fontFamily: "monospace" }}>
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text x={cx} y={cy + 15} textAnchor="middle" className="fill-white/40" style={{ fontSize: 8, letterSpacing: 1, fontFamily: "monospace" }}>
            {centerLabel}
          </text>
        )}
      </svg>
      <div className="space-y-1 font-mono text-[10px]">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-white/60">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: seg.color }} />
            <span className="uppercase tracking-wide">{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
