import { useEffect, useState } from "react";
import { api, type SecurityReport, type TokenSnapshot, type WatchlistEntry } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Badge } from "./Badge.js";

const RISK_TONE: Record<string, "good" | "warn" | "danger" | "neutral"> = {
  low: "good",
  medium: "warn",
  high: "danger",
  critical: "danger",
};

function shortMint(mint: string): string {
  return `${mint.slice(0, 6)}…${mint.slice(-6)}`;
}

export function TokenScanner() {
  const tick = useRefreshSignal();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TokenSnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ snapshot: TokenSnapshot; security: SecurityReport } | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoverMsg, setDiscoverMsg] = useState<string | null>(null);

  useEffect(() => {
    api.watchlist().then(setWatchlist).catch(() => {});
  }, [tick]);

  async function discoverNow() {
    setDiscovering(true);
    setDiscoverMsg(null);
    try {
      const result = await api.discoverTokens();
      setDiscoverMsg(
        result.candidates === 0
          ? "No candidates returned — DexScreener's discovery feeds may be temporarily unavailable."
          : `Found ${result.candidates} trending Solana token(s), added ${result.added} new to the watchlist.`,
      );
      setWatchlist(await api.watchlist());
    } catch (err) {
      setDiscoverMsg((err as Error).message);
    } finally {
      setDiscovering(false);
    }
  }

  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await api.searchTokens(query));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function inspect(mint: string) {
    setBusy(true);
    setError(null);
    try {
      setSelected(await api.getToken(mint));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Panel
        title={`Watching (${watchlist.length})`}
        action={
          <button
            onClick={discoverNow}
            disabled={discovering}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {discovering ? "Discovering…" : "Discover Now"}
          </button>
        }
      >
        <p className="mb-3 text-xs text-white/40">
          While the bot is running it automatically pulls trending/boosted Solana tokens from DexScreener every 5 minutes and adds new ones here —
          you don't have to add tokens yourself. "Discover Now" runs that same pass immediately instead of waiting.
        </p>
        {discoverMsg && <p className="mb-3 text-xs text-violet-300">{discoverMsg}</p>}
        {watchlist.length === 0 ? (
          <p className="text-sm text-white/40">Nothing watched yet. Start the bot to let it auto-discover, or click "Discover Now".</p>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[#131318] text-xs uppercase text-white/40">
                <tr>
                  <th className="pb-2">Token</th>
                  <th className="pb-2">Mint</th>
                  <th className="pb-2">Added</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((w) => (
                  <tr key={w.mint} className="border-t border-white/5">
                    <td className="py-1.5">{w.symbol ?? <span className="text-white/30">unknown</span>}</td>
                    <td className="py-1.5 font-mono text-xs text-white/40">{shortMint(w.mint)}</td>
                    <td className="py-1.5 text-xs text-white/40">{new Date(w.addedAt).toLocaleTimeString()}</td>
                    <td className="py-1.5 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => inspect(w.mint)} className="rounded border border-white/15 px-2 py-0.5 text-xs hover:bg-white/10">
                          Details
                        </button>
                        {w.blocked ? (
                          <button
                            onClick={async () => {
                              await api.unblockToken(w.mint);
                              setWatchlist(await api.watchlist());
                            }}
                            className="rounded border border-white/15 px-2 py-0.5 text-xs hover:bg-white/10"
                          >
                            Unblock
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              await api.blockToken(w.mint);
                              setWatchlist(await api.watchlist());
                            }}
                            className="rounded border border-red-500/40 px-2 py-0.5 text-xs text-red-300 hover:bg-red-500/10"
                          >
                            Block
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            await api.removeWatchlist(w.mint);
                            setWatchlist(await api.watchlist());
                          }}
                          className="rounded border border-white/15 px-2 py-0.5 text-xs hover:bg-white/10"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Manual Search">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search by name, symbol, or mint address"
            className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-violet-500"
          />
          <button onClick={search} disabled={busy} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40">
            Search
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <p className="mt-2 text-xs text-white/40">Tokens are always identified by mint address, never by symbol alone — duplicate symbols are common and unverified.</p>

        {results.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-white/40">
                <tr>
                  <th className="pb-2">Token</th>
                  <th className="pb-2">Price</th>
                  <th className="pb-2">Liquidity</th>
                  <th className="pb-2">5m Vol</th>
                  <th className="pb-2">5m Chg</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((t) => (
                  <tr key={t.mint} className="border-t border-white/5">
                    <td className="py-2">
                      <p className="font-semibold">{t.symbol ?? "?"}</p>
                      <p className="font-mono text-xs text-white/40">
                        {t.mint.slice(0, 6)}…{t.mint.slice(-6)}
                      </p>
                    </td>
                    <td className="py-2">{t.priceUsd ? `$${t.priceUsd.toPrecision(4)}` : "—"}</td>
                    <td className="py-2">{t.liquidityUsd ? `$${Math.round(t.liquidityUsd).toLocaleString()}` : "—"}</td>
                    <td className="py-2">{t.volume5mUsd ? `$${Math.round(t.volume5mUsd).toLocaleString()}` : "—"}</td>
                    <td className={`py-2 ${t.priceChange5mPct != null && t.priceChange5mPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {t.priceChange5mPct != null ? `${t.priceChange5mPct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => inspect(t.mint)} className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10">
                          Details
                        </button>
                        <button
                          onClick={() => api.addWatchlist(t.mint, t.symbol ?? undefined, t.name ?? undefined)}
                          className="rounded border border-violet-500/40 px-2 py-1 text-xs text-violet-300 hover:bg-violet-500/10"
                        >
                          Watch
                        </button>
                        <button onClick={() => api.blockToken(t.mint)} className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">
                          Block
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selected && (
        <Panel title={`Token Detail — ${selected.snapshot.symbol ?? selected.snapshot.mint}`}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Price" value={selected.snapshot.priceUsd ? `$${selected.snapshot.priceUsd.toPrecision(4)}` : "—"} />
            <Stat label="Liquidity" value={selected.snapshot.liquidityUsd ? `$${Math.round(selected.snapshot.liquidityUsd).toLocaleString()}` : "—"} />
            <Stat label="Market Cap" value={selected.snapshot.marketCapUsd ? `$${Math.round(selected.snapshot.marketCapUsd).toLocaleString()}` : "—"} />
            <Stat label="5m Volume" value={selected.snapshot.volume5mUsd ? `$${Math.round(selected.snapshot.volume5mUsd).toLocaleString()}` : "—"} />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Badge tone={RISK_TONE[selected.security.riskLevel]}>{selected.security.riskLevel.toUpperCase()} RISK ({selected.security.riskScore}/100)</Badge>
            <span className="text-sm text-white/60">{selected.security.summary}</span>
          </div>

          <ul className="mt-3 space-y-1 text-sm">
            {selected.security.findings.map((f, i) => (
              <li key={i} className={f.status === "fail" ? "text-red-300" : f.status === "warning" ? "text-amber-300" : f.status === "unknown" ? "text-white/40" : "text-white/70"}>
                {f.status === "pass" ? "✓" : f.status === "fail" ? "✗" : f.status === "warning" ? "!" : "?"} {f.detail}
              </li>
            ))}
          </ul>
          {selected.security.missingChecks.length > 0 && (
            <p className="mt-2 text-xs text-white/40">Missing checks: {selected.security.missingChecks.join(", ")}</p>
          )}
        </Panel>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
