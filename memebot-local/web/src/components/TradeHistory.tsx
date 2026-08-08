import { useEffect, useState } from "react";
import { api, type Trade } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Badge } from "./Badge.js";

export function TradeHistory() {
  const tick = useRefreshSignal();
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    api.listTrades().then(setTrades).catch(() => {});
  }, [tick]);

  return (
    <Panel title="Trade History">
      {trades.length === 0 ? (
        <p className="text-sm text-white/50">No trades yet.</p>
      ) : (
        <div className="max-h-[32rem] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#0B1017] text-xs uppercase text-white/40">
              <tr>
                <th className="pb-2">Time</th>
                <th className="pb-2">Side</th>
                <th className="pb-2">Mode</th>
                <th className="pb-2">Token</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Price</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-t border-white/5">
                  <td className="py-2 text-xs text-white/50">{new Date(t.created_at).toLocaleString()}</td>
                  <td className={`py-2 font-semibold ${t.side === "buy" ? "text-emerald-400" : "text-amber-400"}`}>{t.side.toUpperCase()}</td>
                  <td className="py-2">
                    <Badge tone={t.mode === "live" ? "danger" : "accent"}>{t.mode.toUpperCase()}</Badge>
                  </td>
                  <td className="py-2 font-mono text-xs">{t.symbol ?? `${t.mint.slice(0, 6)}…`}</td>
                  <td className="py-2">${Number(t.amount_usd).toFixed(2)}</td>
                  <td className="py-2">${Number(t.price_usd).toPrecision(4)}</td>
                  <td className="py-2">
                    <Badge tone={t.status === "confirmed" || t.status === "simulated" ? "good" : t.status === "failed" ? "danger" : "neutral"}>
                      {t.status}
                    </Badge>
                    {t.failure_reason && <p className="mt-0.5 text-xs text-red-400">{t.failure_reason}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
