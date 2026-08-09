import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import type { RawOffer } from "../sources/types.js";

export interface ProductRow {
  id: string;
  dedup_key: string;
  name: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  rating: number | null;
  review_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface OfferRow {
  id: string;
  product_id: string;
  source_id: string;
  external_product_id: string;
  merchant: string;
  country: string | null;
  currency: string;
  current_price: string;
  reference_price: string | null;
  discount_pct: number | null;
  product_url: string;
  availability: string;
  shipping_info: string | null;
  status: string;
  reject_reason: string | null;
  first_discovered_at: string;
  last_seen_at: string;
  last_posted_at: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeDedupKey(name: string, brand: string | undefined, category: string | undefined): string {
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  return [brand ? norm(brand) : "", norm(name), category ? norm(category) : ""].join("::");
}

function discountPct(current: string, reference: string | null | undefined): number | null {
  if (!reference) return null;
  const cur = Number(current);
  const ref = Number(reference);
  if (!Number.isFinite(cur) || !Number.isFinite(ref) || ref <= 0 || cur >= ref) return null;
  return ((ref - cur) / ref) * 100;
}

function findOrCreateProduct(raw: RawOffer): ProductRow {
  const dedupKey = normalizeDedupKey(raw.name, raw.brand, raw.category);
  const existing = db.prepare("SELECT * FROM products WHERE dedup_key = ?").get(dedupKey) as ProductRow | undefined;
  const now = new Date().toISOString();
  if (existing) {
    db.prepare("UPDATE products SET rating = COALESCE(?, rating), review_count = COALESCE(?, review_count), updated_at = ? WHERE id = ?").run(
      raw.rating ?? null,
      raw.reviewCount ?? null,
      now,
      existing.id,
    );
    return { ...existing, rating: raw.rating ?? existing.rating, review_count: raw.reviewCount ?? existing.review_count };
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO products (id, dedup_key, name, brand, category, image_url, rating, review_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, dedupKey, raw.name, raw.brand ?? null, raw.category ?? null, raw.imageUrl ?? null, raw.rating ?? null, raw.reviewCount ?? null, now, now);
  return db.prepare("SELECT * FROM products WHERE id = ?").get(id) as ProductRow;
}

export interface UpsertResult {
  offer: OfferRow;
  isNew: boolean;
  priceChanged: boolean;
}

/** Inserts or updates one offer from a source's real scan result. Every
 * price write also appends to price_history, which is what deal
 * verification later reads from — this is the single place raw source
 * data enters the system, so keeping it honest here keeps everything
 * downstream honest too. */
export function upsertOffer(sourceId: string, raw: RawOffer): UpsertResult {
  const product = findOrCreateProduct(raw);
  const now = new Date().toISOString();
  const existing = db
    .prepare("SELECT * FROM product_offers WHERE source_id = ? AND external_product_id = ? AND merchant = ?")
    .get(sourceId, raw.externalProductId, raw.merchant) as OfferRow | undefined;

  const pct = discountPct(raw.currentPrice, raw.referencePrice);

  if (!existing) {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO product_offers
         (id, product_id, source_id, external_product_id, merchant, country, currency, current_price, reference_price,
          discount_pct, product_url, availability, shipping_info, status, first_discovered_at, last_seen_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'discovered', ?, ?, ?, ?)`,
    ).run(
      id,
      product.id,
      sourceId,
      raw.externalProductId,
      raw.merchant,
      raw.country ?? null,
      raw.currency,
      raw.currentPrice,
      raw.referencePrice ?? null,
      pct,
      raw.productUrl,
      raw.availability ?? "unknown",
      raw.shippingInfo ?? null,
      now,
      now,
      now,
      now,
    );
    db.prepare("INSERT INTO price_history (id, offer_id, price, currency, recorded_at) VALUES (?, ?, ?, ?, ?)").run(
      randomUUID(),
      id,
      raw.currentPrice,
      raw.currency,
      now,
    );
    return { offer: db.prepare("SELECT * FROM product_offers WHERE id = ?").get(id) as OfferRow, isNew: true, priceChanged: true };
  }

  const priceChanged = existing.current_price !== raw.currentPrice;
  db.prepare(
    `UPDATE product_offers
       SET current_price = ?, reference_price = ?, discount_pct = ?, availability = ?, shipping_info = ?,
           last_seen_at = ?, updated_at = ?,
           status = CASE WHEN status IN ('expired', 'out_of_stock', 'error') THEN 'discovered' ELSE status END
     WHERE id = ?`,
  ).run(raw.currentPrice, raw.referencePrice ?? null, pct, raw.availability ?? "unknown", raw.shippingInfo ?? null, now, now, existing.id);

  if (priceChanged) {
    db.prepare("INSERT INTO price_history (id, offer_id, price, currency, recorded_at) VALUES (?, ?, ?, ?, ?)").run(
      randomUUID(),
      existing.id,
      raw.currentPrice,
      raw.currency,
      now,
    );
  }

  return { offer: db.prepare("SELECT * FROM product_offers WHERE id = ?").get(existing.id) as OfferRow, isNew: false, priceChanged };
}

export function getOffer(id: string): OfferRow | undefined {
  return db.prepare("SELECT * FROM product_offers WHERE id = ?").get(id) as OfferRow | undefined;
}

export function getProduct(id: string): ProductRow | undefined {
  return db.prepare("SELECT * FROM products WHERE id = ?").get(id) as ProductRow | undefined;
}

export function updateOfferStatus(id: string, status: string, rejectReason?: string): void {
  db.prepare("UPDATE product_offers SET status = ?, reject_reason = ?, updated_at = ? WHERE id = ?").run(
    status,
    rejectReason ?? null,
    new Date().toISOString(),
    id,
  );
}

export function markOfferPosted(id: string): void {
  const now = new Date().toISOString();
  db.prepare("UPDATE product_offers SET status = 'posted', last_posted_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
}

export function listOffers(limit = 200): OfferRow[] {
  return db.prepare("SELECT * FROM product_offers ORDER BY updated_at DESC LIMIT ?").all(limit) as OfferRow[];
}

export function listOffersByStatus(status: string, limit = 200): OfferRow[] {
  return db.prepare("SELECT * FROM product_offers WHERE status = ? ORDER BY updated_at DESC LIMIT ?").all(status, limit) as OfferRow[];
}

/** Other merchants' offers for the same real-world product — this is what
 * price-competitiveness scoring compares against (spec section 2: "keep
 * those offers connected so they can be compared"). */
export function listOffersForProduct(productId: string): OfferRow[] {
  return db.prepare("SELECT * FROM product_offers WHERE product_id = ?").all(productId) as OfferRow[];
}

export function getPriceHistory(offerId: string, limit = 60): Array<{ price: string; currency: string; recorded_at: string }> {
  return db
    .prepare("SELECT price, currency, recorded_at FROM price_history WHERE offer_id = ? ORDER BY recorded_at ASC LIMIT ?")
    .all(offerId, limit) as Array<{ price: string; currency: string; recorded_at: string }>;
}

/** Same product previously posted, and how long ago — used by the repost
 * cooldown rule. */
export function lastPostedAgoHours(productId: string): number | null {
  const row = db
    .prepare(
      `SELECT MAX(o.last_posted_at) as last_posted_at
       FROM product_offers o WHERE o.product_id = ? AND o.last_posted_at IS NOT NULL`,
    )
    .get(productId) as { last_posted_at: string | null } | undefined;
  if (!row?.last_posted_at) return null;
  return (Date.now() - new Date(row.last_posted_at).getTime()) / (1000 * 60 * 60);
}
