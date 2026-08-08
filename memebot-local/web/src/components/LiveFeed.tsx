import { useEffect, useMemo, useRef, useState } from "react";
import { api, type LogEntry, type Position, type Trade, type WatchlistEntry } from "../api/client.js";
import { useBotEvent, useRefreshSignal } from "../hooks/useRefreshSignal.js";
import { Panel } from "./Panel.js";
import { Badge } from "./Badge.js";
import { SystemMonitorBar } from "./SystemMonitorBar.js";
import { PortfolioOverview } from "./PortfolioOverview.js";
import { DecisionEnginePanel } from "./DecisionEnginePanel.js";
import { TokenCardsRow } from "./TokenCardsRow.js";
import { NetworkMapPanel } from "./NetworkMapPanel.js";
import { ALL_BOT_SERVICES, ALL_BOTS_HUB_LABEL, hintForDownProvider } from "./networkMapServices.js";
import { MemeTokenChartPanel } from "./PriceLineChartPanel.js";
import { BotAnalyticsColumn, type PnlStats } from "./BotAnalyticsColumn.js";
import { TradeFeedList, type TradeFeedRow } from "./TradeFeedList.js";
import { SystemAlertsFeed } from "./SystemAlertsFeed.js";
import { PortfolioExposureDonut } from "./PortfolioExposureDonut.js";
import { memeLogsToAlerts } from "../lib/alerts.js";

function memePnlStats(positions: Position[]): PnlStats {
  const closed = positions.filter((p) => p.status === "closed");
  const wins = closed.filter((p) => Number(p.realizedPnlUsd) > 0);
  const losses = closed.filter((p) => Number(p.realizedPnlUsd) < 0);
  const totalVolumeUsd = positions.reduce((s, p) => s + Number(p.costBasisUsd), 0);
  const rois = closed.filter((p) => Number(p.costBasisUsd) > 0).map((p) => (Number(p.realizedPnlUsd) / Number(p.costBasisUsd)) * 100);
  return {
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : null,
    totalVolumeUsd,
    avgRoiPct: rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : null,
  };
}

type FlashKind = "scan" | "buy" | "sell";
interface Flash {
  kind: FlashKind;
  key: number;
}

const MAX_LOG_LINES = 160;
const MAX_TRADE_CARDS = 24;

