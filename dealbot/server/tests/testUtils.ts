import { db } from "../src/db/index.js";

// Children before parents — SQLite enforces foreign keys, so deleting a
// referenced row before its dependents errors out.
const TABLES = [
  "commissions",
  "conversions",
  "click_events",
  "telegram_posts",
  "affiliate_links",
  "deal_scores",
  "deal_analysis",
  "price_history",
  "blocked_products",
  "product_offers",
  "products",
  "telegram_channels",
  "affiliate_sources",
  "blocked_brands",
  "bot_activity",
  "api_logs",
  "settings",
];

/** Wipes all rows (schema stays) so each test starts from a clean, known
 * state in the throwaway test database. */
export function resetDb(): void {
  for (const table of TABLES) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
  const now = new Date().toISOString();
  db.prepare("UPDATE bot_state SET running = 0, paused = 0, last_scan_at = NULL, next_scan_at = NULL, last_scan_products_found = 0, updated_at = ? WHERE id = 1").run(now);
  db.prepare(
    `UPDATE posting_rules SET min_deal_score = 75, min_deal_confidence = 80, min_discount_pct = 15, min_rating = 0, min_reviews = 0,
       min_estimated_commission = '0', require_in_stock = 1, require_affiliate_url = 1, allowed_categories_json = '[]',
       allowed_countries_json = '[]', repost_cooldown_hours = 48, updated_at = ? WHERE id = 1`,
  ).run(now);
}
