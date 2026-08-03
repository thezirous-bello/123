import { useEffect, useState } from "react";
import { api, type InterpretResult, type Strategy, type StrategyRules } from "../api/client.js";
import { useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Badge } from "./Badge.js";

const EXAMPLE =
  "Buy up to $20 when liquidity is above $100,000, five-minute volume is above $50,000, mint authority is disabled, freeze authority is disabled, and the top ten holders own less than 25%. Sell half at 50% profit, sell the rest at 100% profit, and stop loss at 20%.";

export function StrategyPanel() {
  const tick = useRefreshSignal();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [instruction, setInstruction] = useState("");
  const [name, setName] = useState("");
  const [interpretResult, setInterpretResult] = useState<InterpretResult | null>(null);
  const [editableRules, setEditableRules] = useState<StrategyRules | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listStrategies().then(setStrategies).catch(() => {});
  }, [tick]);

  async function interpret() {
    setBusy(true);
    setError(null);
    setInterpretResult(null);
    setEditableRules(null);
    try {
      const result = await api.interpretStrategy(instruction);
      setInterpretResult(result);
      if (result.ok && result.rules) setEditableRules(result.rules);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAndActivate() {
    if (!editableRules) return;
    setBusy(true);
    setError(null);
    try {
      const strategy = await api.createStrategy(name || "Untitled strategy", instruction, editableRules);
      await api.activateStrategy(strategy.id);
      setInstruction("");
      setName("");
      setInterpretResult(null);
      setEditableRules(null);
      const list = await api.listStrategies();
      setStrategies(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveOnly() {
    if (!editableRules) return;
    setBusy(true);
    setError(null);
    try {
      await api.createStrategy(name || "Untitled strategy", instruction, editableRules);
      setInstruction("");
      setName("");
      setInterpretResult(null);
      setEditableRules(null);
      const list = await api.listStrategies();
      setStrategies(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(strategy: Strategy) {
    setBusy(true);
    try {
      if (strategy.enabled) await api.pauseStrategy(strategy.id);
      else await api.activateStrategy(strategy.id);
      setStrategies(await api.listStrategies());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Panel title="Describe Your Strategy">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={EXAMPLE}
          rows={4}
          className="w-full rounded-lg border border-white/15 bg-black/30 p-3 text-sm outline-none focus:border-violet-500"
        />
        <div className="mt-2 flex items-center justify-between">
          <button onClick={() => setInstruction(EXAMPLE)} className="text-xs text-white/40 underline hover:text-white/70">
            Use example
          </button>
          <button
            disabled={busy || !instruction.trim()}
            onClick={interpret}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          >
            Parse Strategy
          </button>
        </div>

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        {interpretResult && !interpretResult.ok && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <p className="mb-1 text-sm font-semibold text-red-300">This instruction was rejected:</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-red-200/90">
              {interpretResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {interpretResult?.ok && editableRules && (
          <div className="mt-4 space-y-3 rounded-lg border border-violet-500/25 bg-violet-500/5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-violet-200">
                Parsed rules (source: {interpretResult.source === "ai" ? "AI-assisted" : "local parser"}) — review before activating
              </p>
            </div>

            {interpretResult.warnings.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-amber-300/90">
                {interpretResult.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}

            <ul className="list-disc space-y-1 pl-5 text-sm text-white/80">
              {interpretResult.plainEnglish?.map((line, i) => <li key={i}>{line}</li>)}
            </ul>

            <RuleEditor rules={editableRules} onChange={setEditableRules} />

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Strategy name"
              className="w-full rounded-lg border border-white/15 bg-black/30 p-2 text-sm outline-none focus:border-violet-500"
            />

            <div className="flex justify-end gap-2">
              <button disabled={busy} onClick={saveOnly} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">
                Save Without Activating
              </button>
              <button
                disabled={busy}
                onClick={saveAndActivate}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                Confirm &amp; Activate
              </button>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Your Strategies">
        {strategies.length === 0 ? (
          <p className="text-sm text-white/50">No strategies yet — describe one above.</p>
        ) : (
          <div className="space-y-2">
            {strategies
              .filter((s) => !s.archived)
              .map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{s.name}</p>
                      {s.enabled && <Badge tone="good">ACTIVE</Badge>}
                      <Badge tone="neutral">v{s.version}</Badge>
                    </div>
                    <p className="text-xs text-white/50">
                      Max ${s.rules.maxTradeUsd}/trade · Stop loss {s.rules.stopLossPercentage}% · {s.rules.takeProfits.length} take-profit level(s)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => toggle(s)} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">
                      {s.enabled ? "Pause" : "Activate"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={async () => {
                        await api.duplicateStrategy(s.id);
                        setStrategies(await api.listStrategies());
                      }}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                    >
                      Duplicate
                    </button>
                    <button
                      disabled={busy}
                      onClick={async () => {
                        await api.archiveStrategy(s.id);
                        setStrategies(await api.listStrategies());
                      }}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function RuleEditor({ rules, onChange }: { rules: StrategyRules; onChange: (rules: StrategyRules) => void }) {
  function set<K extends keyof StrategyRules>(key: K, value: StrategyRules[K]) {
    onChange({ ...rules, [key]: value });
  }

  return (
    <details className="rounded-lg border border-white/10 bg-black/20 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-white/70">Edit rules manually</summary>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <NumberField label="Max trade (USD)" value={rules.maxTradeUsd} onChange={(v) => set("maxTradeUsd", v)} />
        <NumberField label="Min liquidity (USD)" value={rules.minimumLiquidityUsd} onChange={(v) => set("minimumLiquidityUsd", v)} />
        <NumberField label="Max top-10 holder %" value={rules.maximumTop10HolderPercentage} onChange={(v) => set("maximumTop10HolderPercentage", v)} />
        <NumberField label="Max slippage %" value={rules.maximumSlippagePercentage} onChange={(v) => set("maximumSlippagePercentage", v)} />
        <NumberField label="Max price impact %" value={rules.maximumPriceImpactPercentage} onChange={(v) => set("maximumPriceImpactPercentage", v)} />
        <NumberField label="Stop loss %" value={rules.stopLossPercentage} onChange={(v) => set("stopLossPercentage", v)} />
        <NumberField
          label="Trailing stop % (0 = off)"
          value={rules.trailingStopPercentage ?? 0}
          onChange={(v) => set("trailingStopPercentage", v > 0 ? v : undefined)}
        />
        <NumberField label="Daily trade limit" value={rules.dailyTradeLimit} onChange={(v) => set("dailyTradeLimit", v)} />
      </div>
    </details>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/50">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value) || 0)}
        className="w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-violet-500"
      />
    </label>
  );
}
