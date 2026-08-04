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
  price_change_5m_pct TEXT,
  price_change_1h_pct TEXT,
  buys_5m INTEGER,
  sells_5m INTEGER,
  pair_created_at TEXT,
  dex_id TEXT,
  pair_address TEXT,
  quote_symbol TEXT,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_token_snapshots_mint ON token_snapshots (mint, fetched_at);

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
