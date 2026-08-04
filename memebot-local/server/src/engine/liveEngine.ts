import { liveTradingAllowedByConfig } from "../env.js";
import { Decimal } from "../lib/decimal.js";
import { recordLog, recordRiskEvent } from "../lib/auditLog.js";
import { getQuote, validateQuote } from "../jupiter/quote.js";
import { quoteTokenDecimals, quoteTokenMint } from "../jupiter/constants.js";
import { assertFeePayerIsOurWallet, buildSwapTransaction, signAndSendSwapTransaction, simulateSwapTransaction } from "../jupiter/swap.js";
import { getQuoteTokenUsdPrice, getSolUsdPrice } from "../market/pricing.js";
import { getSolBalance, getTokenBalances, isWalletConfigured } from "../wallet/walletManager.js";
import type { TakeProfitLevel } from "../strategy/schema.js";
import { applyExit, createPosition, recordTrade, tradeExistsForIdempotencyKey, type Position } from "./positionRepository.js";

const MAX_PRIORITY_FEE_LAMPORTS = 200_000; // ~$0.03 at $150/SOL — hard ceiling regardless of "auto" estimation

export interface LiveTradeResult {
  ok: boolean;
  position?: Position;
  reasons: string[];
}

export interface LiveBuyParams {
  mint: string;
  symbol: string | null;
  decimals: number;
  strategyId: string;
  quoteToken: "SOL" | "USDC";
  tradeUsd: Decimal;
  slippageBps: number;
  maxPriceImpactPercentage: number;
  maxQuoteAgeSeconds: number;
  stopLossPercentage: number | null;
  takeProfits: TakeProfitLevel[];
  trailingStopPercentage: number | null;
  maxHoldingPeriodMinutes: number | null;
  entryReason: Record<string, unknown>;
  idempotencyKey: string;
}

/**
 * Live buy path. Every step here is a hard gate — a failure at any stage
 * aborts the whole trade and nothing is signed or recorded as a position.
 * This function assumes `assessEntryRisk` already approved the trade; it
 * re-validates the quote itself regardless, since risk approval happens
 * before the quote exists.
 */