function shortMint(mint: string): string {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

const LEVEL_STYLE: Record<LogEntry["level"], string> = {
  debug: "text-white/25",
  info: "text-[#4DFFD6] text-glow-green",
  warn: "text-amber-300",
  error: "text-red-400 text-glow-red",
};

const CATEGORY_TAG: Record<string, string> = {
  strategy_evaluation: "SCAN",
  paper_trade: "TRADE",
  live_trade: "TRADE",
  risk: "RISK",
  bot: "CORE",
  strategy: "STRAT",
  watchlist: "WATCH",
  position: "POS",
  paper_account: "ACCT",
};

export function LiveFeed({ running, mode }: { running: boolean; mode: "paper" | "live" }) {
  const tick = useRefreshSignal();
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [flashes, setFlashes] = useState<Record<string, Flash>>({});
  const flashCounter = useRef(0);
  const logScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.watchlist().then(setWatchlist).catch(() => {});
    api.listPositions().then(setAllPositions).catch(() => {});
  }, [tick]);

  const openPositions = useMemo(() => allPositions.filter((p) => p.status === "open"), [allPositions]);

  useEffect(() => {
    api.logs(MAX_LOG_LINES).then((l) => setLogs(l.slice().reverse())).catch(() => {});
    api.listTrades().then((t) => setTrades(t.slice(0, MAX_TRADE_CARDS))).catch(() => {});
  }, []);

  useEffect(() => {
    logScrollRef.current?.scrollTo({ top: logScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  function triggerFlash(mint: string, kind: FlashKind) {
    flashCounter.current += 1;
    const key = flashCounter.current;
    setFlashes((prev) => ({ ...prev, [mint]: { kind, key } }));
    setTimeout(
      () => {
        setFlashes((prev) => {
          if (prev[mint]?.key !== key) return prev;
          const next = { ...prev };
          delete next[mint];
          return next;
        });
      },
      kind === "scan" ? 900 : 1500,
    );
  }

  useBotEvent<LogEntry>("log_created", (log) => {
    setLogs((prev) => [...prev.slice(-(MAX_LOG_LINES - 1)), log]);
    if (log.category === "strategy_evaluation") {
      try {
        const details = JSON.parse(log.details_json) as { mint?: string };
        if (details.mint) triggerFlash(details.mint, "scan");
      } catch {
        // ignore
      }
    }
  });

  useBotEvent<Trade>("trade_created", (trade) => {
    setTrades((prev) => [trade, ...prev].slice(0, MAX_TRADE_CARDS));
    triggerFlash(trade.mint, trade.side === "buy" ? "buy" : "sell");
  });

  const openMints = useMemo(() => new Set(openPositions.map((p) => p.mint)), [openPositions]);
  const radarNodes = useMemo(() => watchlist.filter((w) => !w.blocked).slice(0, 12), [watchlist]);

  const eventsLastMinute = useMemo(() => {
    const cutoff = Date.now() - 60_000;
    return logs.filter((l) => new Date(l.created_at).getTime() >= cutoff).length;
  }, [logs]);

  return (
    <div className="space-y-4">
      <SystemMonitorBar />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_1fr_300px]">
        <BotAnalyticsColumn stats={memePnlStats(allPositions)} />
        <MemeTokenChartPanel />

        <div className="space-y-4">
          <TradeFeedList
            trades={trades.slice(0, 20).map(
              (t): TradeFeedRow => ({
                id: t.id,
                time: new Date(t.created_at).toLocaleTimeString(),
                venue: mode === "live" ? "SOLANA" : "PAPER",
                side: t.side === "buy" ? "buy" : "sell",
                symbol: t.symbol ?? t.mint.slice(0, 6),
                amountUsd: Number(t.amount_usd),
                failed: t.status === "failed",
              }),
            )}
          />
          <SystemAlertsFeed alerts={memeLogsToAlerts(logs)} />
          <PortfolioExposureDonut
            slices={openPositions.map((p) => ({ symbol: p.symbol ?? p.mint.slice(0, 6), notionalUsd: Number(p.costBasisUsd) }))}
          />
        </div>
      </div>

      <NetworkMapPanel
        title="Network Map — All Bots"
        hubLabel={ALL_BOTS_HUB_LABEL}
        services={ALL_BOT_SERVICES}
        hintForDownProvider={(id) => hintForDownProvider(id)}
        action={
          <button
            onClick={() => api.discoverTokens().catch(() => {})}
            className="rounded border border-white/15 px-2 py-1 text-[10px] font-mono text-white/50 hover:bg-white/10"
            title="Runs a real discovery pass now, same as the Scanner tab's Discover Now button"
          >
            DISCOVER NOW
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <RadarPanel nodes={radarNodes} openMints={openMints} flashes={flashes} running={running} />
        <TerminalPanel logs={logs} scrollRef={logScrollRef} eventsPerMin={eventsLastMinute} running={running} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PortfolioOverview mode={mode} />
        <DecisionEnginePanel />
      </div>

      <TokenCardsRow mode={mode} />
      <TransactionStrip trades={trades} />
    </div>
  );
}

function RadarPanel({
  nodes,
  openMints,
  flashes,
  running,
}: {
  nodes: WatchlistEntry[];
  openMints: Set<string>;
  flashes: Record<string, Flash>;
  running: boolean;
}) {
  const size = 280;
  const center = size / 2;
  const radius = size / 2 - 34;

  return (
    <Panel title="Radar — Watched Tokens">
      <div className="relative mx-auto terminal-surface rounded-full" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0">
          {[0.33, 0.66, 1].map((f) => (
            <circle key={f} cx={center} cy={center} r={radius * f} fill="none" stroke="rgba(34,255,136,0.15)" strokeWidth={1} />
          ))}
          <line x1={center} y1={0} x2={center} y2={size} stroke="rgba(34,255,136,0.08)" />
          <line x1={0} y1={center} x2={size} y2={center} stroke="rgba(34,255,136,0.08)" />
        </svg>

        {running && (
          <div
            className="absolute inset-0 animate-radar-spin"
            style={{
              background: `conic-gradient(from 0deg, rgba(34,255,136,0.28), transparent 40deg)`,
              borderRadius: "9999px",
              maskImage: "radial-gradient(circle, black 60%, transparent 100%)",
            }}
          />
        )}

        <div className="absolute rounded-full bg-emerald-400/80 animate-node-idle" style={{ width: 10, height: 10, left: center - 5, top: center - 5 }} />

        {nodes.map((node, i) => {
          const angle = (i / Math.max(nodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          const flash = flashes[node.mint];
          const isOpen = openMints.has(node.mint);

          let dotColor = "#00FFC8";
          if (flash?.kind === "scan") dotColor = "#8B5CF6";
          if (flash?.kind === "buy") dotColor = "#00FFC8";
          if (flash?.kind === "sell") dotColor = "#FF3B5C";
          if (!flash && isOpen) dotColor = "#00FFC8";
          if (!flash && !isOpen) dotColor = "#00E5FF";

          return (
            <div key={node.mint} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }} title={node.symbol ?? node.mint}>
              {flash && (
                <span
                  key={flash.key}
                  className="absolute inset-0 -m-2 rounded-full animate-ping-ring"
                  style={{ border: `1.5px solid ${dotColor}`, color: dotColor }}
                />
              )}
              {isOpen && !flash && <span className="absolute -inset-1.5 rounded-full border border-emerald-400/60" />}
              <span
                key={`dot-${flash?.key ?? "idle"}`}
                className={`block rounded-full ${flash ? "animate-node-flash" : "animate-node-idle"}`}
                style={{ width: 8, height: 8, background: dotColor, color: dotColor }}
              />
              <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] text-white/40 font-mono">
                {node.symbol ?? shortMint(node.mint)}
              </span>
            </div>
          );
        })}

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center px-10 text-center text-xs text-white/30 font-mono">
            No tokens watched yet — add some from the Scanner tab.
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-[11px] text-white/30 font-mono">
        purple = scanning · blue = idle watch · green ring = open position · red flash = closed
      </p>
    </Panel>
  );
}

function TerminalPanel({
  logs,
  scrollRef,
  eventsPerMin,
  running,
}: {
  logs: LogEntry[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  eventsPerMin: number;
  running: boolean;
}) {
  return (
    <Panel
      title="Live Terminal"
      action={
        <div className="flex items-center gap-3 font-mono text-[11px] text-white/40">
          <span className={running ? "text-glow-green text-[#4DFFD6]" : "text-white/30"}>{running ? "● LINK ACTIVE" : "○ IDLE"}</span>
          <span>{eventsPerMin} evt/min</span>
        </div>
      }
    >
      <div ref={scrollRef} className="terminal-surface h-96 overflow-y-auto rounded-sm border border-white/10 p-3 font-mono text-[12px] leading-relaxed">
        {logs.length === 0 && <p className="text-white/30">Waiting for activity...</p>}
        {logs.map((log) => (
          <div key={log.id} className={LEVEL_STYLE[log.level]}>
            <span className="text-white/25">{new Date(log.created_at).toLocaleTimeString()}</span>{" "}
            <span className="text-white/40">[{CATEGORY_TAG[log.category] ?? log.category.toUpperCase()}]</span> {log.message}
          </div>
        ))}
        <div className="crt-cursor text-white/10">&nbsp;</div>
      </div>
    </Panel>
  );
}

function TransactionStrip({ trades }: { trades: Trade[] }) {
  return (
    <Panel title="Live Transactions">
      {trades.length === 0 ? (
        <p className="text-sm text-white/40 font-mono">No transactions yet.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {trades.map((t) => {
            const isBuy = t.side === "buy";
            const failed = t.status === "failed";
            const borderClass = failed ? "border-glow-red border-red-500/50" : isBuy ? "border-glow-green border-emerald-500/50" : "border-glow-red border-red-500/50";
            return (
              <div
                key={t.id}
                className={`animate-flash-in min-w-[180px] flex-shrink-0 rounded-sm border bg-black/40 p-3 font-mono ${borderClass}`}
              >
                <div className="flex items-center justify-between">
                  <Badge tone={failed ? "danger" : isBuy ? "good" : "danger"}>{failed ? "FAILED" : isBuy ? "OPEN" : "CLOSE"}</Badge>
                  <Badge tone={t.mode === "live" ? "danger" : "accent"}>{t.mode.toUpperCase()}</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold">{t.symbol ?? shortMint(t.mint)}</p>
                <p className="text-xs text-white/50">{shortMint(t.mint)}</p>
                <p className={`mt-1 text-sm font-bold ${isBuy ? "text-[#4DFFD6]" : "text-red-400"}`}>${Number(t.amount_usd).toFixed(2)}</p>
                <p className="text-[10px] text-white/30">{new Date(t.created_at).toLocaleTimeString()}</p>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
