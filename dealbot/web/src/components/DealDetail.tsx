import { useEffect, useState } from "react";
import { api, type ChannelRow, type DealDetail as DealDetailType } from "../api/client.js";
import { Badge } from "./Badge.js";

function money(amount: string | null, currency: string): string {
  if (amount == null) return "—";
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : `${currency} `;
  return `${symbol}${Number(amount).toFixed(2)}`;
}

export function DealDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<DealDetailType | null>(null);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);

  function reload() {
    api.deal(id).then(setDetail).catch(() => {});
  }

  useEffect(() => {
    reload();
    api.channels().then(setChannels).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="glass-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-[#1c232c] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-white/90">{detail.name}</h3>
            <p className="text-xs text-white/40">
              {detail.brand ?? "—"} · {detail.merchant} · {detail.sourceName}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80">
            ✕
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
          <Stat label="Price" value={money(detail.currentPrice, detail.currency)} sub={detail.referencePrice ? `was ${money(detail.referencePrice, detail.currency)}` : undefined} />
          <Stat label="Discount" value={detail.discountPct != null ? `${detail.discountPct.toFixed(1)}%` : "—"} />
          <Stat label="Deal Confidence" value={detail.dealConfidence != null ? `${detail.dealConfidence}%` : "—"} />
          <Stat label="Rating" value={detail.rating != null ? `${detail.rating}/5 (${detail.reviewCount ?? 0})` : "—"} />
          <Stat label="Deal Score" value={detail.dealScore != null ? String(detail.dealScore) : "—"} />
          <Stat label="Profit Score" value={detail.profitScore != null ? String(detail.profitScore) : "—"} />
          <Stat label="Est. Commission" value={money(detail.estimatedCommission, detail.currency)} />
          <Stat label="Status" value={<Badge tone="neutral">{detail.status}</Badge>} />
        </div>

        {detail.rejectReason && <p className="mb-4 rounded-sm border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">{detail.rejectReason}</p>}

        {detail.scoreBreakdown && (
          <details className="mb-4 rounded-sm border border-white/10 bg-black/20 p-3">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wide text-white/50">Score breakdown</summary>
            <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px] text-white/60 sm:grid-cols-3">
              {Object.entries(detail.scoreBreakdown).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span className="text-white/80">{v}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {detail.evidence && (
          <details className="mb-4 rounded-sm border border-white/10 bg-black/20 p-3">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wide text-white/50">Verification evidence</summary>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-white/60">{JSON.stringify(detail.evidence, null, 2)}</pre>
          </details>
        )}

        <div className="mb-4 rounded-sm border border-white/10 bg-black/20 p-3">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-white/50">Affiliate link</p>
          {detail.affiliateLink ? (
            <p className="font-mono text-[11px] text-white/60">
              <Badge tone={detail.affiliateLink.status === "ok" ? "good" : "danger"}>{detail.affiliateLink.status}</Badge>{" "}
              {detail.affiliateLink.error ?? detail.affiliateLink.affiliateUrl}
            </p>
          ) : (
            <p className="font-mono text-[11px] text-white/40">No affiliate link generated yet.</p>
          )}
        </div>

        {detail.posts.length > 0 && (
          <div className="mb-4">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-white/50">Post history</p>
            <div className="space-y-1">
              {detail.posts.map((p) => (
                <div key={p.id} className="rounded-sm border border-white/5 bg-black/20 px-2 py-1.5 font-mono text-[11px] text-white/60">
                  <Badge tone={p.status === "posted" ? "good" : p.status === "failed" ? "danger" : "neutral"}>{p.status}</Badge> {p.channelName ?? "—"} —{" "}
                  {p.error ?? new Date(p.created_at).toLocaleString()}
                </div>
              ))}
            </div>
          </div>
        )}

        {previewText && (
          <div className="mb-4 rounded-sm border border-teal-500/30 bg-teal-500/5 p-3">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-teal-300">Post preview</p>
            <pre className="whitespace-pre-wrap font-mono text-xs text-white/80">{previewText}</pre>
          </div>
        )}

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} className="rounded-sm border border-white/15 bg-black/30 px-2 py-2 text-xs">
            <option value="">Choose channel…</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            disabled={busy || !selectedChannel}
            onClick={() => run(() => api.postDealNow(id, selectedChannel))}
            className="rounded-sm bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
          >
            POST NOW
          </button>
          <button
            disabled={busy}
            onClick={() => run(async () => setPreviewText((await api.regeneratePost(id)).messageText))}
            className="rounded-sm border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40"
          >
            REGENERATE POST
          </button>
          <button disabled={busy} onClick={() => run(() => api.rejectDeal(id))} className="rounded-sm border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40">
            REJECT
          </button>
          <button
            disabled={busy}
            onClick={() => run(() => api.blockProduct(id))}
            className="rounded-sm border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
          >
            BLOCK PRODUCT
          </button>
          <button
            disabled={busy || !detail.brand}
            onClick={() => run(() => api.blockBrand(id))}
            className="rounded-sm border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
          >
            BLOCK BRAND
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <p className="uppercase tracking-wide text-white/35">{label}</p>
      <p className="text-sm font-bold text-white/90">{value}</p>
      {sub && <p className="text-white/30">{sub}</p>}
    </div>
  );
}