export async function executeLiveBuy(params: LiveBuyParams): Promise<LiveTradeResult> {
  if (!liveTradingAllowedByConfig) {
    return { ok: false, reasons: ['Live trading is disabled by server configuration (LIVE_TRADING_ENABLED is not "true").'] };
  }
  if (!isWalletConfigured()) {
    return { ok: false, reasons: ["No trading wallet is configured."] };
  }
  if (tradeExistsForIdempotencyKey(params.idempotencyKey)) {
    return { ok: false, reasons: ["Duplicate order: this idempotency key was already used."] };
  }

  const quoteTokenPrice = await getQuoteTokenUsdPrice(params.quoteToken);
  const inputMint = quoteTokenMint(params.quoteToken);
  const inputDecimals = quoteTokenDecimals(params.quoteToken);
  const amountInBaseUnits = params.tradeUsd.div(quoteTokenPrice).times(10 ** inputDecimals).toFixed(0);

  const quote = await getQuote({ inputMint, outputMint: params.mint, amountBaseUnits: amountInBaseUnits, slippageBps: params.slippageBps });
  if (!quote) return { ok: false, reasons: ["No Jupiter quote available."] };

  const validation = validateQuote(quote, {
    expectedInputMint: inputMint,
    expectedOutputMint: params.mint,
    maxPriceImpactPct: params.maxPriceImpactPercentage,
    maxQuoteAgeSeconds: params.maxQuoteAgeSeconds,
  });
  if (!validation.ok) return { ok: false, reasons: validation.reasons };

  const solBalanceBefore = await getSolBalance();
  const tokenBalancesBefore = await getTokenBalances();
  const tokenBefore = tokenBalancesBefore.find((b) => b.mint === params.mint);
  const rawBefore = tokenBefore ? BigInt(tokenBefore.amount) : 0n;

  const built = await buildSwapTransaction(quote, MAX_PRIORITY_FEE_LAMPORTS);
  if (!built) return { ok: false, reasons: ["Failed to build swap transaction."] };

  try {
    assertFeePayerIsOurWallet(built.transaction);
  } catch (err) {
    recordRiskEvent("unexpected_transaction", "critical", (err as Error).message, { mint: params.mint });
    return { ok: false, reasons: [(err as Error).message] };
  }

  const simulation = await simulateSwapTransaction(built.transaction);
  if (!simulation.ok) {
    recordLog("error", "live_trade", `Buy simulation failed for ${params.symbol ?? params.mint}: ${simulation.error}`, {
      mint: params.mint,
      logs: simulation.logs,
    });
    return { ok: false, reasons: [`Transaction simulation failed: ${simulation.error}`] };
  }

  const send = await signAndSendSwapTransaction(built);
  if (!send.confirmed) {
    recordTrade({
      positionId: null,
      mint: params.mint,
      symbol: params.symbol,
      side: "buy",
      mode: "live",
      amountUsd: params.tradeUsd,
      tokenAmount: new Decimal(0),
      priceUsd: new Decimal(0),
      feeUsd: new Decimal(0),
      networkFeeUsd: new Decimal(0),
      slippageBps: params.slippageBps,
      priceImpactPct: Number.parseFloat(quote.priceImpactPct) * 100,
      quoteId: null,
      txSignature: send.signature,
      status: "failed",
      failureReason: send.error,
      idempotencyKey: params.idempotencyKey,
    });
    recordRiskEvent("trade_failed", "critical", `Live buy failed to confirm: ${send.error}`, { mint: params.mint, signature: send.signature });
    return { ok: false, reasons: [`Transaction did not confirm: ${send.error}`] };
  }

  // Reconcile against actual on-chain balance change rather than trusting
  // the quote's predicted output.
  const [solBalanceAfter, tokenBalancesAfter] = await Promise.all([getSolBalance(), getTokenBalances()]);
  const tokenAfter = tokenBalancesAfter.find((b) => b.mint === params.mint);
  const rawAfter = tokenAfter ? BigInt(tokenAfter.amount) : 0n;
  const actualTokensReceived = new Decimal((rawAfter - rawBefore).toString()).div(10 ** params.decimals);

  if (actualTokensReceived.lte(0)) {
    recordRiskEvent("balance_mismatch", "critical", "Transaction confirmed but no token balance increase was observed.", {
      mint: params.mint,
      signature: send.signature,
    });
    return { ok: false, reasons: ["Transaction confirmed but no tokens were received — see risk log."] };
  }

  const solSpent = solBalanceBefore.minus(solBalanceAfter);
  const solUsdPrice = await getSolUsdPrice();
  const actualCostUsd = params.quoteToken === "SOL" ? solSpent.times(solUsdPrice) : params.tradeUsd;
  const entryPriceUsd = actualCostUsd.div(actualTokensReceived);

  const position = createPosition({
    mint: params.mint,
    symbol: params.symbol,
    decimals: params.decimals,
    mode: "live",
    strategyId: params.strategyId,
    entryPriceUsd,
    entryAmountUsd: params.tradeUsd,
    tokenAmount: actualTokensReceived,
    costBasisUsd: actualCostUsd,
    stopLossPercentage: params.stopLossPercentage,
    takeProfits: params.takeProfits,
    trailingStopPercentage: params.trailingStopPercentage,
    maxHoldingPeriodMinutes: params.maxHoldingPeriodMinutes,
    entryReason: params.entryReason,
    entryTxSignature: send.signature,
  });

  recordTrade({
    positionId: position.id,
    mint: params.mint,
    symbol: params.symbol,
    side: "buy",
    mode: "live",
    amountUsd: actualCostUsd,
    tokenAmount: actualTokensReceived,
    priceUsd: entryPriceUsd,
    feeUsd: new Decimal(0),
    networkFeeUsd: new Decimal(0),
    slippageBps: params.slippageBps,
    priceImpactPct: Number.parseFloat(quote.priceImpactPct) * 100,
    quoteId: null,
    txSignature: send.signature,
    status: "confirmed",
    failureReason: null,
    idempotencyKey: params.idempotencyKey,
  });

  recordLog("info", "live_trade", `LIVE BUY confirmed: $${actualCostUsd.toFixed(2)} of ${params.symbol ?? params.mint}`, {
    mint: params.mint,
    signature: send.signature,
  });

  return { ok: true, position, reasons: [] };
}

export interface LiveSellParams {
  position: Position;
  sellTokenAmount: Decimal;
  quoteToken: "SOL" | "USDC";
  slippageBps: number;
  maxPriceImpactPercentage: number;
  maxQuoteAgeSeconds: number;
  reason: string;
  idempotencyKey: string;
}

