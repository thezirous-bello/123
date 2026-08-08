import { useEffect, useState } from "react";
import { api, type Position, type PricePoint } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Sparkline } from "./Sparkline.js";

interface CardData {
  position: Position;
  history: PricePoint[];
}

export function TokenCardsRow({ mode }: { mode: "paper" | "live" }) {
  const tick = useRefreshSignal();
  const [cards, setCards] = useState<CardData[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .listPositions(mode)
      .then(async (all) => {
        const open = all.filter((p) => p.status === "open").slice(0, 8);
        const withHistory = await Promise.all(
          open.map(async (position) => ({ position, history: await api.tokenHistory(position.mint, 40).catch(() => []) })),
        );
        if (!cancelled) setCards(withHistory);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tick, mode]);

  if (cards.length === 0) {
    return (
      <Panel title="Live Positions">
        <p className="text-sm text-white/40">No open positions right now.</p>
      </Panel>
    );
  }

  return (
    <Panel title={`Live Positions (${cards.length})`}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {cards.map(({ position, history }) => {
          const entry = Number(position.entryPriceUsd);
          const currentPrice = history.length > 0 ? (history[history.length - 1]?.priceUsd ?? entry) : entry;
          const pnlPct = entry > 0 ? ((currentPrice - entry) / entry) * 100 : 0;
          const positive = pnlPct >= 0;
          const color = positive ? "#00FFC8" : "#FF3B5C";

          return (
            <div
              key={position.id}
              className={`min-w-[210px] flex-shrink-0 rounded-sm border bg-black/40 p-3 ${positive ? "border-emerald-500/40" : "border-red-500/40"}`}
            >
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-sm font-bold">${position.symbol ?? position.mint.slice(0, 6)}</p>
                <p className="font-mono text-xs text-white/40">{position.mode.toUpperCase()}</p>
              </div>
              <p className={`mt-1 text-2xl font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
                {positive ? "+" : ""}
                {pnlPct.toFixed(2)}%
              </p>
              <div className="my-1">
                <Sparkline values={history.map((h) => h.priceUsd ?? entry)} color={color} width={185} height={40} />
              </div>
              <p className="text-xs text-white/50">Cost: ${Number(position.costBasisUsd).toFixed(2)}</p>
              <p className="text-xs text-white/50">Entry: ${entry.toPrecision(4)}</p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
