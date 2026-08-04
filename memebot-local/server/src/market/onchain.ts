import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { logger } from "../lib/logger.js";
import { connection } from "./rpc.js";
import type { HolderConcentration, OnChainMintInfo } from "./types.js";

export async function fetchOnChainMintInfo(mint: string): Promise<OnChainMintInfo | null> {
  try {
    const mintPubkey = new PublicKey(mint);
    const info = await getMint(connection, mintPubkey);
    return {
      mint,
      mintAuthority: info.mintAuthority?.toBase58() ?? null,
      freezeAuthority: info.freezeAuthority?.toBase58() ?? null,
      decimals: info.decimals,
      supply: info.supply.toString(),
    };
  } catch (err) {
    logger.warn({ mint, err: (err as Error).message }, "failed to read on-chain mint info");
    return null;
  }
}

/** Top-10-holder concentration computed directly from on-chain token
 * accounts — not dependent on any third-party API. */
export async function fetchHolderConcentration(mint: string): Promise<HolderConcentration | null> {
  try {
    const mintPubkey = new PublicKey(mint);
    const [largest, supply] = await Promise.all([
      connection.getTokenLargestAccounts(mintPubkey, "confirmed"),
      connection.getTokenSupply(mintPubkey, "confirmed"),
    ]);
    const totalSupply = Number(supply.value.uiAmount ?? 0);
    if (totalSupply <= 0) return { top10Percentage: null, largestHolders: [] };

    const top10 = largest.value.slice(0, 10);
    const holders = top10.map((account) => ({
      address: account.address.toBase58(),
      percentage: ((account.uiAmount ?? 0) / totalSupply) * 100,
    }));
    const top10Percentage = holders.reduce((sum, h) => sum + h.percentage, 0);
    return { top10Percentage, largestHolders: holders };
  } catch (err) {
    logger.warn({ mint, err: (err as Error).message }, "failed to read on-chain holder concentration");
    return null;
  }
}
