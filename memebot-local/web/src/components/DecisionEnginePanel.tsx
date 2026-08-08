import { useEffect, useState } from "react";
import { api, type LogEntry } from "../api/client.js";
import { useBotEvent } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Badge } from "./Badge.js";

interface Condition {
  name: string;
  passed: boolean;
  detail: string;
}

interface EvaluationDetails {
  mint: string;
  conditions?: Condition[];
  snapshot?: { symbol: string | null; priceUsd: number | null };
}

function parseEvaluationLog(log: LogEntry): { log: LogEntry; details: EvaluationDetails } | null {
  try {
    const details = JSON.parse(log.details_json) as EvaluationDetails;
    if (!details.conditions) return null;
    return { log, details };
  } catch {
    return null;
  }
}

/** Shows the actual entry-condition checklist from the most recent token
 * the bot evaluated — every line here is a real pass/fail from
 * evaluateEntryConditions(), not a fabricated confidence score. */
export function DecisionEnginePanel() {
  const [latest, setLatest] = useState<{ log: LogEntry; details: EvaluationDetails } | null>(null);

  useEffect(() => {
    api
      .logs(60)
      .then((logs) => {
        const match = logs.find((l) => l.category === "strategy_evaluation");
        if (match) setLatest(parseEvaluationLog(match));
      })
      .catch(() => {});
  }, []);

  useBotEvent<LogEntry>("log_created", (log) => {
    if (log.category !== "strategy_evaluation") return;
    const parsed = parseEvaluationLog(log);
    if (parsed) setLatest(parsed);
  });

  const passed = latest?.log.message.startsWith("Signal");

  return (
    <Panel title="Decision Engine">
      {!latest ? (
        <p className="text-sm text-white/40">No evaluations yet — waiting for the bot to scan a token.</p>
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Badge tone={passed ? "good" : "neutral"}>{passed ? "SIGNAL" : "REJECTED"}</Badge>
            <span className="font-mono text-sm font-semibold">{latest.details.snapshot?.symbol ?? latest.details.mint.slice(0, 8)}</span>
            {latest.details.snapshot?.priceUsd != null && (
              <span className="font-mono text-xs text-white/40">${latest.details.snapshot.priceUsd.toPrecision(4)}</span>
            )}
          </div>
          <ul className="space-y-1 font-mono text-xs">
            {(latest.details.conditions ?? []).map((c, i) => (
              <li key={i} className={c.passed ? "text-[#4DFFD6]" : "text-red-400"}>
                {c.passed ? "✓" : "✗"} {c.name}
                <span className="ml-2 text-white/30">— {c.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