export async function executeLiveSell(params: LiveSellParams): Promise<LiveTradeResult> {
  if (!liveTradingAllowedByConfig) {
    return { ok: false, reasons: ['Live trading is disabled by server configuration (LIVE_TRADING_ENABLED is not "true").'] };
  }
  if (!isWalletConfigured()) return { ok: false, reasons: ["No trading wallet is configured."] };
  if (tradeExistsForIdempotencyKey(params.idempotencyKey)) {
    return { ok: false, reasons: ["Duplicate order: this idempotency key was already used."] };
  }

  const outputMint = quoteTokenMint(params.quoteToken);
  const amountInBaseUnits = params.sellTokenAmount.times(10 ** params.position.decimals).toFixed(0);

  const quote = await getQuote({ inputMint: params.position.mint, outputMint, amountBaseUnits: amountInBaseUnits, slippageBps: params.slippageBps });
  if (!quote) return { ok: false, reasons: ["No Jupiter quote available to sell this token."] };

  const validation = validateQuote(quote, {
    expectedInputMint: params.position.mint,
    expectedOutputMint: outputMint,
    maxPriceImpactPct: params.maxPriceImpactPercentage,
    maxQuoteAgeSeconds: params.maxQuoteAgeSeconds,
  });
  if (!validation.ok) return { ok: false, reasons: validation.reasons };

  const solBalanceBefore = await getSolBalance();

  const built = await buildSwapTransaction(quote, MAX_PRIORITY_FEE_LAMPORTS);
  if (!built) return { ok: false, reasons: ["Failed to build swap transaction."] };

  try {
    assertFeePayerIsOurWallet(built.transaction);
  } catch (err) {
    recordRiskEvent("unexpected_transaction", "critical", (err as Error).message, { mint: params.position.mint });
    return { ok: false, reasons: [(err as Error).message] };
  }

  const simulation = await simulateSwapTransaction(built.transaction);
  if (!simulation.ok) {
    recordLog("error", "live_trade", `Sell simulation failed for ${params.position.symbol ?? params.position.mint}: ${simulation.error}`, {
      positionId: params.position.id,
      logs: simulation.logs,
    });
    return { ok: false, reasons: [`Transaction simulation failed: ${simulation.error}`] };
  }

  const send = await signAndSendSwapTransaction(built);
  if (!send.confirmed) {
    recordRiskEvent("trade_failed", "critical", `Live sell failed to confirm: ${send.error}`, {
      positionId: params.position.id,
      signature: send.signature,
    });
    return { ok: false, reasons: [`Transaction did not confirm: ${send.error}`] };
  }

  const solBalanceAfter = await getSolBalance();
  const solUsdPrice = await getSolUsdPrice();
  const solReceived = params.quoteToken === "SOL" ? solBalanceAfter.minus(solBalanceBefore) : new Decimal(0);
  const grossProceedsUsd =
    params.quoteToken === "SOL"
      ? solReceived.times(solUsdPrice)
      : new Decimal(quote.outAmount).div(10 ** quoteTokenDecimals(params.quoteToken));

  const updatedPosition = applyExit(params.position.id, {
    soldTokenAmount: params.sellTokenAmount,
    proceedsUsd: grossProceedsUsd,
    takeProfitIndexFilled: params.reason.startsWith("take_profit_")
      ? Number.parseInt(params.reason.replace("take_profit_", ""), 10)
      : undefined,
    closeReason: params.reason,
  });

  recordTrade({
    positionId: params.position.id,
    mint: params.position.mint,
    symbol: params.position.symbol,
    side: "sell",
    mode: "live",
    amountUsd: grossProceedsUsd,
    tokenAmount: params.sellTokenAmount,
    priceUsd: grossProceedsUsd.div(params.sellTokenAmount),
    feeUsd: new Decimal(0),
    networkFeeUsd: new Decimal(0),
    slippageBps: params.slippageBps,
    priceImpactPct: Number.parseFloat(quote.priceImpactPct) * 100,
    quoteId: null,
    txSignature: send.signature,
    status: "confirmed",
    failureReason: null,
    idempotencyKey: params.idempotencyKey,
  });

  recordLog("info", "live_trade", `LIVE SELL confirmed: ${params.sellTokenAmount.toFixed(4)} ${params.position.symbol ?? params.position.mint}`, {
    positionId: params.position.id,
    signature: send.signature,
  });

  return { ok: true, position: updatedPosition, reasons: [] };
}
