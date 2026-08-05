import { useEffect, useState } from "react";
import { api, type SpotPosition, type SpotSignal, type SpotStatus, type SpotStrategyConfig, type SpotTrade, type SpotWallet } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Badge } from "./Badge.js";
import { BybitWalletCard } from "./BybitWalletCard.js";
import { NetworkMapPanel } from "./NetworkMapPanel.js";
import { ALL_BOT_SERVICES, ALL_BOTS_HUB_LABEL, hintForDownProvider } from "./networkMapServices.js";

export function SpotPanel() {
  const tick = useRefreshSignal();
  const [status, setStatus] = useState<SpotStatus | null>(null);
  const [wallet, setWallet] = useState<SpotWallet | null>(null);
  const [config, setConfig] = useState<SpotStrategyConfig | null>(null);
  const [signals, setSignals] = useState<SpotSignal[]>([]);
  const [positions, setPositions] = useState<SpotPosition[]>([]);
  const [trades, setTrades] = useState<SpotTrade[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModeConfirm, setShowModeConfirm] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  function refresh() {
    api.spotStatus().then(setStatus).catch(() => {});
    api.spotConfig().then(setConfig).catch(() => {});
    api.spotSignals().then(setSignals).catch(() => {});
    api.spotPositions().then(setPositions).catch(() => {});
    api.spotTrades().then(setTrades).catch(() => {});
  }

  useEffect(refresh, [tick]);
  useEffect(() => {
    if (status) api.spotWallet(status.mode).then(setWallet).catch(() => {});
  }, [status?.mode, tick]);

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
      <Panel title="Bybit Spot Bot">
        <p className="text-sm text-white/40">Loading…</p>
      </Panel>
    );
  }

  const openPositions = positions.filter((p) => p.status === "open");
  const closedPositions = positions.filter((p) => p.status === "closed");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#131318] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.running ? "good" : "neutral"}>{status.running ? "RUNNING" : "STOPPED"}</Badge>
          <Badge tone={status.mode === "live" ? "danger" : "accent"}>{status.mode === "live" ? "LIVE (MAINNET)" : "TESTNET"}</Badge>
          <Badge tone={status.testnetConfigured ? "good" : "warn"}>{status.testnetConfigured ? "TESTNET KEYS SET" : "NO TESTNET KEYS"}</Badge>
          <Badge tone={config.enabled ? "good" : "warn"}>{config.enabled ? "STRATEGY ENABLED" : "STRATEGY DISABLED"}</Badge>
          {status.emergencyStopped && <Badge tone="danger">EMERGENCY STOPPED</Badge>}
          {!status.liveTradingAllowedByConfig && <Badge tone="neutral">LIVE TRADING DISABLED BY SERVER CONFIG</Badge>}
          {status.consecutiveLosses > 0 && <Badge tone="warn">{status.consecutiveLosses} CONSECUTIVE LOSS(ES)</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!status.running ? (
            <button
              disabled={busy || status.emergencyStopped}
              onClick={() => run(() => api.spotStart())}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
            >
              Start Spot Bot
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => run(() => api.spotStop())}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-40"
            >
              Stop Spot Bot
            </button>
          )}

          <button
            disabled={busy}
            onClick={() => run(() => api.updateSpotConfig({ enabled: !config.enabled }))}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-40"
          >
            {config.enabled ? "Disable Strategy" : "Enable Strategy"}
          </button>

          {status.mode === "testnet" ? (
            <button
              disabled={busy}
              onClick={() => setShowModeConfirm(true)}
              className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
            >
              Request Live (Mainnet) Spot Trading
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => run(() => api.spotSetMode("testnet", true))}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-40"
            >
              Switch to Testnet
            </button>
          )}

          {status.emergencyStopped ? (
            <button
              disabled={busy}
              onClick={() => run(() => api.spotResume())}
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

        {wallet && (
          <p className="font-mono text-xs text-white/50">
            {wallet.configured ? (
              <>
                {status.mode.toUpperCase()} equity: <span className="text-white/80">${wallet.totalEquityUsd?.toFixed(2) ?? "—"}</span> · available: $
                {wallet.availableBalanceUsd?.toFixed(2) ?? "—"}
              </>
            ) : (
              `No Bybit ${status.mode} API keys configured — set BYBIT_${status.mode === "testnet" ? "TESTNET_" : ""}API_KEY / _SECRET in .env.`
            )}
          </p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {showModeConfirm && (
          <ConfirmModal
            title="Enable live (mainnet) spot trading?"
            danger
            body={
              <div className="space-y-2 text-sm text-white/80">
                <p>This switches the spot bot to LIVE mode. Real spot buy orders will be placed on Bybit mainnet with your real balance.</p>
                <ul className="list-disc space-y-1 pl-5 text-white/60">
                  <li>Spot coins can lose value quickly — a stop-loss can still fill below its intended price in fast markets.</li>
                  <li>No leverage here, but the full position is still real money at risk, not virtual.</li>
                  <li>Only fund this account with money you can afford to lose.</li>
                </ul>
                {!status.liveTradingAllowedByConfig && (
                  <p className="font-semibold text-red-300">Blocked: the server .env has SPOT_LIVE_TRADING_ENABLED=false.</p>
                )}
              </div>
            }
            confirmLabel="I understand the risk — enable live trading"
            onCancel={() => setShowModeConfirm(false)}
            onConfirm={() =>
              run(async () => {
                await api.spotSetMode("live", true);
                setShowModeConfirm(false);
              })
            }
          />
        )}

        {showEmergencyConfirm && (
          <ConfirmModal
            title="Trigger spot emergency stop?"
            danger
            body={
              <div className="space-y-2 text-sm text-white/80">
                <p>This immediately stops the spot bot and blocks all new signals/entries. Open positions stay open — close them manually below if needed.</p>
                <label className="block text-xs uppercase tracking-wide text-white/50">Reason (recorded in the audit log)</label>
                <input
                  autoFocus
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  placeholder="e.g. unexpected behavior, market conditions"
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-violet-500"
                />
              </div>
            }
            confirmLabel="Trigger Emergency Stop"
            onCancel={() => setShowEmergencyConfirm(false)}
            onConfirm={() =>
              run(async () => {
                await api.spotEmergencyStop(emergencyReason || "No reason given.");
                setShowEmergencyConfirm(false);
                setEmergencyReason("");
              })
            }
          />
        )}
      </div>

      <BybitWalletCard botLabel="Bybit Spot" wallet={wallet} />

      <NetworkMapPanel title="Network Map — All Bots" hubLabel={ALL_BOTS_HUB_LABEL} services={ALL_BOT_SERVICES} hintForDownProvider={(id) => hintForDownProvider(id)} />

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
            {config.symbolUniverse === "all"
              ? "Scanning all Bybit symbols above the liquidity floor"
              : config.symbolUniverse === "auto"
                ? `Auto-scanning top ${config.autoTopNByVolume} symbols by 24h volume`
                : `${config.manualSymbols.length} manual symbol(s)`}{" "}
            · risk{" "}
            {config.riskPerTradePct}%/trade · max {config.maxActiveTrades} active, {config.maxPendingSignals} pending · daily loss
            limit {config.dailyMaxLossPct}% · halt after {config.stopAfterConsecutiveLosses} losses
          </p>
        ) : (
          <ConfigEditor config={config} busy={busy} onSave={(patch) => run(() => api.updateSpotConfig(patch))} />
        )}
      </Panel>

      <Panel title={`Signals (${signals.filter((s) => s.status === "pending" || s.status === "active").length} pending/active)`}>
        {signals.length === 0 ? (
          <p className="text-sm text-white/40">No signals yet — the bot scans every ~3 minutes once the strategy is enabled and running.</p>
        ) : (
          <div className="space-y-1.5">
            {signals.slice(0, 20).map((s) => (
              <SignalRow key={s.id} signal={s} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title={`Open Positions (${openPositions.length})`}>
        {openPositions.length === 0 ? (
          <p className="text-sm text-white/40">No open spot positions.</p>
        ) : (
          <div className="space-y-2">
            {openPositions.map((p) => (
              <PositionRow key={p.id} position={p} onClose={() => run(() => api.closeSpotPosition(p.id))} busy={busy} />
            ))}
          </div>
        )}
      </Panel>

      {closedPositions.length > 0 && (
        <Panel title={`Closed Positions (${closedPositions.length})`}>
          <div className="space-y-1.5">
            {closedPositions.slice(0, 15).map((p) => (
              <PositionRow key={p.id} position={p} />
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Recent Trades">
        {trades.length === 0 ? (
          <p className="text-sm text-white/40">No trades yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="text-white/40">
                <tr>
                  <th className="pb-1 pr-3">Symbol</th>
                  <th className="pb-1 pr-3">Side</th>
                  <th className="pb-1 pr-3">Mode</th>
                  <th className="pb-1 pr-3">Qty</th>
                  <th className="pb-1 pr-3">Price</th>
                  <th className="pb-1 pr-3">Status</th>
                  <th className="pb-1">When</th>
                </tr>
              </thead>
              <tbody className="font-mono text-white/70">
                {trades.slice(0, 30).map((t) => (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="py-1 pr-3">{t.symbol}</td>
                    <td className="py-1 pr-3">{t.side}</td>
                    <td className="py-1 pr-3">{t.mode}</td>
                    <td className="py-1 pr-3">{t.qty}</td>
                    <td className="py-1 pr-3">${t.price_usd}</td>
                    <td className="py-1 pr-3">
                      <Badge tone={t.status === "confirmed" ? "good" : t.status === "failed" ? "danger" : "neutral"}>{t.status}</Badge>
                    </td>
                    <td className="py-1 text-white/40">{new Date(t.created_at).toLocaleTimeString()}</td>
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

function SignalRow({ signal }: { signal: SpotSignal }) {
  const tone = signal.status === "filled" ? "good" : signal.status === "cancelled" || signal.status === "expired" ? "danger" : "accent";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 font-mono text-xs">
      <Badge tone={tone}>{signal.status.toUpperCase()}</Badge>
      <span className="font-semibold text-white/80">{signal.symbol}</span>
      <span className="text-white/50">{signal.side}</span>
      <span className="text-white/50">entry ${signal.entryPrice}</span>
      <span className="text-white/50">sl ${signal.stopLoss}</span>
      <span className="text-white/50">score {Number(signal.score).toFixed(1)}</span>
      {signal.cancelledReason && <span className="text-red-300">{signal.cancelledReason}</span>}
      <span className="ml-auto text-white/30">{new Date(signal.createdAt).toLocaleTimeString()}</span>
    </div>
  );
}

function PositionRow({ position, onClose, busy }: { position: SpotPosition; onClose?: () => void; busy?: boolean }) {
  const pnl = Number(position.realizedPnlUsd);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 font-mono text-xs">
      <Badge tone="good">LONG</Badge>
      <span className="font-semibold text-white/80">{position.symbol}</span>
      <Badge tone={position.mode === "live" ? "danger" : "accent"}>{position.mode}</Badge>
      <span className="text-white/50">qty {position.remainingQty}</span>
      <span className="text-white/50">entry ${position.entryPrice}</span>
      <span className="text-white/50">sl ${position.stopLoss}</span>
      {position.trailingActive && <Badge tone="accent">TRAILING ${position.trailingStopPrice}</Badge>}
      <span className={pnl >= 0 ? "text-emerald-300" : "text-red-300"}>${pnl.toFixed(2)}</span>
      {position.closeReason && <span className="text-white/40">({position.closeReason})</span>}
      {onClose && (
        <button
          disabled={busy}
          onClick={onClose}
          className="ml-auto rounded border border-red-500/40 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
        >
          Close
        </button>
      )}
    </div>
  );
}

function ConfigEditor({ config, busy, onSave }: { config: SpotStrategyConfig; busy: boolean; onSave: (patch: Partial<SpotStrategyConfig>) => void }) {
  const [draft, setDraft] = useState(config);

  useEffect(() => setDraft(config), [config]);

  function field<K extends keyof SpotStrategyConfig>(key: K, label: string, step = 0.01) {
    const value = draft[key];
    return (
      <label key={key} className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-white/40">{label}</span>
        <input
          type="number"
          step={step}
          value={value as number}
          onChange={(e) => setDraft({ ...draft, [key]: Number.parseFloat(e.target.value) })}
          className="rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm outline-none focus:border-violet-500"
        />
      </label>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-white/50">Symbol universe</h4>
        <div className="flex items-center gap-3">
          <select
            value={draft.symbolUniverse}
            onChange={(e) => setDraft({ ...draft, symbolUniverse: e.target.value as "auto" | "all" | "manual" })}
            className="rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm"
          >
            <option value="all">All (every Bybit symbol above the liquidity floor)</option>
            <option value="auto">Auto (top N by 24h volume)</option>
            <option value="manual">Manual list</option>
          </select>
          {draft.symbolUniverse === "auto" && field("autoTopNByVolume", "Top N symbols", 1)}
        </div>
        {draft.symbolUniverse === "manual" && (
          <input
            value={draft.manualSymbols.join(",")}
            onChange={(e) => setDraft({ ...draft, manualSymbols: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) })}
            placeholder="BTCUSDT,ETHUSDT,SOLUSDT"
            className="mt-2 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1 text-sm"
          />
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-white/50">Stage 1 — signal generation</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {field("atrOverCloseMax", "Max ATR/Close")}
          {field("stddev30Max", "Max 30p StdDev")}
          {field("latestRangeAtrMultMax", "Max range/ATR")}
          {field("min24hTurnoverUsd", "Min 24h turnover $", 100000)}
          {field("volumeSpikeMultiplier", "Volume spike x")}
          {field("maxSpreadPct", "Max spread %")}
          {field("stochRsiKMax", "Max StochRSI K", 1)}
          {field("rsiMin", "Min RSI", 1)}
          {field("rsiMax", "Max RSI", 1)}
          {field("slAtrMultiplier", "SL ATR mult")}
          {field("maxStopLossDistancePct", "Max SL distance %")}
          {field("minRiskReward", "Min risk:reward")}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-white/50">Stage 2 — validation</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {field("maxPendingSignals", "Max pending signals", 1)}
          {field("maxActiveTrades", "Max active trades", 1)}
          {field("fearGreedRejectBelow", "F&G reject below", 1)}
          {field("fearGreedReduceSizeAbove", "F&G reduce size above", 1)}
          {field("entryPriceMaxDriftPct", "Max entry drift %")}
          {field("signalExpiryMinutes", "Signal expiry (min)", 1)}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-white/50">Trade management</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {field("riskPerTradePct", "Risk % / trade")}
          {field("tp1ClosePct", "TP1 close %", 1)}
          {field("tp2ClosePct", "TP2 close %", 1)}
          {field("trailingAtrMultiplier", "Trailing ATR mult")}
          {field("stopAfterConsecutiveLosses", "Halt after N losses", 1)}
          {field("dailyMaxLossPct", "Daily max loss %")}
        </div>
      </div>

      <button
        disabled={busy}
        onClick={() => onSave(draft)}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
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
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
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
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-bold text-white ${danger ? "bg-red-600 hover:bg-red-500" : "bg-violet-600 hover:bg-violet-500"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
