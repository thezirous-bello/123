import { useEffect, useState } from "react";
import { api, type RiskLimits } from "../api/client.js";
import { Panel } from "./Panel.js";

const FIELDS: Array<{ key: keyof RiskLimits; label: string; step?: number }> = [
  { key: "maxTradeUsd", label: "Max trade size (USD)" },
  { key: "maxWalletPercentagePerTrade", label: "Max % of equity per trade" },
  { key: "maxOpenPositions", label: "Max open positions", step: 1 },
  { key: "maxTradesPerHour", label: "Max trades per hour", step: 1 },
  { key: "maxTradesPerDay", label: "Max trades per day", step: 1 },
  { key: "maxDailyLossPercentage", label: "Max daily loss %" },
  { key: "maxSlippagePercentage", label: "Max slippage %" },
  { key: "maxPriceImpactPercentage", label: "Max price impact %" },
  { key: "minimumLiquidityUsd", label: "Minimum liquidity (USD)" },
  { key: "minimumSolReserve", label: "Minimum SOL reserve", step: 0.01 },
  { key: "cooldownMinutesAfterLoss", label: "Cooldown after a loss (minutes)" },
  { key: "consecutiveLossesBeforeCooldown", label: "Consecutive losses before cooldown", step: 1 },
  { key: "consecutiveLossCooldownMinutes", label: "Consecutive-loss cooldown (minutes)" },
  { key: "maxQuoteAgeSeconds", label: "Max quote age (seconds)" },
];

export function RiskSettings() {
  const [limits, setLimits] = useState<RiskLimits | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.riskLimits().then(setLimits).catch(() => {});
  }, []);

  if (!limits) return <Panel title="Risk Settings">Loading…</Panel>;

  async function save() {
    if (!limits) return;
    setError(null);
    try {
      const updated = await api.updateRiskLimits(limits);
      setLimits(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Panel title="Risk Settings">
      <p className="mb-4 text-xs text-white/50">
        These are your account-level ceilings. No strategy — parsed, AI-assisted, or hand-edited — can exceed them; anything that would is
        automatically clamped and flagged before activation.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-xs text-white/50">{f.label}</span>
            <input
              type="number"
              step={f.step ?? 0.1}
              value={limits[f.key] as number}
              onChange={(e) => setLimits({ ...limits, [f.key]: Number.parseFloat(e.target.value) || 0 })}
              className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-violet-500"
            />
          </label>
        ))}
        <label className="block">
          <span className="mb-1 block text-xs text-white/50">Max token risk level allowed</span>
          <select
            value={limits.maxTokenRiskLevel}
            onChange={(e) => setLimits({ ...limits, maxTokenRiskLevel: e.target.value as RiskLimits["maxTokenRiskLevel"] })}
            className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-violet-500"
          >
            <option value="low">Low only</option>
            <option value="medium">Medium or below</option>
            <option value="high">High or below</option>
          </select>
          <span className="mt-1 block text-xs text-white/40">Critical risk is always blocked, regardless of this setting.</span>
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <button onClick={save} className="mt-4 rounded-sm bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
        {saved ? "Saved" : "Save Risk Settings"}
      </button>
    </Panel>
  );
}
