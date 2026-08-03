import { Decimal } from "../lib/decimal.js";
import { recordLog } from "../lib/auditLog.js";
import { getQuote, validateQuote } from "../jupiter/quote.js";
import { quoteTokenDecimals, quoteTokenMint } from "../jupiter/constants.js";
import { getQuoteTokenUsdPrice, getSolUsdPrice } from "../market/pricing.js";
import type { TakeProfitLevel } from "../strategy/schema.js";
import { adjustPaperCash, getPaperAccount } from "./paperAccount.js";
import { applyExit, createPosition, recordTrade, tradeExistsForIdempotencyKey, type Position } from "./positionRepository.js";

// Conservative fixed simulated network costs, in lamports. Real Solana
// transfer fees are ~5,000 lamports; priority fees vary with congestion —
// 50,000 lamports (~$0.0075 at $150/SOL) approximates a "medium" priority
// fee so paper PnL isn't unrealistically clean.
const SIMULATED_NETWORK_FEE_LAMPORTS = 5_000;
const SIMULATED_PRIORITY_FEE_LAMPORTS = 50_000;

export interface PaperBuyParams {
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

export interface PaperTradeResult {
  ok: boolean;
  position?: Position;
  reasons: string[];
}

async function simulatedFeesUsd(): Promise<{ networkFeeUsd: Decimal; priorityFeeUsd: Decimal }> {
  const solPrice = await getSolUsdPrice();
  return {
    networkFeeUsd: new Decimal(SIMULATED_NETWORK_FEE_LAMPORTS).div(1e9).times(solPrice),
    priorityFeeUsd: new Decimal(SIMULATED_PRIORITY_FEE_LAMPORTS).div(1e9).times(solPrice),
  };
}

export async function executePaperBuy(params: PaperBuyParams): Promise<PaperTradeResult> {
  if (tradeExistsForIdempotencyKey(params.idempotencyKey)) {
    return { ok: false, reasons: ["Duplicate order: this idempotency key was already used."] };
  }

  const quoteTokenPrice = await getQuoteTokenUsdPrice(params.quoteToken);
  const inputMint = quoteTokenMint(params.quoteToken);
  const inputDecimals = quoteTokenDecimals(params.quoteToken);
  const amountInBaseUnits = params.tradeUsd.div(quoteTokenPrice).times(10 ** inputDecimals).toFixed(0);

  const quote = await getQuote({
    inputMint,
    outputMint: params.mint,
    amountBaseUnits: amountInBaseUnits,
    slippageBps: params.slippageBps,
  });
  if (!quote) return { ok: false, reasons: ["No Jupiter quote available for this token right now."] };

  const validation = validateQuote(quote, {
    expectedInputMint: inputMint,
    expectedOutputMint: params.mint,
    maxPriceImpactPct: params.maxPriceImpactPercentage,
    maxQuoteAgeSeconds: params.maxQuoteAgeSeconds,
  });
  if (!validation.ok) return { ok: false, reasons: validation.reasons };

  // Simulate realistic (not best-case) execution: fill somewhere between the
  // quote's minimum-out threshold and its expected-out amount.
  const simulatedSlippageFraction = Math.random() * (params.slippageBps / 10_000);
  const outAmount = new Decimal(quote.outAmount).times(1 - simulatedSlippageFraction);
  const tokenAmountUi = outAmount.div(10 ** params.decimals);
  if (tokenAmountUi.lte(0)) return { ok: false, reasons: ["Simulated fill amount was zero."] };

  const { networkFeeUsd, priorityFeeUsd } = await simulatedFeesUsd();
  const costBasisUsd = params.tradeUsd.plus(networkFeeUsd).plus(priorityFeeUsd);

  const account = getPaperAccount();
  if (account.cashBalanceUsd.lt(costBasisUsd)) {
    return { ok: false, reasons: [`Insufficient paper balance: need $${costBasisUsd.toFixed(2)}, have $${account.cashBalanceUsd.toFixed(2)}.`] };
  }

  const entryPriceUsd = params.tradeUsd.div(tokenAmountUi);

  adjustPaperCash(costBasisUsd.negated());
  const position = createPosition({
    mint: params.mint,
    symbol: params.symbol,
    decimals: params.decimals,
    mode: "paper",
    strategyId: params.strategyId,
    entryPriceUsd,
    entryAmountUsd: params.tradeUsd,
    tokenAmount: tokenAmountUi,
    costBasisUsd,
    stopLossPercentage: params.stopLossPercentage,
    takeProfits: params.takeProfits,
    trailingStopPercentage: params.trailingStopPercentage,
    maxHoldingPeriodMinutes: params.maxHoldingPeriodMinutes,
    entryReason: params.entryReason,
    entryTxSignature: null,
  });

  recordTrade({
    positionId: position.id,
    mint: params.mint,
    symbol: params.symbol,
    side: "buy",
    mode: "paper",
    amountUsd: params.tradeUsd,
    tokenAmount: tokenAmountUi,
    priceUsd: entryPriceUsd,
    feeUsd: new Decimal(0),
    networkFeeUsd: networkFeeUsd.plus(priorityFeeUsd),
    slippageBps: Math.round(simulatedSlippageFraction * 10_000),
    priceImpactPct: Number.parseFloat(quote.priceImpactPct) * 100,
    quoteId: quote.contextSlot ? String(quote.contextSlot) : null,
    txSignature: null,
    status: "simulated",
    failureReason: null,
    idempotencyKey: params.idempotencyKey,
  });

  recordLog("info", "paper_trade", `Paper BUY $${params.tradeUsd.toFixed(2)} of ${params.symbol ?? params.mint}`, {
    positionId: position.id,
    mint: params.mint,
  });

  return { ok: true, position, reasons: [] };
}

export interface PaperSellParams {
  position: Position;
  sellTokenAmount: Decimal;
  quoteToken: "SOL" | "USDC";
  slippageBps: number;
  maxPriceImpactPercentage: number;
  maxQuoteAgeSeconds: number;
  reason: string;
  idempotencyKey: string;
}

export async function executePaperSell(params: PaperSellParams): Promise<PaperTradeResult> {
  if (tradeExistsForIdempotencyKey(params.idempotencyKey)) {
    return { ok: false, reasons: ["Duplicate order: this idempotency key was already used."] };
  }
  if (params.sellTokenAmount.lte(0)) return { ok: false, reasons: ["Nothing to sell."] };

  const outputMint = quoteTokenMint(params.quoteToken);
  const amountInBaseUnits = params.sellTokenAmount.times(10 ** params.position.decimals).toFixed(0);

  const quote = await getQuote({
    inputMint: params.position.mint,
    outputMint,
    amountBaseUnits: amountInBaseUnits,
    slippageBps: params.slippageBps,
  });
  if (!quote) return { ok: false, reasons: ["No Jupiter quote available to sell this token right now."] };

  const validation = validateQuote(quote, {
    expectedInputMint: params.position.mint,
    expectedOutputMint: outputMint,
    maxPriceImpactPct: params.maxPriceImpactPercentage,
    maxQuoteAgeSeconds: params.maxQuoteAgeSeconds,
  });
  if (!validation.ok) return { ok: false, reasons: validation.reasons };

  const simulatedSlippageFraction = Math.random() * (params.slippageBps / 10_000);
  const quoteTokenPrice = await getQuoteTokenUsdPrice(params.quoteToken);
  const outputDecimals = quoteTokenDecimals(params.quoteToken);
  const outAmount = new Decimal(quote.outAmount).times(1 - simulatedSlippageFraction);
  const proceedsQuoteTokenUi = outAmount.div(10 ** outputDecimals);
  const grossProceedsUsd = proceedsQuoteTokenUi.times(quoteTokenPrice);

  const { networkFeeUsd, priorityFeeUsd } = await simulatedFeesUsd();
  const netProceedsUsd = grossProceedsUsd.minus(networkFeeUsd).minus(priorityFeeUsd);
  const fillPriceUsd = grossProceedsUsd.div(params.sellTokenAmount);

  adjustPaperCash(netProceedsUsd);
  const updatedPosition = applyExit(params.position.id, {
    soldTokenAmount: params.sellTokenAmount,
    proceedsUsd: netProceedsUsd,
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
    mode: "paper",
    amountUsd: netProceedsUsd,
    tokenAmount: params.sellTokenAmount,
    priceUsd: fillPriceUsd,
    feeUsd: new Decimal(0),
    networkFeeUsd: networkFeeUsd.plus(priorityFeeUsd),
    slippageBps: Math.round(simulatedSlippageFraction * 10_000),
    priceImpactPct: Number.parseFloat(quote.priceImpactPct) * 100,
    quoteId: quote.contextSlot ? String(quote.contextSlot) : null,
    txSignature: null,
    status: "simulated",
    failureReason: null,
    idempotencyKey: params.idempotencyKey,
  });

  recordLog(
    "info",
    "paper_trade",
    `Paper SELL ${params.sellTokenAmount.toFixed(4)} ${params.position.symbol ?? params.position.mint} (${params.reason})`,
    { positionId: params.position.id, reason: params.reason },
  );

  return { ok: true, position: updatedPosition, reasons: [] };
}
