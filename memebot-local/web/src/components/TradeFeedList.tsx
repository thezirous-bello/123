import { Panel } from "./Panel.js";
import { Badge } from "./Badge.js";

export interface TradeFeedRow {
  id: string;
  time: string;
  venue: string;
  side: "buy" | "sell";
  symbol: string;
  amountUsd: number;
  failed?: boolean;
}

/** Compact scrolling trade feed — same real trade rows every bot already
 * records, restyled into the dense terminal-row format instead of cards. */
export function TradeFeedList({ trades, title = "Live Trade Feed" }: { trades: TradeFeedRow[]; title?: string }) {
  return (
    <Panel title={title}>
      <div className="max-h-80 space-y-1 overflow-y-auto font-mono text-[11px]">
        {trades.length === 0 && <p className="text-white/30">No trades yet.</p>}
        {trades.map((t) => (
          <div key={t.id} className="animate-flash-in flex items-center justify-between gap-2 border-b border-white/5 py-1 last:border-0">
            <span className="text-white/30">{t.time}</span>
            <span className="w-16 truncate text-white/50">{t.venue}</span>
            <Badge tone={t.failed ? "danger" : t.side === "buy" ? "good" : "danger"}>{t.failed ? "FAIL" : t.side.toUpperCase()}</Badge>
            <span className="flex-1 truncate text-right text-white/80">{t.symbol}</span>
            <span className={`w-20 text-right font-semibold ${t.side === "buy" ? "text-[#4DFFD6]" : "text-red-400"}`}>${t.amountUsd.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
