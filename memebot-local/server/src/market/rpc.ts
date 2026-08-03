import { Connection } from "@solana/web3.js";
import { env } from "../env.js";

/** Shared Solana RPC connection used by wallet balance lookups, on-chain
 * token-authority checks, and transaction simulation/submission. */
export const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
