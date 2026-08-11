import { db, newId, nowIso } from "../db/index.js";
import type { MomentumScoreResult } from "./momentum.js";

export type TradeStatus = "watching" | "signal" | "entered" | "rejected";

export interface MomentumScoreRecord {
  mint: string;
  symbol: string | null;
  score: MomentumScoreResult;
  liquidityUsd: number | null;
  priceImpactPct: number | null;
  tradeStatus: TradeStatus;
  rejectionReason: string | null;
}

/** Persists one momentum-score observation — the backing store for both the
 * live ranked opportunity table and the audit trail of every candidate the
 * bot considered, not just the ones it traded (task: "log tokens the bot
 * considered but rejected"). */
export function recordMomentumScore(record: MomentumScoreRecord): void {
  db.prepare(
    `INSERT INTO momentum_scores (
      id, mint, symbol, total_score, price_momentum_score, volume_acceleration_score, buy_pressure_score,
      tx_acceleration_score, liquidity_quality_score, trend_strength_score, execution_quality_score,
      trend_direction, momentum_accelerating, exhaustion_warning, volume_accelerating, buy_pressure_dominant,
      tx_accelerating, buy_sell_ratio, price_impact_pct, liquidity_usd, trade_status, rejection_reason, checked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    record.mint,
    record.symbol,
    record.score.totalScore,
    record.score.components.priceMomentum,
    record.score.components.volumeAcceleration,
    record.score.components.buyPressure,
    record.score.components.txAcceleration,
    record.score.components.liquidityQuality,
    record.score.components.trendStrength,
    record.score.components.executionQuality,
    record.score.trendDirection,
    record.score.momentumAccelerating ? 1 : 0,
    record.score.exhaustionWarning ? 1 : 0,
    record.score.volumeAccelerating ? 1 : 0,
    record.score.buyPressureDominant ? 1 : 0,
    record.score.txAccelerating ? 1 : 0,
    record.score.buySellRatio,
    record.priceImpactPct,
    record.liquidityUsd,
    record.tradeStatus,
    record.rejectionReason,
    nowIso(),
  );
}

export interface RankedMomentumRow {
  mint: string;
  symbol: string | null;
  totalScore: number;
  trendDirection: string;
  momentumAccelerating: boolean;
  volumeAccelerating: boolean;
  buyPressureDominant: boolean;
  txAccelerating: boolean;
  buySellRatio: number | null;
  priceImpactPct: number | null;
  liquidityUsd: number | null;
  tradeStatus: TradeStatus;
  rejectionReason: string | null;
  checkedAt: string;
}

/** The latest momentum-score row per mint (one per watched token), sorted
 * by opportunity score descending — this is the "live ranked table" the
 * scanner UI reads, sorted by the bot's own calculated opportunity score
 * rather than simply 24h gain. */
export function listLatestMomentumScores(limit = 100): RankedMomentumRow[] {
  const rows = db
    .prepare(
      `SELECT ms.* FROM momentum_scores ms
       INNER JOIN (
         SELECT mint, MAX(checked_at) AS max_checked_at FROM momentum_scores GROUP BY mint
       ) latest ON latest.mint = ms.mint AND latest.max_checked_at = ms.checked_at
       ORDER BY ms.total_score DESC
       LIMIT ?`,
    )
    .all(limit) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    mint: row.mint as string,
    symbol: (row.symbol as string) ?? null,
    totalScore: Number(row.total_score),
    trendDirection: row.trend_direction as string,
    momentumAccelerating: row.momentum_accelerating === 1,
    volumeAccelerating: row.volume_accelerating === 1,
    buyPressureDominant: row.buy_pressure_dominant === 1,
    txAccelerating: row.tx_accelerating === 1,
    buySellRatio: row.buy_sell_ratio !== null ? Number(row.buy_sell_ratio) : null,
    priceImpactPct: row.price_impact_pct !== null ? Number(row.price_impact_pct) : null,
    liquidityUsd: row.liquidity_usd !== null ? Number(row.liquidity_usd) : null,
    tradeStatus: row.trade_status as TradeStatus,
    rejectionReason: (row.rejection_reason as string) ?? null,
    checkedAt: row.checked_at as string,
  }));
}

export function latestMomentumScoreForMint(mint: string): RankedMomentumRow | null {
  const row = db
    .prepare("SELECT * FROM momentum_scores WHERE mint = ? ORDER BY checked_at DESC LIMIT 1")
    .get(mint) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    mint: row.mint as string,
    symbol: (row.symbol as string) ?? null,
    totalScore: Number(row.total_score),
    trendDirection: row.trend_direction as string,
    momentumAccelerating: row.momentum_accelerating === 1,
    volumeAccelerating: row.volume_accelerating === 1,
    buyPressureDominant: row.buy_pressure_dominant === 1,
    txAccelerating: row.tx_accelerating === 1,
    buySellRatio: row.buy_sell_ratio !== null ? Number(row.buy_sell_ratio) : null,
    priceImpactPct: row.price_impact_pct !== null ? Number(row.price_impact_pct) : null,
    liquidityUsd: row.liquidity_usd !== null ? Number(row.liquidity_usd) : null,
    tradeStatus: row.trade_status as TradeStatus,
    rejectionReason: (row.rejection_reason as string) ?? null,
    checkedAt: row.checked_at as string,
  };
}
