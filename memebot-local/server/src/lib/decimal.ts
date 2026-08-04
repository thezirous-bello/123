import { Decimal } from "decimal.js";

// Config applies globally to the Decimal.js constructor used throughout the
// app. 30 significant digits comfortably covers SPL token amounts (up to
// ~10^19 base units) and USD prices with many decimals without rounding.
Decimal.set({ precision: 30, rounding: Decimal.ROUND_DOWN });

export { Decimal };

export function toDecimal(value: string | number | Decimal | null | undefined): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  return new Decimal(value);
}

export function decimalToString(value: Decimal): string {
  return value.toFixed();
}
