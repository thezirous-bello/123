import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Sparkline } from "./Sparkline.js";

/** Real price history for the meme bot's most relevant token (its open
 * position, if any) — DexScreener-fed /tokens/:mint/history, the same
 * series WalletCard-style panels already use. No candles: DexScreener
 * integration here only exposes point-in-time price snapshots, so a line
 * chart is the honest representation rather than fabricating OHLC bars. */
export function MemeTokenChartPanel() {
  const tick = useRefreshSignal();
  const [label, setLabel] = useState<string | null>(null);
  const [prices, setPrices] = useState<number[]>([]);

  useEffect(() => {
    api
      .listPositions()
      .then(async (positions) => {
        const open = positions.find((p) => p.status === "open");
        if (!open) {
          setLabel(null);
          setPrices([]);
          return;
        }
        setLabel(open.symbol ?? open.mint.slice(0, 8));
        const history = await api.tokenHistory(open.mint, 60).catch(() => []);
        setPrices(history.map((p) => p.priceUsd).filter((v): v is number => v != null));
      })
      .catch(() => {});
  }, [tick]);

  return (
    <Panel title={`Token Price${label ? ` — ${label}` : ""}`}>
      {prices.length < 2 ? (
        <p className="font-mono text-xs text-white/30">No open position to chart yet — price history appears here once the bot holds a token.</p>
      ) : (
        <Sparkline values={prices} width={700} height={140} color="#FF2D9B" responsive />
      )}
    </Panel>
  );
}

/** Real best cross-exchange spread over time, from the arbitrage bot's own
 * scan history — the "market" this bot watches isn't a single symbol's
 * price, it's the gap between exchanges, so that's what's charted. */
export function ArbSpreadChartPanel() {
  const tick = useRefreshSignal();
  const [values, setValues] = useState<number[]>([]);
  const [latest, setLatest] = useState<{ symbol: string; pct: number } | null>(null);

  useEffect(() => {
    api
      .arbOpportunities()
      .then((rows) => {
        const crossed = rows.filter((r) => Number(r.grossSpreadPct) > 0).slice(0, 60).reverse();
        setValues(crossed.map((r) => Number(r.grossSpreadPct)));
        const last = crossed[crossed.length - 1];
        setLatest(last ? { symbol: last.symbol, pct: Number(last.grossSpreadPct) } : null);
      })
      .catch(() => {});
  }, [tick]);

  return (
    <Panel title="Best Spread Over Time" action={latest && <span className="font-mono text-xs text-[#00E5FF]">{latest.symbol} · {latest.pct.toFixed(3)}%</span>}>
      {values.length < 2 ? (
        <p className="font-mono text-xs text-white/30">No crossed markets scanned yet.</p>
      ) : (
        <Sparkline values={values} width={700} height={140} color="#00E5FF" responsive />
      )}
    </Panel>
  );
}
