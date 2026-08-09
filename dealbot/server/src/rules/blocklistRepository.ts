import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";

export function isProductBlocked(productId: string): boolean {
  return !!db.prepare("SELECT 1 FROM blocked_products WHERE product_id = ?").get(productId);
}

export function isBrandBlocked(brand: string | null): boolean {
  if (!brand) return false;
  return !!db.prepare("SELECT 1 FROM blocked_brands WHERE brand = ? COLLATE NOCASE").get(brand);
}

export function blockProduct(productId: string, label: string, reason?: string): void {
  db.prepare("INSERT INTO blocked_products (id, product_id, label, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(
    randomUUID(),
    productId,
    label,
    reason ?? null,
    new Date().toISOString(),
  );
}

export function blockBrand(brand: string, reason?: string): void {
  db.prepare("INSERT OR IGNORE INTO blocked_brands (id, brand, reason, created_at) VALUES (?, ?, ?, ?)").run(randomUUID(), brand, reason ?? null, new Date().toISOString());
}

export function listBlockedProducts(): Array<{ id: string; product_id: string; label: string; reason: string | null; created_at: string }> {
  return db.prepare("SELECT * FROM blocked_products ORDER BY created_at DESC").all() as Array<{
    id: string;
    product_id: string;
    label: string;
    reason: string | null;
    created_at: string;
  }>;
}

export function listBlockedBrands(): Array<{ id: string; brand: string; reason: string | null; created_at: string }> {
  return db.prepare("SELECT * FROM blocked_brands ORDER BY created_at DESC").all() as Array<{ id: string; brand: string; reason: string | null; created_at: string }>;
}

export function unblockProduct(id: string): void {
  db.prepare("DELETE FROM blocked_products WHERE id = ?").run(id);
}

export function unblockBrand(id: string): void {
  db.prepare("DELETE FROM blocked_brands WHERE id = ?").run(id);
}
