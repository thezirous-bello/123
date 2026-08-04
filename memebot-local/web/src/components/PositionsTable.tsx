import { useEffect, useState } from "react";
import { api, type Position } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Badge } from "./Badge.js";

export function PositionsTable({ statusFilter }: { statusFilter: "open" | "closed" }) {
  const tick = useRefreshSignal();
  const [positions, setPositions] = useState<Position[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.listPositions().then((all) => setPositions(all.filter((p) => p.status === statusFilter))).catch(() => {});
  }, [tick, statusFilter]);

  async function sell(id: string, percentage: number) {
    setBusy(id);
    try {
      await api.sellPosition(id, percentage);
      const all = await api.listPositions();
      setPositions(all.filter((p) => p.status === statusFilter));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel title={statusFilter === "open" ? "Open Positions" : "Closed Positions"}>
      {positions.length === 0 ? (
        <p className="text-sm text-white/50">No {statusFilter} positions.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-white/40">
              <tr>
                <th className="pb-2">Token</th>
                <th className="pb-2">Mode</th>
                <th className="pb-2">Entry Price</th>
                <th className="pb-2">Cost Basis</th>
                <th className="pb-2">Stop Loss</th>
                <th className="pb-2">Take Profits</th>
                <th className="pb-2">Realized PnL</th>
                {statusFilter === "open" && <th className="pb-2"></th>}
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="py-2">
                    <p className="font-semibold">{p.symbol ?? "?"}</p>
                    <p className="font-mono text-xs text-white/40">
                      {p.mint.slice(0, 6)}…{p.mint.slice(-6)}
                    </p>
                  </td>
                  <td className="py-2">
                    <Badge tone={p.mode === "live" ? "danger" : "accent"}>{p.mode.toUpperCase()}</Badge>
                  </td>
                  <td className="py-2">${Number(p.entryPriceUsd).toPrecision(4)}</td>
                  <td className="py-2">${Number(p.costBasisUsd).toFixed(2)}</td>
                  <td className="py-2">{p.stopLossPercentage ? `-${p.stopLossPercentage}%` : "—"}</td>
                  <td className="py-2 text-xs">
                    {p.takeProfits.map((tp, i) => (
                      <span key={i} className={p.takeProfitsFilled.includes(i) ? "text-emerald-400 line-through" : ""}>
                        {tp.sellPercentage}%@{tp.profitPercentage}%{i < p.takeProfits.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </td>
                  <td className={`py-2 font-semibold ${Number(p.realizedPnlUsd) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    ${Number(p.realizedPnlUsd).toFixed(2)}
                  </td>
                  {statusFilter === "open" && (
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={busy === p.id}
                          onClick={() => sell(p.id, 50)}
                          className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10"
                        >
                          Sell 50%
                        </button>
                        <button
                          disabled={busy === p.id}
                          onClick={() => sell(p.id, 100)}
                          className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                        >
                          Close Position
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
