import { Keypair, LAMPORTS_PER_SOL, PublicKey, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { env } from "../env.js";
import { connection } from "../market/rpc.js";
import { Decimal } from "../lib/decimal.js";
import { logger } from "../lib/logger.js";

function parsePrivateKey(raw: string): Keypair {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    const bytes = Uint8Array.from(JSON.parse(trimmed) as number[]);
    return Keypair.fromSecretKey(bytes);
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

// Kept module-private on purpose: nothing outside this file ever touches the
// Keypair or its secret bytes. Every other module gets balances, the public
// address, or (for the live execution path only) a signing function — never
// the key material itself.
let keypair: Keypair | null = null;

if (env.SOLANA_PRIVATE_KEY) {
  try {
    keypair = parsePrivateKey(env.SOLANA_PRIVATE_KEY);
    logger.info({ address: keypair.publicKey.toBase58() }, "trading wallet loaded from environment");
  } catch (err) {
    logger.error({ err: (err as Error).message }, "failed to parse SOLANA_PRIVATE_KEY — trading wallet disabled");
    keypair = null;
  }
} else {
  logger.warn(
    "No SOLANA_PRIVATE_KEY configured. Run `npm run wallet:generate -w server` to create a " +
      "dedicated trading wallet, or paper trading will run with a virtual balance only.",
  );
}

export function isWalletConfigured(): boolean {
  return keypair !== null;
}

export function getWalletPublicKey(): PublicKey | null {
  return keypair?.publicKey ?? null;
}

export function getWalletAddress(): string | null {
  return keypair?.publicKey.toBase58() ?? null;
}

export interface TokenBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: string;
}

export async function getSolBalance(): Promise<Decimal> {
  if (!keypair) return new Decimal(0);
  const lamports = await connection.getBalance(keypair.publicKey, "confirmed");
  return new Decimal(lamports).div(LAMPORTS_PER_SOL);
}

export async function getTokenBalances(): Promise<TokenBalance[]> {
  if (!keypair) return [];
  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const resp = await connection.getParsedTokenAccountsByOwner(keypair.publicKey, {
    programId: TOKEN_PROGRAM_ID,
  });
  return resp.value
    .map((accountInfo) => {
      const info = accountInfo.account.data.parsed.info;
      const amount = info.tokenAmount as { amount: string; decimals: number; uiAmountString: string };
      return {
        mint: info.mint as string,
        amount: amount.amount,
        decimals: amount.decimals,
        uiAmount: amount.uiAmountString,
      };
    })
    .filter((b) => new Decimal(b.amount).gt(0));
}

/**
 * Signs a swap transaction returned by Jupiter and returns the signed bytes.
 * This is the ONLY place in the app that ever touches the private key for
 * signing. It is only reachable from the live execution path, and only after
 * risk checks, security checks, and simulation have all passed.
 */
export function signTransaction(tx: VersionedTransaction): VersionedTransaction {
  if (!keypair) {
    throw new Error("Cannot sign: no trading wallet configured.");
  }
  tx.sign([keypair]);
  return tx;
}
