export interface PostContext {
  productName: string;
  brand: string | null;
  currentPrice: string;
  currency: string;
  referencePrice: string | null;
  discountPct: number | null;
  absoluteSaving: string | null;
  rating: number | null;
  reviewCount: number | null;
  affiliateUrl: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£", ALL: "L" };

function money(amount: string, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  return symbol ? `${symbol}${Number(amount).toFixed(2)}` : `${Number(amount).toFixed(2)} ${currency}`;
}

const HEADERS = ["🔥 PRICE DROP", "⚡ DEAL ALERT", "🛒 TODAY'S DEAL", "💥 PRICE CUT"];
const CTAS = ["🛒 VIEW DEAL", "👉 GET THIS DEAL", "🛍️ SHOP NOW", "🔗 SEE OFFER"];

function pick<T>(arr: T[], seed: number): T {
  return arr[((seed % arr.length) + arr.length) % arr.length]!;
}

/** Deterministic-but-varied template selection (not an LLM call — keeps
 * the pipeline dependency-free and fast) so consecutive posts don't read
 * identically, per spec section 8. Never adds scarcity/countdown language
 * that isn't in `ctx` — there is nothing in PostContext for it because no
 * connected source in this codebase reports genuine stock-count data;
 * add a `stockRemaining` field here only when a real source actually
 * supplies one, and only then should a post ever say "X left". */
export function generatePost(ctx: PostContext, variationSeed: number): string {
  const header = pick(HEADERS, variationSeed);
  const cta = pick(CTAS, variationSeed + 1);
  const title = ctx.brand ? `${ctx.brand} ${ctx.productName}` : ctx.productName;

  const lines: string[] = [header, "", title, ""];

  if (ctx.referencePrice) {
    lines.push(`${money(ctx.referencePrice, ctx.currency)} → ${money(ctx.currentPrice, ctx.currency)}`);
  } else {
    lines.push(money(ctx.currentPrice, ctx.currency));
  }
  if (ctx.discountPct != null) lines.push(`📉 ${Math.round(ctx.discountPct)}% OFF`);
  if (ctx.rating != null) lines.push(`⭐ ${ctx.rating.toFixed(1)}/5${ctx.reviewCount ? ` (${ctx.reviewCount.toLocaleString()} reviews)` : ""}`);
  if (ctx.absoluteSaving) lines.push("", `You save ${money(ctx.absoluteSaving, ctx.currency)}.`);
  lines.push("", cta, ctx.affiliateUrl);

  return lines.join("\n");
}
