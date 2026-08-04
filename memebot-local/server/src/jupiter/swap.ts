import { VersionedTransaction } from "@solana/web3.js";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { connection } from "../market/rpc.js";
import { getWalletPublicKey, signTransaction } from "../wallet/walletManager.js";
import type { QuoteResponse } from "./quote.js";

interface SwapApiResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

export interface BuiltSwap {
  transaction: VersionedTransaction;
  lastValidBlockHeight: number;
}

function jupiterHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (env.JUPITER_API_KEY) headers["x-api-key"] = env.JUPITER_API_KEY;
  return headers;
}

/** Builds an unsigned swap transaction from a previously-validated quote.
 * Uses conservative, documented Jupiter options: dynamic compute unit limit
 * (accurate priority fees) and "auto" prioritization fee, capped by the
 * caller's own lamport ceiling. */
export async function buildSwapTransaction(
  quoteResponse: QuoteResponse,
  maxPriorityFeeLamports: number,
): Promise<BuiltSwap | null> {
  const userPublicKey = getWalletPublicKey();
  if (!userPublicKey) throw new Error("No trading wallet configured — cannot build a live swap transaction.");

  const { fetchedAtMs: _fetchedAtMs, ...rawQuote } = quoteResponse;

  try {
    const res = await fetch(`${env.JUPITER_API_URL}/swap`, {
      method: "POST",
      headers: jupiterHeaders(),
      body: JSON.stringify({
        userPublicKey: userPublicKey.toBase58(),
        quoteResponse: rawQuote,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: { priorityLevelWithMaxLamports: { priorityLevel: "medium", maxLamports: maxPriorityFeeLamports } },
      }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Jupiter swap build request failed");
      return null;
    }
    const data = (await res.json()) as SwapApiResponse;
    const transaction = VersionedTransaction.deserialize(Buffer.from(data.swapTransaction, "base64"));
    return { transaction, lastValidBlockHeight: data.lastValidBlockHeight };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Jupiter swap build errored");
    return null;
  }
}

/** Sanity check on the transaction Jupiter handed back, before we ever sign
 * it: the fee payer (first required signer) must be our own wallet. We do
 * not blindly sign arbitrary serialized transactions — this, combined with
 * the fact that we only ever build transactions from a quote we ourselves
 * requested and validated, and combined with pre-sign simulation below, is
 * the practical signing-safety boundary for a versioned/ALT transaction we
 * did not compile ourselves. */
export function assertFeePayerIsOurWallet(tx: VersionedTransaction): void {
  const expected = getWalletPublicKey();
  if (!expected) throw new Error("No trading wallet configured.");
  const feePayer = tx.message.staticAccountKeys[0];
  if (!feePayer || !feePayer.equals(expected)) {
    throw new Error("Refusing to sign: transaction fee payer does not match the configured trading wallet.");
  }
}

export interface SimulationResult {
  ok: boolean;
  error: string | null;
  unitsConsumed: number | null;
  logs: string[];
}

/** Simulates the transaction on-chain before signing. Any simulation error
 * blocks execution — this is a hard requirement, not a warning. */
export async function simulateSwapTransaction(tx: VersionedTransaction): Promise<SimulationResult> {
  try {
    const sim = await connection.simulateTransaction(tx, { sigVerify: false, commitment: "confirmed" });
    return {
      ok: sim.value.err === null,
      error: sim.value.err ? JSON.stringify(sim.value.err) : null,
      unitsConsumed: sim.value.unitsConsumed ?? null,
      logs: sim.value.logs ?? [],
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message, unitsConsumed: null, logs: [] };
  }
}

export interface SendResult {
  signature: string;
  confirmed: boolean;
  error: string | null;
}

/** Signs (via the wallet manager's private, non-exported keypair) and
 * broadcasts a simulated, validated transaction, then confirms it against
 * the blockhash's last valid block height so we never wait past expiry. */
export async function signAndSendSwapTransaction(built: BuiltSwap): Promise<SendResult> {
  const signed = signTransaction(built.transaction);
  const rawTransaction = signed.serialize();

  const signature = await connection.sendRawTransaction(rawTransaction, {
    skipPreflight: false,
    maxRetries: 3,
  });

  try {
    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: built.lastValidBlockHeight,
      },
      "confirmed",
    );
    if (confirmation.value.err) {
      return { signature, confirmed: false, error: JSON.stringify(confirmation.value.err) };
    }
    return { signature, confirmed: true, error: null };
  } catch (err) {
    return { signature, confirmed: false, error: (err as Error).message };
  }
}
