import { useEffect, useState } from "react";
import {
  api,
  type ArbExchangeHealth,
  type ArbJourney,
  type ArbOpportunity,
  type ArbStatus,
  type ArbStrategyConfig,
  type ArbTrade,
  type ArbWallet,
  type ExchangeId,
  type JourneyStatus,
  type LogEntry,
} from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Badge } from "./Badge.js";
import { NetworkMapPanel } from "./NetworkMapPanel.js";
import { ARB_BOT_HUB_LABEL, ARB_BOT_SERVICES, hintForDownProvider } from "./networkMapServices.js";
import { ArbSpreadChartPanel } from "./PriceLineChartPanel.js";
import { BotAnalyticsColumn, type PnlStats } from "./BotAnalyticsColumn.js";
import { TradeFeedList, type TradeFeedRow } from "./TradeFeedList.js";
import { SystemAlertsFeed } from "./SystemAlertsFeed.js";
import { PortfolioExposureDonut } from "./PortfolioExposureDonut.js";
import { logsToAlerts } from "../lib/alerts.js";

const ALL_EXCHANGES: ExchangeId[] = ["binance", "bybit", "okx", "kucoin", "gateio", "mexc", "kraken", "bitstamp"];

function arbPnlStats(trades: ArbTrade[]): PnlStats {
  const wins = trades.filter((t) => Number(t.netProfitUsd) > 0);
  const losses = trades.filter((t) => Number(t.netProfitUsd) < 0);
  const totalVolumeUsd = trades.reduce((s, t) => s + Number(t.notionalUsd), 0);
  const rois = trades.filter((t) => Number(t.notionalUsd) > 0).map((t) => (Number(t.netProfitUsd) / Number(t.notionalUsd)) * 100);
  return {
    closedTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : null,
    totalVolumeUsd,
    avgRoiPct: rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : null,
  };
}

