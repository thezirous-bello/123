import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";

export interface DashboardMetrics {
  dealsScannedToday: number;
  qualifiedDealsToday: number;
  dealsPostedToday: number;
  clicksToday: number;
  conversionsToday: number;
  revenueToday: string;
  revenueThisMonth: string;
  averageCommission: string | null;
  bestChannel: { name: string; clicks: number } | null;
  conversionsTracked: boolean;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Every number here is a real COUNT/SUM over rows we actually wrote —
 * conversions/revenue only ever reflect rows in `conversions`/`commissions`,
 * which stay empty until a real affiliate-network integration populates
 * them. We never estimate a conversion from a click. */
export function getDashboardMetrics(): DashboardMetrics {
  const today = startOfTodayIso();
  const monthStart = startOfMonthIso();

  const dealsScannedToday = (
    db.prepare("SELECT COUNT(*) as c FROM product_offers WHERE first_discovered_at >= ? OR last_seen_at >= ?").get(today, today) as { c: number }
  ).c;

  const qualifiedDealsToday = (
    db.prepare("SELECT COUNT(*) as c FROM product_offers WHERE status IN ('approved','queued','posted') AND updated_at >= ?").get(today) as {
      c: number;
    }
  ).c;

  const dealsPostedToday = (
    db.prepare("SELECT COUNT(*) as c FROM telegram_posts WHERE status = 'posted' AND posted_at >= ?").get(today) as { c: number }
  ).c;

  const clicksToday = (db.prepare("SELECT COUNT(*) as c FROM click_events WHERE clicked_at >= ?").get(today) as { c: number }).c;
  const conversionsToday = (db.prepare("SELECT COUNT(*) as c FROM conversions WHERE reported_at >= ?").get(today) as { c: number }).c;

  const revenueToday = (
    db
      .prepare(
        `SELECT COALESCE(SUM(CAST(cm.amount as REAL)), 0) as total FROM commissions cm
         JOIN conversions cv ON cv.id = cm.conversion_id WHERE cv.reported_at >= ?`,
      )
      .get(today) as { total: number }
  ).total;

  const revenueThisMonth = (
    db
      .prepare(
        `SELECT COALESCE(SUM(CAST(cm.amount as REAL)), 0) as total FROM commissions cm
         JOIN conversions cv ON cv.id = cm.conversion_id WHERE cv.reported_at >= ?`,
      )
      .get(monthStart) as { total: number }
  ).total;

  const commissionCount = (db.prepare("SELECT COUNT(*) as c FROM commissions").get() as { c: number }).c;
  const commissionTotal = (db.prepare("SELECT COALESCE(SUM(CAST(amount as REAL)),0) as total FROM commissions").get() as { total: number }).total;

  const bestChannelRow = db
    .prepare(
      `SELECT tc.name as name, COUNT(ce.id) as clicks
       FROM click_events ce
       JOIN telegram_posts tp ON tp.id = ce.telegram_post_id
       JOIN telegram_channels tc ON tc.id = tp.channel_id
       GROUP BY tc.id ORDER BY clicks DESC LIMIT 1`,
    )
    .get() as { name: string; clicks: number } | undefined;

  return {
    dealsScannedToday,
    qualifiedDealsToday,
    dealsPostedToday,
    clicksToday,
    conversionsToday,
    revenueToday: revenueToday.toFixed(2),
    revenueThisMonth: revenueThisMonth.toFixed(2),
    averageCommission: commissionCount > 0 ? (commissionTotal / commissionCount).toFixed(2) : null,
    bestChannel: bestChannelRow ?? null,
    // No conversion/commission provider is wired in V1 — the dashboard
    // must show "unavailable", not "0", for these fields when this is
    // false, per the spec's "never fabricate unavailable metrics" rule.
    conversionsTracked: false,
  };
}

export function getClicksForOffer(offerId: string): number {
  return (db.prepare("SELECT COUNT(*) as c FROM click_events WHERE offer_id = ?").get(offerId) as { c: number }).c;
}

export function getConversionsForOffer(offerId: string): number {
  return (db.prepare("SELECT COUNT(*) as c FROM conversions WHERE offer_id = ?").get(offerId) as { c: number }).c;
}

export function getRevenueForOffer(offerId: string): string {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CAST(cm.amount as REAL)), 0) as total FROM commissions cm
       JOIN conversions cv ON cv.id = cm.conversion_id WHERE cv.offer_id = ?`,
    )
    .get(offerId) as { total: number };
  return row.total.toFixed(2);
}

/** For a real affiliate-network webhook/API integration to call once one is
 * wired in — records a real conversion, never invented by the app itself. */
export function recordConversion(input: {
  offerId: string;
  affiliateLinkId?: string | null;
  provider: string;
  externalConversionId?: string | null;
  orderAmount?: string | null;
  currency?: string | null;
  commissionAmount?: string | null;
}): void {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO conversions (id, offer_id, affiliate_link_id, provider, external_conversion_id, order_amount, currency, reported_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.offerId, input.affiliateLinkId ?? null, input.provider, input.externalConversionId ?? null, input.orderAmount ?? null, input.currency ?? null, now, now);

  if (input.commissionAmount) {
    db.prepare("INSERT INTO commissions (id, conversion_id, amount, currency, status, created_at) VALUES (?, ?, ?, ?, 'confirmed', ?)").run(
      randomUUID(),
      id,
      input.commissionAmount,
      input.currency ?? "EUR",
      now,
    );
  }
}
