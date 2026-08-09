import { useEffect, useState } from "react";
import { api, type SourceRow } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Badge, type BadgeTone } from "./Badge.js";
import { Panel } from "./Panel.js";

const STATUS_TONE: Record<string, BadgeTone> = { ok: "good", degraded: "warn", down: "danger", unknown: "neutral" };

export function SourcesPanel() {
  const tick = useRefreshSignal();
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [editingTag, setEditingTag] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState("");
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.sources().then(setSources).catch(() => {});
    api.sourceKinds().then((k) => {
      setKinds(k);
      setNewKind((prev) => prev || k[0] || "");
    }).catch(() => {});
  }, [tick]);

  async function createSource() {
    if (!newName || !newKind) return;
    setBusy(true);
    try {
      await api.createSource({ name: newName, kind: newKind, affiliateTag: newTag || undefined });
      setNewName("");
      setNewTag("");
      setSources(await api.sources());
    } finally {
      setBusy(false);
    }
  }

  async function saveTag(id: string) {
    const tag = editingTag[id];
    if (tag == null) return;
    setBusy(true);
    try {
      await api.updateSource(id, { affiliateTag: tag });
      setSources(await api.sources());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Deal Sources">
      <div className="mb-4 space-y-2">
        {sources.map((s) => (
          <div key={s.id} className="rounded-sm border border-white/10 bg-black/20 p-3 font-mono text-xs">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white/80">{s.name}</span>
              <Badge tone="neutral">{s.kind}</Badge>
              <Badge tone={s.enabled ? "good" : "neutral"}>{s.enabled ? "enabled" : "disabled"}</Badge>
              <Badge tone={STATUS_TONE[s.health.status] ?? "neutral"}>{s.health.status}</Badge>
              <span className="text-white/40">calls {s.health.totalCalls} · failed {s.health.totalFailures}</span>
              <button
                disabled={busy}
                onClick={async () => {
                  await api.setSourceEnabled(s.id, !s.enabled);
                  setSources(await api.sources());
                }}
                className="ml-auto rounded-sm border border-white/20 px-2 py-1 text-[10px] hover:bg-white/10"
              >
                {s.enabled ? "DISABLE" : "ENABLE"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-white/50">
              <span>Countries: {JSON.parse(s.countries_json).join(", ") || "any"}</span>
              <span>Categories: {JSON.parse(s.categories_json).join(", ") || "any"}</span>
              <span>Last scan: {s.last_successful_scan_at ? new Date(s.last_successful_scan_at).toLocaleTimeString() : "never"}</span>
            </div>
            {s.last_error && <p className="mt-1 text-red-400">{s.last_error}</p>}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-white/40">Affiliate tag:</span>
              <input
                defaultValue={s.affiliate_tag ?? ""}
                onChange={(e) => setEditingTag((prev) => ({ ...prev, [s.id]: e.target.value }))}
                placeholder="your-affiliate-tag"
                className="rounded-sm border border-white/15 bg-black/30 px-2 py-1 text-[11px]"
              />
              <button disabled={busy} onClick={() => saveTag(s.id)} className="rounded-sm border border-teal-500/40 px-2 py-1 text-[10px] text-teal-300 hover:bg-teal-500/10">
                SAVE
              </button>
              {!s.affiliate_tag && <span className="text-amber-300">No tag — offers from this source can never auto-post.</span>}
            </div>
          </div>
        ))}
        {sources.length === 0 && <p className="text-xs text-white/30">No sources configured yet.</p>}
      </div>

      <div className="rounded-sm border border-white/10 bg-black/20 p-3">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-white/50">Add source</p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Source name" className="rounded-sm border border-white/15 bg-black/30 px-2 py-1.5 text-xs" />
          <select value={newKind} onChange={(e) => setNewKind(e.target.value)} className="rounded-sm border border-white/15 bg-black/30 px-2 py-1.5 text-xs">
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Affiliate tag (optional)" className="rounded-sm border border-white/15 bg-black/30 px-2 py-1.5 text-xs" />
          <button disabled={busy || !newName} onClick={createSource} className="rounded-sm bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-40">
            ADD
          </button>
        </div>
        <p className="mt-2 text-[11px] text-white/30">
          Only "demo" ships built in. Real providers (Amazon PA-API, AWIN, CJ, Rakuten, ...) register a new adapter in server/src/sources/registry.ts, then appear here.
        </p>
      </div>
    </Panel>
  );
}
