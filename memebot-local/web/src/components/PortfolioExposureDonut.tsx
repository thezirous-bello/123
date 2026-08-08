import { Panel } from "./Panel.js";
import { Donut } from "./Donut.js";

export interface ExposureSlice {
  symbol: string;
  notionalUsd: number;
}

const PALETTE = ["#FF2D9B", "#00E5FF", "#00FFC8", "#FFB020", "#8B5CF6", "#FF3B5C"];

/** Real open-position notional breakdown by symbol — computed from the
 * bot's own open positions, not a fabricated allocation. */
export function PortfolioExposureDonut({
  slices,
  totalLabel = "EXPOSURE",
  title = "Portfolio Exposure",
}: {
  slices: ExposureSlice[];
  totalLabel?: string;
  title?: string;
}) {
  const total = slices.reduce((s, x) => s + x.notionalUsd, 0);
  const segments = slices
    .slice(0, 6)
    .map((s, i) => ({ label: s.symbol, value: s.notionalUsd, color: PALETTE[i % PALETTE.length]! }));

  return (
    <Panel title={title}>
      {total === 0 ? (
        <p className="font-mono text-xs text-white/30">No open exposure.</p>
      ) : (
        <Donut segments={segments} centerValue={`$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} centerLabel={totalLabel} />
      )}
    </Panel>
  );
}
