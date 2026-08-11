-- MemeBot Local database schema.
-- Monetary and token-amount columns are stored as TEXT holding a decimal
-- string (never REAL/FLOAT) so they can be loaded straight into Decimal.js
-- without floating-point rounding error.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bot_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  running INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'paper' CHECK (mode IN ('paper', 'live')),
  active_strategy_id TEXT,
  emergency_stopped INTEGER NOT NULL DEFAULT 0,
  emergency_stopped_at TEXT,
  emergency_stopped_reason TEXT,
  emergency_stopped_by TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  raw_instruction TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_versions (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL REFERENCES strategies (id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_strategy_versions_strategy ON strategy_versions (strategy_id);

CREATE TABLE IF NOT EXISTS watchlist (
  mint TEXT PRIMARY KEY,
  symbol TEXT,
  name TEXT,
  blocked INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS token_snapshots (
  id TEXT PRIMARY KEY,
  mint TEXT NOT NULL,
  symbol TEXT,
  name TEXT,
  price_usd TEXT,
  liquidity_usd TEXT,
  market_cap_usd TEXT,
  fdv_usd TEXT,
  volume_5m_usd TEXT,
  volume_1h_usd TEXT,
  volume_6h_usd TEXT,
  volume_24h_usd TEXT,
  price_change_5m_pct TEXT,
  price_change_1h_pct TEXT,
  price_change_6h_pct TEXT,
  price_change_24h_pct TEXT,
  buys_5m INTEGER,
  sells_5m INTEGER,
  buys_1h INTEGER,
  sells_1h INTEGER,
  buys_6h INTEGER,
  sells_6h INTEGER,
  buys_24h INTEGER,
  sells_24h INTEGER,
  pair_created_at TEXT,
  dex_id TEXT,
  pair_address TEXT,
  quote_symbol TEXT,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_token_snapshots_mint ON token_snapshots (mint, fetched_at);

-- Momentum score computed at each scan (discovery pass or open-position
-- monitoring), independent of security_checks (risk, not opportunity).
-- Backs the live ranked opportunity table and the audit trail of what the
-- bot saw and decided for every candidate, not just the ones it traded.
CREATE TABLE IF NOT EXISTS momentum_scores (
  id TEXT PRIMARY KEY,
  mint TEXT NOT NULL,
  symbol TEXT,
  total_score REAL NOT NULL,
  -- Every one of these six is null whenever that component's underlying
  -- market data isn't available for a given token (common — e.g. no
  -- liquidity figure, or no buy/sell transaction counts) — computeMomentumScore
  -- deliberately excludes missing data rather than fabricating a neutral
  -- value, so these must stay nullable. Do not add NOT NULL back here.
  price_momentum_score REAL,
  volume_acceleration_score REAL,
  buy_pressure_score REAL,
  tx_acceleration_score REAL,
  liquidity_quality_score REAL,
  trend_strength_score REAL,
  execution_quality_score REAL,
  trend_direction TEXT NOT NULL CHECK (trend_direction IN ('bullish', 'bearish', 'neutral')),
  momentum_accelerating INTEGER NOT NULL DEFAULT 0,
  exhaustion_warning INTEGER NOT NULL DEFAULT 0,
  volume_accelerating INTEGER NOT NULL DEFAULT 0,
  buy_pressure_dominant INTEGER NOT NULL DEFAULT 0,
  tx_accelerating INTEGER NOT NULL DEFAULT 0,
  buy_sell_ratio REAL,
  price_impact_pct REAL,
  liquidity_usd REAL,
  trade_status TEXT NOT NULL CHECK (trade_status IN ('watching', 'signal', 'entered', 'rejected')),
  rejection_reason TEXT,
  checked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_momentum_scores_mint ON momentum_scores (mint, checked_at);
CREATE INDEX IF NOT EXISTS idx_momentum_scores_checked ON momentum_scores (checked_at);

CREATE TABLE IF NOT EXISTS security_checks (
  id TEXT PRIMARY KEY,
  mint TEXT NOT NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  findings_json TEXT NOT NULL,
  missing_checks_json TEXT NOT NULL DEFAULT '[]',
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  sell_simulation_ok INTEGER,
  mint_authority_disabled INTEGER,
  freeze_authority_disabled INTEGER,
  data_source TEXT NOT NULL,
  checked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_checks_mint ON security_checks (mint, checked_at);

CREATE TABLE IF NOT EXISTS paper_account (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  starting_balance_usd TEXT NOT NULL,
  cash_balance_usd TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  mint TEXT NOT NULL,
  symbol TEXT,
  decimals INTEGER NOT NULL DEFAULT 9,
  mode TEXT NOT NULL CHECK (mode IN ('paper', 'live')),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  strategy_id TEXT REFERENCES strategies (id) ON DELETE SET NULL,
  entry_price_usd TEXT NOT NULL,
  entry_amount_usd TEXT NOT NULL,
  token_amount TEXT NOT NULL,
  remaining_token_amount TEXT NOT NULL,
  cost_basis_usd TEXT NOT NULL,
  stop_loss_percentage TEXT,
  take_profits_json TEXT NOT NULL DEFAULT '[]',
  take_profits_filled_json TEXT NOT NULL DEFAULT '[]',
  trailing_stop_percentage TEXT,
  trailing_stop_high_usd TEXT,
  lowest_price_seen_usd TEXT,
  max_holding_period_minutes INTEGER,
  entry_reason_json TEXT NOT NULL DEFAULT '{}',
  entry_tx_signature TEXT,
  realized_pnl_usd TEXT NOT NULL DEFAULT '0',
  close_reason TEXT,
  opened_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_positions_status ON positions (status, mode);
CREATE INDEX IF NOT EXISTS idx_positions_mint ON positions (mint);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  position_id TEXT REFERENCES positions (id) ON DELETE SET NULL,
  mint TEXT NOT NULL,
  symbol TEXT,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  mode TEXT NOT NULL CHECK (mode IN ('paper', 'live')),
  amount_usd TEXT NOT NULL,
  token_amount TEXT NOT NULL,
  price_usd TEXT NOT NULL,
  fee_usd TEXT NOT NULL DEFAULT '0',
  network_fee_usd TEXT NOT NULL DEFAULT '0',
  slippage_bps INTEGER,
  price_impact_pct TEXT,
  quote_id TEXT,
  tx_signature TEXT,
  status TEXT NOT NULL CHECK (status IN ('simulated', 'submitted', 'confirmed', 'failed')),
  failure_reason TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_position ON trades (position_id);
CREATE INDEX IF NOT EXISTS idx_trades_created ON trades (created_at);

CREATE TABLE IF NOT EXISTS risk_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bot_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_logs_created ON bot_logs (created_at);

-- ============================================================
-- Bybit spot bot — fully independent from the Solana bot above.
-- Shares only `settings`, `bot_logs`, and `risk_events` (via distinct
-- category/type prefixes) so all bots show up in one audit trail.
-- Spot has no leverage/margin/shorting — every position is a plain buy,
-- held, then sold.
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_bot_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  running INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'testnet' CHECK (mode IN ('testnet', 'live')),
  emergency_stopped INTEGER NOT NULL DEFAULT 0,
  emergency_stopped_at TEXT,
  emergency_stopped_reason TEXT,
  emergency_stopped_by TEXT,
  consecutive_losses INTEGER NOT NULL DEFAULT 0,
  trading_halted_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spot_signals (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'filled', 'cancelled', 'expired')) DEFAULT 'pending',
  entry_price TEXT NOT NULL,
  stop_loss TEXT NOT NULL,
  take_profits_json TEXT NOT NULL DEFAULT '[]',
  score TEXT NOT NULL,
  stage1_json TEXT NOT NULL DEFAULT '{}',
  stage2_json TEXT NOT NULL DEFAULT '{}',
  cancelled_reason TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_signals_status ON spot_signals (status, created_at);
CREATE INDEX IF NOT EXISTS idx_spot_signals_symbol ON spot_signals (symbol);

CREATE TABLE IF NOT EXISTS spot_positions (
  id TEXT PRIMARY KEY,
  signal_id TEXT REFERENCES spot_signals (id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long')),
  mode TEXT NOT NULL CHECK (mode IN ('testnet', 'live')),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  entry_price TEXT NOT NULL,
  qty TEXT NOT NULL,
  remaining_qty TEXT NOT NULL,
  notional_usd TEXT NOT NULL,
  stop_loss TEXT NOT NULL,
  take_profits_json TEXT NOT NULL DEFAULT '[]',
  take_profits_filled_json TEXT NOT NULL DEFAULT '[]',
  breakeven_moved INTEGER NOT NULL DEFAULT 0,
  trailing_active INTEGER NOT NULL DEFAULT 0,
  trailing_stop_price TEXT,
  bybit_order_id TEXT,
  realized_pnl_usd TEXT NOT NULL DEFAULT '0',
  close_reason TEXT,
  opened_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_spot_positions_status ON spot_positions (status, mode);
CREATE INDEX IF NOT EXISTS idx_spot_positions_symbol ON spot_positions (symbol);

CREATE TABLE IF NOT EXISTS spot_trades (
  id TEXT PRIMARY KEY,
  position_id TEXT REFERENCES spot_positions (id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  mode TEXT NOT NULL CHECK (mode IN ('testnet', 'live')),
  qty TEXT NOT NULL,
  price_usd TEXT NOT NULL,
  notional_usd TEXT NOT NULL,
  fee_usd TEXT NOT NULL DEFAULT '0',
  bybit_order_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('simulated', 'submitted', 'confirmed', 'failed')),
  failure_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_trades_position ON spot_trades (position_id);
CREATE INDEX IF NOT EXISTS idx_spot_trades_created ON spot_trades (created_at);

-- ============================================================
-- Bybit futures bot — the third, independent bot. Unlike spot, this one
-- trades leveraged USDT perpetuals in both directions (long AND short),
-- with dynamic leverage and position sizing driven by a per-signal
-- confidence score.
-- ============================================================

CREATE TABLE IF NOT EXISTS futures_bot_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  running INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'testnet' CHECK (mode IN ('testnet', 'live')),
  emergency_stopped INTEGER NOT NULL DEFAULT 0,
  emergency_stopped_at TEXT,
  emergency_stopped_reason TEXT,
  emergency_stopped_by TEXT,
  consecutive_losses INTEGER NOT NULL DEFAULT 0,
  trading_halted_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS futures_signals (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'filled', 'cancelled', 'expired')) DEFAULT 'pending',
  entry_price TEXT NOT NULL,
  stop_loss TEXT NOT NULL,
  take_profits_json TEXT NOT NULL DEFAULT '[]',
  score TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  leverage INTEGER NOT NULL,
  position_size_pct TEXT NOT NULL,
  stage1_json TEXT NOT NULL DEFAULT '{}',
  stage2_json TEXT NOT NULL DEFAULT '{}',
  cancelled_reason TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_futures_signals_status ON futures_signals (status, created_at);
CREATE INDEX IF NOT EXISTS idx_futures_signals_symbol ON futures_signals (symbol);

CREATE TABLE IF NOT EXISTS futures_positions (
  id TEXT PRIMARY KEY,
  signal_id TEXT REFERENCES futures_signals (id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  mode TEXT NOT NULL CHECK (mode IN ('testnet', 'live')),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  leverage INTEGER NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  entry_price TEXT NOT NULL,
  qty TEXT NOT NULL,
  remaining_qty TEXT NOT NULL,
  notional_usd TEXT NOT NULL,
  margin_usd TEXT NOT NULL,
  stop_loss TEXT NOT NULL,
  take_profits_json TEXT NOT NULL DEFAULT '[]',
  take_profits_filled_json TEXT NOT NULL DEFAULT '[]',
  breakeven_moved INTEGER NOT NULL DEFAULT 0,
  trailing_active INTEGER NOT NULL DEFAULT 0,
  trailing_stop_price TEXT,
  bybit_order_id TEXT,
  realized_pnl_usd TEXT NOT NULL DEFAULT '0',
  close_reason TEXT,
  opened_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_futures_positions_status ON futures_positions (status, mode);
CREATE INDEX IF NOT EXISTS idx_futures_positions_symbol ON futures_positions (symbol);

CREATE TABLE IF NOT EXISTS futures_trades (
  id TEXT PRIMARY KEY,
  position_id TEXT REFERENCES futures_positions (id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('open_long', 'open_short', 'close_long', 'close_short')),
  mode TEXT NOT NULL CHECK (mode IN ('testnet', 'live')),
  qty TEXT NOT NULL,
  price_usd TEXT NOT NULL,
  notional_usd TEXT NOT NULL,
  fee_usd TEXT NOT NULL DEFAULT '0',
  bybit_order_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('simulated', 'submitted', 'confirmed', 'failed')),
  failure_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_futures_trades_position ON futures_trades (position_id);
CREATE INDEX IF NOT EXISTS idx_futures_trades_created ON futures_trades (created_at);

-- ============================================================
-- Cross-exchange arbitrage bot — the fourth, independent bot. Paper-only:
-- watches public price feeds across several exchanges (no API keys needed
-- for market data) and simulates buying on whichever is cheapest and
-- selling on whichever is priciest for the same coin, net of an estimated
-- round-trip fee. No real orders, no real exchange credentials — see
-- arb/controller.ts for why (execution-speed and pre-funding realities
-- make literal live cross-exchange arbitrage a much bigger undertaking).
-- ============================================================

CREATE TABLE IF NOT EXISTS arb_bot_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  running INTEGER NOT NULL DEFAULT 0,
  emergency_stopped INTEGER NOT NULL DEFAULT 0,
  emergency_stopped_at TEXT,
  emergency_stopped_reason TEXT,
  emergency_stopped_by TEXT,
  last_scan_at TEXT,
  total_scans INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS arb_paper_account (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  starting_balance_usd TEXT NOT NULL,
  cash_balance_usd TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS arb_opportunities (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  buy_exchange TEXT NOT NULL,
  buy_price TEXT NOT NULL,
  sell_exchange TEXT NOT NULL,
  sell_price TEXT NOT NULL,
  gross_spread_pct TEXT NOT NULL,
  net_spread_pct TEXT NOT NULL,
  acted INTEGER NOT NULL DEFAULT 0,
  skip_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_arb_opportunities_created ON arb_opportunities (created_at);
CREATE INDEX IF NOT EXISTS idx_arb_opportunities_symbol ON arb_opportunities (symbol);

CREATE TABLE IF NOT EXISTS arb_trades (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT REFERENCES arb_opportunities (id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  buy_exchange TEXT NOT NULL,
  buy_price TEXT NOT NULL,
  sell_exchange TEXT NOT NULL,
  sell_price TEXT NOT NULL,
  qty TEXT NOT NULL,
  notional_usd TEXT NOT NULL,
  gross_profit_usd TEXT NOT NULL,
  fee_usd TEXT NOT NULL,
  net_profit_usd TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_arb_trades_created ON arb_trades (created_at);
