-- DealBot schema. SQLite. All money stored as TEXT decimal strings (parsed
-- with Decimal.js in application code) to avoid floating-point drift,
-- matching the convention used throughout this codebase's sibling project.

CREATE TABLE IF NOT EXISTS bot_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  running INTEGER NOT NULL DEFAULT 0,
  paused INTEGER NOT NULL DEFAULT 0,
  last_scan_at TEXT,
  next_scan_at TEXT,
  last_scan_products_found INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- ---- Deal sources (spec section 1) ---------------------------------------
CREATE TABLE IF NOT EXISTS affiliate_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'demo' | 'api' | 'feed' — adapter type
  enabled INTEGER NOT NULL DEFAULT 1,
  affiliate_tag TEXT,
  countries_json TEXT NOT NULL DEFAULT '[]',
  categories_json TEXT NOT NULL DEFAULT '[]',
  commission_info_json TEXT NOT NULL DEFAULT '{}',
  config_json TEXT NOT NULL DEFAULT '{}', -- adapter-specific (base URL, etc.) — never raw secrets, those stay in env
  last_successful_scan_at TEXT,
  api_status TEXT NOT NULL DEFAULT 'unknown', -- 'ok' | 'degraded' | 'down' | 'unknown'
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ---- Products + offers (spec section 2) ----------------------------------
-- One `products` row per real-world product (deduped across merchants by
-- normalized brand+name+category when no stronger identifier like a GTIN is
-- available); one `product_offers` row per (source, merchant) listing of it,
-- so the same product from two merchants can be compared side by side.
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  dedup_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  image_url TEXT,
  rating REAL,
  review_count INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_dedup ON products (dedup_key);

