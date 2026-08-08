/** Minimal dependency-free line/area chart. Renders nothing fancy — just an
 * honest plot of whatever numbers it's given, styled to match the glowing
 * terminal aesthetic. Returns a flat centered line if there's no variance
 * or fewer than 2 points, rather than a misleading empty chart. */
export function Sparkline({
  values,
  width = 260,
  height = 60,
  color = "#00FFC8",
  fill = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height}>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeOpacity={0.3} strokeDasharray="4 4" />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && <path d={areaPath} fill={color} fillOpacity={0.12} stroke="none" />}
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
      <circle cx={points[points.length - 1]?.[0]} cy={points[points.length - 1]?.[1]} r={2.5} fill={color} />
    </svg>
  );
}
