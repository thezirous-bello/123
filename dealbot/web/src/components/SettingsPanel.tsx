import { useEffect, useState } from "react";
import { api, type PostingRules } from "../api/client.js";
import { Panel } from "./Panel.js";

export function SettingsPanel() {
  const [rules, setRules] = useState<PostingRules | null>(null);
  const [draft, setDraft] = useState<PostingRules | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.postingRules().then((r) => {
      setRules(r);
      setDraft(r);
    });
  }, []);

  function field<K extends keyof PostingRules>(key: K, label: string, type: "number" | "text" = "number") {
    if (!draft) return null;
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-white/40">{label}</span>
        <input
          type={type}
          value={draft[key] as number | string}
          onChange={(e) => setDraft({ ...draft, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
          className="rounded-sm border border-white/15 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-teal-500"
        />
      </label>
    );
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setSaved(false);
    try {
      const updated = await api.updatePostingRules({
        minDealScore: draft.min_deal_score,
        minDealConfidence: draft.min_deal_confidence,
        minDiscountPct: draft.min_discount_pct,
        minRating: draft.min_rating,
        minReviews: draft.min_reviews,
        minEstimatedCommission: draft.min_estimated_commission,
        requireInStock: !!draft.require_in_stock,
        requireAffiliateUrl: !!draft.require_affiliate_url,
        repostCooldownHours: draft.repost_cooldown_hours,
      });
      setRules(updated);
      setDraft(updated);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  if (!draft || !rules) return null;

  return (
    <Panel title="Auto-Post Rules">
      <p className="mb-4 text-xs text-white/40">
        A deal only auto-posts when every condition below is met, per channel category/score thresholds and posting caps configured on the Channels tab.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field("min_deal_score", "Min Deal Score")}
        {field("min_deal_confidence", "Min Deal Confidence")}
        {field("min_discount_pct", "Min Discount %")}
        {field("min_rating", "Min Rating")}
        {field("min_reviews", "Min Reviews")}
        {field("min_estimated_commission", "Min Commission $", "text")}
        {field("repost_cooldown_hours", "Repost Cooldown (h)")}
      </div>
      <div className="mt-4 flex items-center gap-4 font-mono text-xs">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!draft.require_in_stock} onChange={(e) => setDraft({ ...draft, require_in_stock: e.target.checked ? 1 : 0 })} />
          Require in stock
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!draft.require_affiliate_url} onChange={(e) => setDraft({ ...draft, require_affiliate_url: e.target.checked ? 1 : 0 })} />
          Require affiliate URL
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button disabled={busy} onClick={save} className="rounded-sm bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40">
          SAVE RULES
        </button>
        {saved && <span className="text-xs text-emerald-300">Saved.</span>}
      </div>
    </Panel>
  );
}