CREATE TABLE IF NOT EXISTS product_offers (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id),
  source_id TEXT NOT NULL REFERENCES affiliate_sources (id),
  external_product_id TEXT NOT NULL,
  merchant TEXT NOT NULL,
  country TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  current_price TEXT NOT NULL,
  reference_price TEXT,
  discount_pct REAL,
  product_url TEXT NOT NULL,
  availability TEXT NOT NULL DEFAULT 'unknown', -- 'in_stock' | 'out_of_stock' | 'unknown'
  shipping_info TEXT,
  status TEXT NOT NULL DEFAULT 'discovered',
  -- 'discovered' | 'analyzing' | 'rejected' | 'approved' | 'queued' | 'posted'
  -- | 'expired' | 'out_of_stock' | 'error'
  reject_reason TEXT,
  first_discovered_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_posted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (source_id, external_product_id, merchant)
);
CREATE INDEX IF NOT EXISTS idx_offers_product ON product_offers (product_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON product_offers (status);

CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES product_offers (id),
  price TEXT NOT NULL,
  currency TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_price_history_offer ON price_history (offer_id, recorded_at);

-- ---- Deal verification + scoring (spec sections 3-5) ---------------------
CREATE TABLE IF NOT EXISTS deal_analysis (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES product_offers (id),
  deal_confidence REAL NOT NULL,
  discount_pct REAL,
  absolute_saving TEXT,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deal_analysis_offer ON deal_analysis (offer_id);

CREATE TABLE IF NOT EXISTS deal_scores (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES product_offers (id),
  deal_score REAL NOT NULL,
  profit_score REAL NOT NULL,
  estimated_commission TEXT,
  status_label TEXT NOT NULL, -- 'reject' | 'weak' | 'good' | 'very_good' | 'excellent'
  breakdown_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deal_scores_offer ON deal_scores (offer_id);

-- ---- Affiliate links (spec section 9) ------------------------------------
CREATE TABLE IF NOT EXISTS affiliate_links (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES product_offers (id),
  original_url TEXT NOT NULL,
  affiliate_url TEXT,
  provider TEXT NOT NULL,
  campaign_id TEXT,
  tracking_slug TEXT UNIQUE, -- our own /r/:slug redirect, for real self-hosted click tracking
  status TEXT NOT NULL DEFAULT 'pending', -- 'ok' | 'error' | 'pending'
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_offer ON affiliate_links (offer_id);

-- ---- Telegram (spec sections 7-8) ----------------------------------------
CREATE TABLE IF NOT EXISTS telegram_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  country TEXT,
  categories_json TEXT NOT NULL DEFAULT '[]',
  min_deal_score REAL NOT NULL DEFAULT 75,
  min_profit_score REAL NOT NULL DEFAULT 0,
  max_posts_per_hour INTEGER NOT NULL DEFAULT 3,
  max_posts_per_day INTEGER NOT NULL DEFAULT 20,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_posts (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES product_offers (id),
  channel_id TEXT NOT NULL REFERENCES telegram_channels (id),
  message_text TEXT NOT NULL,
  telegram_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'posted' | 'failed' | 'deal_ended_updated'
  error TEXT,
  posted_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_telegram_posts_offer ON telegram_posts (offer_id);
CREATE INDEX IF NOT EXISTS idx_telegram_posts_channel ON telegram_posts (channel_id, created_at);

-- ---- Tracking (spec section 10) ------------------------------------------
-- click_events is populated for real by our own /r/:slug redirect
-- endpoint — genuine, self-hosted click tracking, not an estimate.
-- conversions/commissions stay empty unless a real affiliate-network
-- postback/API is wired in; the dashboard must show them as "unavailable"
-- rather than inferring or fabricating figures.
CREATE TABLE IF NOT EXISTS click_events (
  id TEXT PRIMARY KEY,
  affiliate_link_id TEXT NOT NULL REFERENCES affiliate_links (id),
  offer_id TEXT NOT NULL REFERENCES product_offers (id),
  telegram_post_id TEXT REFERENCES telegram_posts (id),
  user_agent TEXT,
  clicked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_click_events_offer ON click_events (offer_id);
CREATE INDEX IF NOT EXISTS idx_click_events_link ON click_events (affiliate_link_id);

CREATE TABLE IF NOT EXISTS conversions (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES product_offers (id),
  affiliate_link_id TEXT REFERENCES affiliate_links (id),
  provider TEXT NOT NULL,
  external_conversion_id TEXT,
  order_amount TEXT,
  currency TEXT,
  reported_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversions_offer ON conversions (offer_id);

CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY,
  conversion_id TEXT NOT NULL REFERENCES conversions (id),
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'reversed' | 'paid'
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_commissions_conversion ON commissions (conversion_id);

-- ---- Ops / audit (spec section 20) ---------------------------------------
CREATE TABLE IF NOT EXISTS bot_activity (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bot_activity_created ON bot_activity (created_at);

CREATE TABLE IF NOT EXISTS api_logs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL, -- source id, 'telegram', or a provider name
  endpoint TEXT,
  success INTEGER NOT NULL,
  status_code INTEGER,
  error_message TEXT,
  latency_ms INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_logs_provider ON api_logs (provider, created_at);

-- ---- Rules (spec sections 6, 16) -----------------------------------------
-- Singleton global auto-post rule set for V1 — multiple named rule sets are
-- a natural later extension, not needed to get a working pipeline running.
CREATE TABLE IF NOT EXISTS posting_rules (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  min_deal_score REAL NOT NULL DEFAULT 75,
  min_deal_confidence REAL NOT NULL DEFAULT 80,
  min_discount_pct REAL NOT NULL DEFAULT 15,
  min_rating REAL NOT NULL DEFAULT 0,
  min_reviews INTEGER NOT NULL DEFAULT 0,
  min_estimated_commission TEXT NOT NULL DEFAULT '0',
  require_in_stock INTEGER NOT NULL DEFAULT 1,
  require_affiliate_url INTEGER NOT NULL DEFAULT 1,
  allowed_categories_json TEXT NOT NULL DEFAULT '[]', -- empty = all categories allowed
  allowed_countries_json TEXT NOT NULL DEFAULT '[]', -- empty = all countries allowed
  repost_cooldown_hours REAL NOT NULL DEFAULT 48,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blocked_products (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products (id),
  label TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blocked_brands (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
