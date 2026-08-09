import { randomBytes, randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { botEvents } from "../lib/events.js";

export interface AffiliateLinkRow {
  id: string;
  offer_id: string;
  original_url: string;
  affiliate_url: string | null;
  provider: string;
  campaign_id: string | null;
  tracking_slug: string | null;
  status: "ok" | "error" | "pending";
  error: string | null;
  created_at: string;
}

export function createAffiliateLink(input: {
  offerId: string;
  originalUrl: string;
  affiliateUrl: string | null;
  provider: string;
  campaignId?: string | null;
  ok: boolean;
  error?: string | null;
}): AffiliateLinkRow {
  const id = randomUUID();
  // Only a successful link gets a redirect slug — an errored link should
  // never be reachable via /r/:slug.
  const trackingSlug = input.ok ? randomBytes(6).toString("hex") : null;
  db.prepare(
    `INSERT INTO affiliate_links (id, offer_id, original_url, affiliate_url, provider, campaign_id, tracking_slug, status, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.offerId,
    input.originalUrl,
    input.affiliateUrl,
    input.provider,
    input.campaignId ?? null,
    trackingSlug,
    input.ok ? "ok" : "error",
    input.error ?? null,
    new Date().toISOString(),
  );
  return getAffiliateLink(id)!;
}

export function getAffiliateLink(id: string): AffiliateLinkRow | undefined {
  return db.prepare("SELECT * FROM affiliate_links WHERE id = ?").get(id) as AffiliateLinkRow | undefined;
}

export function getLatestLinkForOffer(offerId: string): AffiliateLinkRow | undefined {
  return db.prepare("SELECT * FROM affiliate_links WHERE offer_id = ? ORDER BY created_at DESC LIMIT 1").get(offerId) as AffiliateLinkRow | undefined;
}

export function getLinkBySlug(slug: string): AffiliateLinkRow | undefined {
  return db.prepare("SELECT * FROM affiliate_links WHERE tracking_slug = ?").get(slug) as AffiliateLinkRow | undefined;
}

/** Real, self-hosted click tracking: the Telegram post's button points at
 * our own /r/:slug redirect (see routes/redirect.ts), which calls this
 * before 302-ing to the real affiliate URL. This is genuine click data we
 * observed ourselves, not an estimate — conversions/commission still
 * depend on the affiliate network's own reporting, which is a separate,
 * honestly-optional integration (see tracking/repository.ts). */
export function recordClick(linkId: string, offerId: string, telegramPostId: string | null, userAgent: string | null): void {
  db.prepare(
    "INSERT INTO click_events (id, affiliate_link_id, offer_id, telegram_post_id, user_agent, clicked_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(randomUUID(), linkId, offerId, telegramPostId, userAgent, new Date().toISOString());
  botEvents.emitEvent("click_recorded", { linkId, offerId });
}
