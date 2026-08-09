import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";

export interface ChannelRow {
  id: string;
  name: string;
  chat_id: string;
  language: string;
  country: string | null;
  categories_json: string;
  min_deal_score: number;
  min_profit_score: number;
  max_posts_per_hour: number;
  max_posts_per_day: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export function listChannels(): ChannelRow[] {
  return db.prepare("SELECT * FROM telegram_channels ORDER BY created_at ASC").all() as ChannelRow[];
}

export function getChannel(id: string): ChannelRow | undefined {
  return db.prepare("SELECT * FROM telegram_channels WHERE id = ?").get(id) as ChannelRow | undefined;
}

export function createChannel(input: {
  name: string;
  chatId: string;
  language?: string;
  country?: string;
  categories?: string[];
  minDealScore?: number;
  minProfitScore?: number;
  maxPostsPerHour?: number;
  maxPostsPerDay?: number;
}): ChannelRow {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO telegram_channels
       (id, name, chat_id, language, country, categories_json, min_deal_score, min_profit_score, max_posts_per_hour, max_posts_per_day, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    id,
    input.name,
    input.chatId,
    input.language ?? "en",
    input.country ?? null,
    JSON.stringify(input.categories ?? []),
    input.minDealScore ?? 75,
    input.minProfitScore ?? 0,
    input.maxPostsPerHour ?? 3,
    input.maxPostsPerDay ?? 20,
    now,
    now,
  );
  return getChannel(id)!;
}

export function updateChannel(
  id: string,
  patch: Partial<{
    name: string;
    chatId: string;
    language: string;
    country: string;
    categories: string[];
    minDealScore: number;
    minProfitScore: number;
    maxPostsPerHour: number;
    maxPostsPerDay: number;
    enabled: boolean;
  }>,
): void {
  const existing = getChannel(id);
  if (!existing) return;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE telegram_channels
       SET name = ?, chat_id = ?, language = ?, country = ?, categories_json = ?, min_deal_score = ?, min_profit_score = ?,
           max_posts_per_hour = ?, max_posts_per_day = ?, enabled = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    patch.name ?? existing.name,
    patch.chatId ?? existing.chat_id,
    patch.language ?? existing.language,
    patch.country ?? existing.country,
    patch.categories ? JSON.stringify(patch.categories) : existing.categories_json,
    patch.minDealScore ?? existing.min_deal_score,
    patch.minProfitScore ?? existing.min_profit_score,
    patch.maxPostsPerHour ?? existing.max_posts_per_hour,
    patch.maxPostsPerDay ?? existing.max_posts_per_day,
    patch.enabled != null ? (patch.enabled ? 1 : 0) : existing.enabled,
    now,
    id,
  );
}

export function deleteChannel(id: string): void {
  db.prepare("DELETE FROM telegram_channels WHERE id = ?").run(id);
}

export interface PostRow {
  id: string;
  offer_id: string;
  channel_id: string;
  message_text: string;
  telegram_message_id: string | null;
  status: string;
  error: string | null;
  posted_at: string | null;
  created_at: string;
}

export function createPost(input: { offerId: string; channelId: string; messageText: string }): PostRow {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO telegram_posts (id, offer_id, channel_id, message_text, status, created_at) VALUES (?, ?, ?, ?, 'queued', ?)").run(
    id,
    input.offerId,
    input.channelId,
    input.messageText,
    now,
  );
  return getPost(id)!;
}

export function getPost(id: string): PostRow | undefined {
  return db.prepare("SELECT * FROM telegram_posts WHERE id = ?").get(id) as PostRow | undefined;
}

export function markPostResult(id: string, ok: boolean, telegramMessageId?: string, error?: string): void {
  const now = new Date().toISOString();
  if (ok) {
    db.prepare("UPDATE telegram_posts SET status = 'posted', telegram_message_id = ?, posted_at = ? WHERE id = ?").run(telegramMessageId ?? null, now, id);
  } else {
    db.prepare("UPDATE telegram_posts SET status = 'failed', error = ? WHERE id = ?").run(error ?? null, id);
  }
}

export function markPostDealEnded(id: string): void {
  db.prepare("UPDATE telegram_posts SET status = 'deal_ended_updated' WHERE id = ?").run(id);
}

export function listPostsForOffer(offerId: string): PostRow[] {
  return db.prepare("SELECT * FROM telegram_posts WHERE offer_id = ? ORDER BY created_at DESC").all(offerId) as PostRow[];
}

export function postsInLastHour(channelId: string): number {
  const cutoff = new Date(Date.now() - 3600_000).toISOString();
  return (db.prepare("SELECT COUNT(*) as c FROM telegram_posts WHERE channel_id = ? AND status = 'posted' AND posted_at >= ?").get(channelId, cutoff) as {
    c: number;
  }).c;
}

export function postsToday(channelId: string): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return (
    db.prepare("SELECT COUNT(*) as c FROM telegram_posts WHERE channel_id = ? AND status = 'posted' AND posted_at >= ?").get(channelId, d.toISOString()) as {
      c: number;
    }
  ).c;
}
