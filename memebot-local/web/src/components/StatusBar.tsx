import { useState } from "react";
import { api, type BotStatus } from "../api/client.js";
import { Badge } from "./Badge.js";

export function StatusBar({ status, onChanged }: { status: BotStatus | null; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [showModeConfirm, setShowModeConfirm] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!status) return null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-white/10 bg-[#0B1017] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.running ? "good" : "neutral"}>{status.running ? "RUNNING" : "STOPPED"}</Badge>
        <Badge tone={status.mode === "live" ? "danger" : "accent"}>{status.mode === "live" ? "LIVE" : "PAPER"}</Badge>
        <Badge tone="neutral">DEVNET/MAINNET SET VIA SOLANA_RPC_URL</Badge>
        <Badge tone={status.walletConfigured ? "good" : "warn"}>{status.walletConfigured ? "TRADING WALLET CONFIGURED" : "NO TRADING WALLET"}</Badge>
        {status.emergencyStopped && <Badge tone="danger">EMERGENCY STOPPED</Badge>}
        {!status.liveTradingAllowedByConfig && <Badge tone="neutral">LIVE TRADING DISABLED BY SERVER CONFIG</Badge>}
        {status.activeStrategy && <Badge tone="accent">Strategy: {status.activeStrategy.name}</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!status.running ? (
          <button
            disabled={busy || status.emergencyStopped}
            onClick={() => run(() => api.start())}
            className="rounded-sm bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          >
            Start Bot
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => run(() => api.stop())}
            className="rounded-sm bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-40"
          >
            Stop Bot
          </button>
        )}

        {status.mode === "paper" ? (
          <button
            disabled={busy}
            onClick={() => setShowModeConfirm(true)}
            className="rounded-sm border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
          >
            Request Live Trading
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => run(() => api.setMode("paper", true))}
            className="rounded-sm border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-40"
          >
            Switch to Paper
          </button>
        )}

        {status.emergencyStopped ? (
          <button
            disabled={busy}
            onClick={() => setShowResumeConfirm(true)}
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

      {showModeConfirm && (
        <ConfirmModal
          title="Enable live trading?"
          danger
          body={
            <div className="space-y-2 text-sm text-white/80">
              <p>This switches the bot to LIVE mode. Real transactions will be sent from your configured trading wallet.</p>
              <ul className="list-disc space-y-1 pl-5 text-white/60">
                <li>Meme coins can lose all their value, including to zero.</li>
                <li>Liquidity can disappear and stops may fill below their intended price.</li>
                <li>Transactions can fail; network congestion and MEV can affect execution.</li>
                <li>Only funds you can afford to lose should ever be in this wallet.</li>
              </ul>
              {!status.liveTradingAllowedByConfig && (
                <p className="font-semibold text-red-300">
                  Blocked: the server .env has LIVE_TRADING_ENABLED=false. Live trading cannot be enabled from the dashboard alone.
                </p>
              )}
            </div>
          }
          confirmLabel="I understand the risk — enable live trading"
          onCancel={() => setShowModeConfirm(false)}
          onConfirm={() =>
            run(async () => {
              await api.setMode("live", true);
              setShowModeConfirm(false);
            })
          }
        />
      )}

      {showEmergencyConfirm && (
        <ConfirmModal
          title="Trigger emergency stop?"
          danger
          body={
            <div className="space-y-2 text-sm text-white/80">
              <p>This immediately stops the bot, blocks all new buys, and cancels queued entries. Monitoring and manual selling stay available.</p>
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
              await api.emergencyStop(emergencyReason || "No reason given.");
              setShowEmergencyConfirm(false);
              setEmergencyReason("");
            })
          }
        />
      )}

      {showResumeConfirm && (
        <ConfirmModal
          title="Resume trading?"
          body={<p className="text-sm text-white/80">This clears the emergency stop. The bot will remain stopped until you press Start Bot again.</p>}
          confirmLabel="Confirm Resume"
          onCancel={() => setShowResumeConfirm(false)}
          onConfirm={() =>
            run(async () => {
              await api.resume();
              setShowResumeConfirm(false);
            })
          }
        />
      )}
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
      <div className="w-full max-w-md rounded-sm border border-white/10 bg-[#0D131A] p-6 shadow-2xl">
        <h3 className="mb-3 text-lg font-bold">{title}</h3>
        {body}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-sm px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-sm px-4 py-2 text-sm font-bold text-white ${danger ? "bg-red-600 hover:bg-red-500" : "bg-violet-600 hover:bg-violet-500"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
