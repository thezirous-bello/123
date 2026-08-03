export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOL_DECIMALS = 9;
export const USDC_DECIMALS = 6;

export function quoteTokenMint(quoteToken: "SOL" | "USDC"): string {
  return quoteToken === "SOL" ? SOL_MINT : USDC_MINT;
}

export function quoteTokenDecimals(quoteToken: "SOL" | "USDC"): number {
  return quoteToken === "SOL" ? SOL_DECIMALS : USDC_DECIMALS;
}