export function ArbitragePanel() {
  const tick = useRefreshSignal();
  const [status, setStatus] = useState<ArbStatus | null>(null);
  const [wallet, setWallet] = useState<ArbWallet | null>(null);
  const [config, setConfig] = useState<ArbStrategyConfig | null>(null);
  const [opportunities, setOpportunities] = useState<ArbOpportunity[]>([]);
  const [trades, setTrades] = useState<ArbTrade[]>([]);
  const [journeys, setJourneys] = useState<ArbJourney[]>([]);
  const [exchangeHealth, setExchangeHealth] = useState<ArbExchangeHealth[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
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
    api.arbJourneys().then(setJourneys).catch(() => {});
    api.arbExchangeHealth().then(setExchangeHealth).catch(() => {});
    api.logs(200).then(setLogs).catch(() => {});
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
      <div className="rounded-sm border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-300">
        Paper-only: watches real public prices across {config.exchanges.length} exchanges and simulates buying low / selling high net of estimated fees.
        No real orders, no exchange API keys needed. A genuine cross-exchange price gap closes in seconds — real execution would need capital
        pre-funded on every exchange and much faster infrastructure than this. See it as a live "is there an edge here, and how big" instrument, not a
        money-printer.
      </div>

      <div className="flex flex-col gap-3 rounded-sm border border-white/10 bg-[#0B1017] p-4">
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
              className="rounded-sm bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
            >
              Start Scanner
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => run(() => api.arbStop())}
              className="rounded-sm bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-40"
            >
              Stop Scanner
            </button>
          )}

          <button
            disabled={busy}
            onClick={() => run(() => api.updateArbConfig({ enabled: !config.enabled }))}
            className="rounded-sm border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-40"
          >
            {config.enabled ? "Disable Strategy" : "Enable Strategy"}
          </button>

          {status.emergencyStopped ? (
            <button
              disabled={busy}
              onClick={() => run(() => api.arbResume())}
              className="ml-auto rounded-sm bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/30 disabled:opacity-40"
            >
              Resume From Emergency Stop
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => setShowEmergencyConfirm(true)}
              className="ml-auto rounded-sm bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-40"
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
            <div className="rounded-sm border border-sky-500/20 bg-sky-500/5 p-3">
              <p className="text-xs uppercase tracking-wide text-white/50">Cash balance</p>
              <p className="text-2xl font-bold text-sky-200">${Number(wallet.cashBalanceUsd).toFixed(2)}</p>
            </div>
            <div className="rounded-sm border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-white/50">Started at</p>
              <p className="text-2xl font-bold">${Number(wallet.startingBalanceUsd).toFixed(2)}</p>
            </div>
            <div className="rounded-sm border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-white/50">Realized PnL (24h)</p>
              <p className={`text-2xl font-bold ${Number(wallet.realizedPnl24hUsd) >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                ${Number(wallet.realizedPnl24hUsd).toFixed(2)}
              </p>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[260px_1fr_300px]">
        <BotAnalyticsColumn stats={arbPnlStats(trades)} />
        <ArbSpreadChartPanel />

        <div className="space-y-4">
          <TradeFeedList
            trades={trades.slice(0, 20).map(
              (t): TradeFeedRow => ({
                id: t.id,
                time: new Date(t.createdAt).toLocaleTimeString(),
                venue: `${t.buyExchange}→${t.sellExchange}`.toUpperCase(),
                side: "buy",
                symbol: t.symbol,
                amountUsd: Number(t.netProfitUsd),
              }),
            )}
            title="Simulated Trade Feed"
          />
          <SystemAlertsFeed alerts={logsToAlerts(logs, "arb_")} />
          <PortfolioExposureDonut
            title="Volume by Symbol"
            totalLabel="VOLUME"
            slices={Object.entries(
              trades.reduce<Record<string, number>>((acc, t) => {
                acc[t.symbol] = (acc[t.symbol] ?? 0) + Number(t.notionalUsd);
                return acc;
              }, {}),
            )
              .map(([symbol, notionalUsd]) => ({ symbol, notionalUsd }))
              .sort((a, b) => b.notionalUsd - a.notionalUsd)}
          />
        </div>
      </div>

      <NetworkMapPanel title="Network Map — Exchanges" hubLabel={ARB_BOT_HUB_LABEL} services={ARB_BOT_SERVICES} hintForDownProvider={(id) => hintForDownProvider(id)} />

      <Panel title="Exchange Health">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-white/40">
              <tr>
                <th className="pb-1 pr-3">Exchange</th>
                <th className="pb-1 pr-3">API Key</th>
                <th className="pb-1 pr-3">Coin Identity Data</th>
                <th className="pb-1 pr-3">Real Balance</th>
                <th className="pb-1 pr-3">Bot Capital In Flight</th>
                <th className="pb-1">Last Error</th>
              </tr>
            </thead>
            <tbody className="font-mono text-white/70">
              {exchangeHealth.map((h) => (
                <tr key={h.exchange} className="border-t border-white/5">
                  <td className="py-1 pr-3 font-semibold text-white/80">{h.exchange.toUpperCase()}</td>
                  <td className="py-1 pr-3">
                    <Badge tone={h.apiKeyConfigured ? "good" : "warn"}>{h.apiKeyConfigured ? "CONFIGURED" : "NOT SET"}</Badge>
                  </td>
                  <td className="py-1 pr-3">
                    <Badge tone={h.identityDataCached ? "good" : "neutral"}>
                      {h.identityDataCached ? `${h.identitySymbolCount} SYMBOLS` : "PENDING"}
                    </Badge>
                  </td>
                  <td className="py-1 pr-3">
                    {h.realBalance.hasRealFunds === null ? (
                      <span className="text-white/30">unknown</span>
                    ) : (
                      <Badge tone={h.realBalance.hasRealFunds ? "accent" : "neutral"}>{h.realBalance.hasRealFunds ? "HAS FUNDS" : "EMPTY"}</Badge>
                    )}
                  </td>
                  <td className="py-1 pr-3 text-white/70">${Number(h.botCommittedCapitalUsd).toFixed(2)}</td>
                  <td className="py-1 max-w-[260px] truncate text-red-300/80" title={h.lastError ?? ""}>
                    {h.lastError ? h.lastError : <span className="text-white/20">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-white/30">
          Real balances are informational only — the bot never trades against them, and existing funds on any exchange are never touched. Last error
          covers both public market-data calls and (if configured) authenticated deposit/balance checks for that exchange — hover to see the full message.
        </p>
      </Panel>

      <Panel title={`Journeys (${journeys.filter((j) => j.status !== "closed").length} active, ${journeys.length} total)`}>
        {journeys.length === 0 ? (
          <p className="text-sm text-white/40">No journeys yet — a journey opens once a qualifying opportunity clears the identity, deposit, and spread gates.</p>
        ) : (
          <div className="space-y-1.5">
            {journeys.slice(0, 25).map((j) => (
              <JourneyRow key={j.id} journey={j} busy={busy} onAbort={(reason) => run(() => api.arbAbortJourney(j.id, reason))} />
            ))}
          </div>
        )}
      </Panel>

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
    <div className="flex flex-wrap items-center gap-2 rounded-sm border border-white/5 bg-black/20 px-3 py-2 font-mono text-xs">
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

const JOURNEY_STATUS_TONE: Record<JourneyStatus, "neutral" | "good" | "warn" | "danger" | "accent"> = {
  in_transit: "accent",
  checking_reverse: "warn",
  returning_home: "warn",
  closed: "good",
};

function JourneyRow({ journey, busy, onAbort }: { journey: ArbJourney; busy: boolean; onAbort: (reason: string) => void }) {
  const profit = Number(journey.realizedProfitUsd);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-sm border border-white/5 bg-black/20 px-3 py-2 font-mono text-xs">
      <Badge tone={JOURNEY_STATUS_TONE[journey.status]}>{journey.status.replace("_", " ").toUpperCase()}</Badge>
      <span className="font-semibold text-white/80">{journey.symbol}</span>
      <span className="text-white/50">
        {journey.originExchange} → {journey.currentExchange}
        {journey.legDestinationExchange ? ` → ${journey.legDestinationExchange}` : ""}
      </span>
      <span className="text-white/40">principal ${Number(journey.principalUsd).toFixed(2)}</span>
      <Badge tone={profit >= 0 ? "good" : "danger"}>{profit >= 0 ? "+" : ""}${profit.toFixed(2)}</Badge>
      <span className="text-white/30">leg {journey.legCount}</span>
      {journey.closeReason && <span className="text-white/30">{journey.closeReason}</span>}
      {journey.status !== "closed" && (
        <button
          disabled={busy}
          onClick={() => onAbort("Manually aborted from dashboard.")}
          className="ml-auto rounded border border-red-500/40 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
        >
          ABORT
        </button>
      )}
      <span className={journey.status === "closed" ? "text-white/30" : "ml-auto text-white/30"}>{new Date(journey.openedAt).toLocaleTimeString()}</span>
    </div>
  );
}

function ConfigEditor({ config, busy, onSave }: { config: ArbStrategyConfig; busy: boolean; onSave: (patch: Partial<ArbStrategyConfig>) => void }) {
  const [draft, setDraft] = useState(config);
  const [symbolsText, setSymbolsText] = useState(config.symbols.join(","));
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  useEffect(() => {
    setDraft(config);
    setSymbolsText(config.symbols.join(","));
  }, [config]);

  async function loadRecommendedSymbols() {
    setLoadingDefaults(true);
    try {
      const symbols = await api.arbDefaultSymbols();
      setSymbolsText(symbols.join(","));
      setDraft((d) => ({ ...d, symbols }));
    } finally {
      setLoadingDefaults(false);
    }
  }

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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase text-white/50">Coins (comma-separated base symbols, e.g. BTC,ETH,SOL) — {draft.symbols.length} currently</h4>
          <button
            type="button"
            disabled={loadingDefaults}
            onClick={loadRecommendedSymbols}
            className="rounded border border-sky-500/40 px-2 py-1 text-[10px] font-mono text-sky-300 hover:bg-sky-500/10 disabled:opacity-40"
          >
            {loadingDefaults ? "Loading…" : "Load Recommended (~540) Coins"}
          </button>
        </div>
        <textarea
          value={symbolsText}
          onChange={(e) => {
            setSymbolsText(e.target.value);
            setDraft({ ...draft, symbols: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) });
          }}
          rows={4}
          className="w-full resize-y rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm font-mono outline-none focus:border-sky-500"
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
          {field("minMarketCapUsd", "Min market cap $", 1_000_000)}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-white/50">Journey simulation</h4>
        <p className="mb-2 text-[10px] text-white/30">
          Models the real sequence — buy, withdraw, wait for transfer, sell — instead of an instant simultaneous fill on both exchanges.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {field("simulatedWithdrawalFeeUsd", "Withdrawal fee $ (per leg)", 0.5)}
          {field("simulatedTransferMinutes", "Transfer time (min)", 1)}
          {field("reverseCheckWindowSeconds", "Reverse-check window (s)", 5)}
          {field("maxConcurrentJourneys", "Max concurrent journeys", 1)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDraft({ ...draft, requireCoinIdentityVerified: !draft.requireCoinIdentityVerified })}
            className={`rounded-md border px-3 py-1.5 text-xs font-mono ${
              draft.requireCoinIdentityVerified ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-white/15 text-white/50 hover:bg-white/10"
            }`}
          >
            {draft.requireCoinIdentityVerified ? "✓ " : ""}Require coin-identity verified
          </button>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, requireDepositVerified: !draft.requireDepositVerified })}
            className={`rounded-md border px-3 py-1.5 text-xs font-mono ${
              draft.requireDepositVerified ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-white/15 text-white/50 hover:bg-white/10"
            }`}
          >
            {draft.requireDepositVerified ? "✓ " : ""}Require deposit-status verified
          </button>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, requireMinMarketCap: !draft.requireMinMarketCap })}
            className={`rounded-md border px-3 py-1.5 text-xs font-mono ${
              draft.requireMinMarketCap ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-white/15 text-white/50 hover:bg-white/10"
            }`}
          >
            {draft.requireMinMarketCap ? "✓ " : ""}Require min market cap
          </button>
        </div>
      </div>

      <button
        disabled={busy}
        onClick={() => onSave(draft)}
        className="rounded-sm bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
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
      <div className="w-full max-w-md rounded-sm border border-white/10 bg-[#0D131A] p-6 shadow-2xl">
        <h3 className="mb-3 text-lg font-bold">{title}</h3>
        {body}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-sm px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10">
            Cancel
          </button>
          <button onClick={onConfirm} className="rounded-sm bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
