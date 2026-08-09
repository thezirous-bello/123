import { useEffect, useState } from "react";
import { api, type DealFeedRow } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Badge, type BadgeTone } from "./Badge.js";
import { Panel } from "./Panel.js";
import { DealDetail } from "./DealDetail.js";

const STATUS_TABS = ["all", "discovered", "analyzing", "approved", "queued", "posted", "rejected", "expired", "out_of_stock", "error"] as const;

const STATUS_TONE: Record<string, BadgeTone> = {
  discovered: "neutral",
  analyzing: "neutral",
  approved: "accent",
  queued: "accent",
  posted: "good",
  rejected: "danger",
  expired: "warn",
  out_of_stock: "warn",
  error: "danger",
};

function money(amount: string | null, currency: string): string {
  if (amount == null) return "—";
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : `${currency} `;
  return `${symbol}${Number(amount).toFixed(2)}`;
}

export function DealFeedTable() {
  const tick = useRefreshSignal();
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>("all");
  const [rows, setRows] = useState<DealFeedRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api.deals(status === "all" ? undefined : status, 300).then(setRows).catch(() => {});
  }, [status, tick]);

  return (
    <Panel title={`Deal Feed (${rows.length})`}>
      <div className="mb-3 flex flex-wrap gap-1">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-sm px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${
              status === s ? "bg-teal-500/15 text-teal-300" : "text-white/40 hover:bg-white/5 hover:text-white/70"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-xs">
          <thead className="text-white/40">
            <tr>
              <th className="pb-2 pr-3">Product</th>
              <th className="pb-2 pr-3">Merchant</th>
              <th className="pb-2 pr-3">Category</th>
              <th className="pb-2 pr-3">Price</th>
              <th className="pb-2 pr-3">Discount</th>
              <th className="pb-2 pr-3">Deal</th>
              <th className="pb-2 pr-3">Profit</th>
              <th className="pb-2 pr-3">Commission</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2 pr-3">Channel</th>
              <th className="pb-2 pr-3">Clicks</th>
              <th className="pb-2 pr-3">Conv.</th>
              <th className="pb-2">Revenue</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setSelectedId(r.id)} className="cursor-pointer border-t border-white/5 hover:bg-white/5">
                <td className="py-2 pr-3 font-semibold text-white/80">{r.name}</td>
                <td className="py-2 pr-3 text-white/50">{r.merchant}</td>
                <td className="py-2 pr-3 text-white/50">{r.category ?? "—"}</td>
                <td className="py-2 pr-3">
                  {r.referencePrice && <span className="text-white/30 line-through">{money(r.referencePrice, r.currency)}</span>}{" "}
                  <span className="text-white/80">{money(r.currentPrice, r.currency)}</span>
                </td>
                <td className="py-2 pr-3 text-teal-300">{r.discountPct != null ? `${r.discountPct.toFixed(0)}%` : "—"}</td>
                <td className="py-2 pr-3 text-white/80">{r.dealScore ?? "—"}</td>
                <td className="py-2 pr-3 text-white/80">{r.profitScore ?? "—"}</td>
                <td className="py-2 pr-3 text-emerald-300">{money(r.estimatedCommission, r.currency)}</td>
                <td className="py-2 pr-3">
                  <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</Badge>
                </td>
                <td className="py-2 pr-3 text-white/50">{r.channelName ?? "—"}</td>
                <td className="py-2 pr-3 text-white/50">{r.clicks}</td>
                <td className="py-2 pr-3 text-white/50">{r.conversions}</td>
                <td className="py-2 text-white/50">{money(r.revenue, r.currency)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="py-6 text-center text-white/30">
                  No deals in this status yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedId && <DealDetail id={selectedId} onClose={() => setSelectedId(null)} />}
    </Panel>
  );
}
