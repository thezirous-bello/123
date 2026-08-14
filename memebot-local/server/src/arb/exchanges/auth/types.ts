/** Result of a real, read-only, authenticated deposit-status check against
 * one exchange. Every field is explicit about WHY a definitive answer isn't
 * available when it isn't — callers must never treat `configured: false` or
 * `checkedOk: false` as "assume enabled." */
export interface DepositCheckResult {
  /** False when this exchange has no API key configured in .env at all. */
  configured: boolean;
  /** False when a key is configured but the authenticated call itself
   * failed — bad/expired key, wrong permissions, a signing bug, or the
   * exchange being unreachable. */
  checkedOk: boolean;
  /** Null unless checkedOk is true. True/false is the exchange's own
   * reported deposit-enabled status for this coin (across at least one
   * network, for the depositEnabled=true case). */
  depositEnabled: boolean | null;
  error: string | null;
}

/** Best-effort, informational-only signal: does this exchange currently
 * show ANY non-zero balance at all. Never used in a trading decision —
 * the arb bot's own paper accounting never reads or writes real exchange
 * balances — this exists purely so the dashboard can warn "you have funds
 * here we're not touching" instead of implying the exchange is empty. */
export interface BalanceCheckResult {
  configured: boolean;
  checkedOk: boolean;
  hasNonZeroBalance: boolean | null;
  error: string | null;
}

export interface ExchangeAuthClient {
  isConfigured(): boolean;
  checkDeposit(symbol: string): Promise<DepositCheckResult>;
  checkBalance(): Promise<BalanceCheckResult>;
}
