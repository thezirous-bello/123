import { useEffect, useState } from "react";
import { api, type ArbOpportunity, type ArbStatus, type ArbStrategyConfig, type ArbTrade, type ArbWallet, type ExchangeId } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Badge } from "./Badge.js";
import { NetworkMapPanel } from "./NetworkMapPanel.js";
import { ARB_BOT_HUB_LABEL, ARB_BOT_SERVICES, hintForDownProvider } from "./networkMapServices.js";

const ALL_EXCHANGES: ExchangeId[] = ["binance", "bybit", "okx", "kucoin", "gateio", "mexc"];

export function ArbitragePanel() {
  const tick = useRefreshSignal();
  const [status, setStatus] = useState<ArbStatus | null>(null);
  const [wallet, setWallet] = useState<ArbWallet | null>(null);
  const [config, setConfig] = useState<ArbStrategyConfig | null>(null);
  const [opportunities, setOpportunities] = useState<ArbOpportunity[]>([]);
  const [trades, setTrades] = useState<ArbTrade[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  function refresh() {
    api.arbStatus().then(setStatus).catch(() => {});
    api.arbWallet().then(setWallet).catch(() => {});
    api.arbConfig().then(setConfig).catch(() => {});
    api.arbOpportunities().then(setOpportunities).catch(() => {});
    api.arbTrades().then(setTrades).catch(() => {});
  }

  useEffect(refresh, [tick]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!status || !config) {
    return (
      <Panel title="Arbitrage Scanner">
        <p className="text-sm text-white/40">Loading…</p>
      </Panel>
    );
  }

  const actedTrades = opportunities.filter((o) => o.acted).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-300">
        Paper-only: watches real public prices across {config.exchanges.length} exchanges and simulates buying low / selling high net of estimated fees.
        No real orders, no exchange API keys needed. A genuine cross-exchange price gap closes in seconds — real execution would need capital
        pre-funded on every exchange and much faster infrastructure than this. See it as a live "is there an edge here, and how big" instrument, not a
        money-printer.
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#131318] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.running ? "good" : "neutral"}>{status.running ? "RUNNING" : "STOPPED"}</Badge>
          <Badge tone={status.strategyEnabled ? "good" : "warn"}>{status.strategyEnabled ? "STRATEGY ENABLED" : "STRATEGY DISABLED"}</Badge>
          {status.emergencyStopped && <Badge tone="danger">EMERGENCY STOPPED</Badge>}
          <Badge tone="accent">{status.totalScans} SCANS</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!status.running ? (
            <button
              disabled={busy || status.emergencyStopped}
              onClick={() => run(() => api.arbStart())}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
            >
              Start Scanner
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => run(() => api.arbStop())}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-40"
            >
              Stop Scanner
            </button>
          )}

          <button
            disabled={busy}
            onClick={() => run(() => api.updateArbConfig({ enabled: !config.enabled }))}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-40"
          >
            {config.enabled ? "Disable Strategy" : "Enable Strategy"}
          </button>

          {status.emergencyStopped ? (
            <button
              disabled={busy}
              onClick={() => run(() => api.arbResume())}
              className="ml-auto rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/30 disabled:opacity-40"
            >
              Resume From Emergency Stop
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => setShowEmergencyConfirm(true)}
              className="ml-auto rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-40"
            >
              EMERGENCY STOP
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {showEmergencyConfirm && (
          <ConfirmModal
            title="Trigger arbitrage emergency stop?"
            body={
              <div className="space-y-2 text-sm text-white/80">
                <p>This immediately stops the scanner and blocks new simulated trades.</p>
                <label className="block text-xs uppercase tracking-wide text-white/50">Reason (recorded in the audit log)</label>
                <input
                  autoFocus
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  placeholder="e.g. unexpected behavior"
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-sky-500"
                />
              </div>
            }
            confirmLabel="Trigger Emergency Stop"
            onCancel={() => setShowEmergencyConfirm(false)}
            onConfirm={() =>
              run(async () => {
                await api.arbEmergencyStop(emergencyReason || "No reason given.");
                setShowEmergencyConfirm(false);
                setEmergencyReason("");
              })
            }
          />
        )}
      </div>

      {wallet && (
        <Panel title="Arbitrage Paper Balance">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
              <p className="text-xs uppercase tracking-wide text-white/50">Cash balance</p>
              <p className="text-2xl font-bold text-sky-200">${Number(wallet.cashBalanceUsd).toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-white/50">Started at</p>
              <p className="text-2xl font-bold">${Number(wallet.startingBalanceUsd).toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-white/50">Realized PnL (24h)</p>
              <p className={`text-2xl font-bold ${Number(wallet.realizedPnl24hUsd) >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                ${Number(wallet.realizedPnl24hUsd).toFixed(2)}
              </p>
            </div>
          </div>
        </Panel>
      )}

      <NetworkMapPanel title="Network Map — Exchanges" hubLabel={ARB_BOT_HUB_LABEL} services={ARB_BOT_SERVICES} hintForDownProvider={(id) => hintForDownProvider(id)} />

      <Panel
        title="Strategy Config"
        action={
          <button onClick={() => setShowConfig((v) => !v)} className="rounded border border-white/15 px-2 py-1 text-[10px] font-mono text-white/50 hover:bg-white/10">
            {showConfig ? "HIDE" : "EDIT"}
          </button>
        }
      >
        {!showConfig ? (
          <p className="font-mono text-xs text-white/50">
            Watching {config.symbols.length} coins across {config.exchanges.join(", ")} · scan every {config.scanIntervalSeconds}s · $
            {config.positionSizeUsd}/trade · min net spread {config.minNetSpreadPct}% · max {config.maxTradesPerScan}/scan
          </p>
        ) : (
          <ConfigEditor config={config} busy={busy} onSave={(patch) => run(() => api.updateArbConfig(patch))} />
        )}
      </Panel>

      <Panel title={`Opportunities (${opportunities.length} recent, ${actedTrades} acted)`}>
        {opportunities.length === 0 ? (
          <p className="text-sm text-white/40">No opportunities scanned yet — start the scanner and enable the strategy.</p>
        ) : (
          <div className="space-y-1.5">
            {opportunities.slice(0, 25).map((o) => (
              <OpportunityRow key={o.id} opportunity={o} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title={`Simulated Trades (${trades.length})`}>
        {trades.length === 0 ? (
          <p className="text-sm text-white/40">No simulated trades yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="text-white/40">
                <tr>
                  <th className="pb-1 pr-3">Symbol</th>
                  <th className="pb-1 pr-3">Buy</th>
                  <th className="pb-1 pr-3">Sell</th>
                  <th className="pb-1 pr-3">Qty</th>
                  <th className="pb-1 pr-3">Net Profit</th>
                  <th className="pb-1">When</th>
                </tr>
              </thead>
              <tbody className="font-mono text-white/70">
                {trades.slice(0, 30).map((t) => (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="py-1 pr-3 font-semibold text-white/80">{t.symbol}</td>
                    <td className="py-1 pr-3">
                      {t.buyExchange} @ {Number(t.buyPrice).toFixed(4)}
                    </td>
                    <td className="py-1 pr-3">
                      {t.sellExchange} @ {Number(t.sellPrice).toFixed(4)}
                    </td>
                    <td className="py-1 pr-3">{Number(t.qty).toFixed(4)}</td>
                    <td className="py-1 pr-3 text-emerald-300">+${Number(t.netProfitUsd).toFixed(2)}</td>
                    <td className="py-1 text-white/40">{new Date(t.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function OpportunityRow({ opportunity }: { opportunity: ArbOpportunity }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 font-mono text-xs">
      <Badge tone={opportunity.acted ? "good" : "neutral"}>{opportunity.acted ? "TRADED" : "SKIPPED"}</Badge>
      <span className="font-semibold text-white/80">{opportunity.symbol}</span>
      <span className="text-white/50">
        buy {opportunity.buyExchange} ${Number(opportunity.buyPrice).toFixed(4)} → sell {opportunity.sellExchange} ${Number(opportunity.sellPrice).toFixed(4)}
      </span>
      <Badge tone={Number(opportunity.netSpreadPct) > 0 ? "accent" : "neutral"}>net {Number(opportunity.netSpreadPct).toFixed(3)}%</Badge>
      {opportunity.skipReason && <span className="text-white/30">{opportunity.skipReason}</span>}
      <span className="ml-auto text-white/30">{new Date(opportunity.createdAt).toLocaleTimeString()}</span>
    </div>
  );
}

function ConfigEditor({ config, busy, onSave }: { config: ArbStrategyConfig; busy: boolean; onSave: (patch: Partial<ArbStrategyConfig>) => void }) {
  const [draft, setDraft] = useState(config);
  const [symbolsText, setSymbolsText] = useState(config.symbols.join(","));

  useEffect(() => {
    setDraft(config);
    setSymbolsText(config.symbols.join(","));
  }, [config]);

  function field<K extends keyof ArbStrategyConfig>(key: K, label: string, step = 0.01) {
    const value = draft[key];
    return (
      <label key={key} className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-white/40">{label}</span>
        <input
          type="number"
          step={step}
          value={value as number}
          onChange={(e) => setDraft({ ...draft, [key]: Number.parseFloat(e.target.value) })}
          className="rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm outline-none focus:border-sky-500"
        />
      </label>
    );
  }

  function toggleExchange(id: ExchangeId) {
    const exists = draft.exchanges.includes(id);
    const next = exists ? draft.exchanges.filter((e) => e !== id) : [...draft.exchanges, id];
    setDraft({ ...draft, exchanges: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-white/50">Exchanges</h4>
        <div className="flex flex-wrap gap-2">
          {ALL_EXCHANGES.map((id) => (
            <button
              key={id}
              onClick={() => toggleExchange(id)}
              className={`rounded-md border px-3 py-1.5 text-xs font-mono ${
                draft.exchanges.includes(id) ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-white/15 text-white/50 hover:bg-white/10"
              }`}
            >
              {id.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-white/50">Coins (comma-separated base symbols, e.g. BTC,ETH,SOL)</h4>
        <input
          value={symbolsText}
          onChange={(e) => {
            setSymbolsText(e.target.value);
            setDraft({ ...draft, symbols: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) });
          }}
          className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm font-mono outline-none focus:border-sky-500"
        />
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-white/50">Scan / sizing</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {field("scanIntervalSeconds", "Scan interval (s)", 1)}
          {field("positionSizeUsd", "Position size $", 1)}
          {field("maxTradesPerScan", "Max trades / scan", 1)}
          {field("perSymbolCooldownSeconds", "Per-symbol cooldown (s)", 1)}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-white/50">Spread / fees</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {field("minNetSpreadPct", "Min net spread %")}
          {field("safetyBufferPct", "Safety buffer %")}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-white/40">Taker fee override % (blank = per-exchange default)</span>
            <input
              type="number"
              step={0.01}
              value={draft.takerFeePctOverride ?? ""}
              onChange={(e) => setDraft({ ...draft, takerFeePctOverride: e.target.value === "" ? null : Number.parseFloat(e.target.value) })}
              className="rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm outline-none focus:border-sky-500"
            />
          </label>
          {field("startingBalanceUsd", "Paper starting balance $", 100)}
        </div>
      </div>

      <button
        disabled={busy}
        onClick={() => onSave(draft)}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
      >
        Save Config
      </button>
    </div>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#17171f] p-6 shadow-2xl">
        <h3 className="mb-3 text-lg font-bold">{title}</h3>
        {body}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10">
            Cancel
          </button>
          <button onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
