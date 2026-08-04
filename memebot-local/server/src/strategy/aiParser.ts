import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { StrategyRulesObjectSchema } from "./schema.js";
import type { ParseResult } from "./parser.js";

const PartialRulesSchema = StrategyRulesObjectSchema.partial().strict();

const SYSTEM_PROMPT = `You convert a plain-English Solana meme-coin trading instruction into a
strict JSON object of trading RULES. You are a translator, not a trader: you never execute
trades, never sign transactions, and never see wallet credentials.

Output ONLY a single JSON object — no prose, no markdown fences, no comments, no code of any
kind (no JavaScript, no SQL, nothing executable). If a value is not stated or clearly implied by
the instruction, omit that key entirely rather than guessing a number.

Allowed keys (all optional — include only what the instruction actually specifies):
- quoteToken: "SOL" | "USDC"
- maxTradeUsd: number (the max dollars per trade — look for "buy up to $X", "max trade $X")
- minimumLiquidityUsd: number
- minimumVolume5mUsd: number
- minimumVolume1hUsd: number
- minimumTokenAgeMinutes: number
- maximumTokenAgeMinutes: number
- maximumTop10HolderPercentage: number (0-100)
- requireMintAuthorityDisabled: boolean
- requireFreezeAuthorityDisabled: boolean
- requireSellSimulation: boolean (never set this to false)
- minimumPriceChange5mPct: number
- maximumPriceChange5mPct: number
- minimumPriceChange1hPct: number
- maximumPriceChange1hPct: number
- maximumSlippagePercentage: number (0-50)
- maximumPriceImpactPercentage: number (0-50)
- stopLossPercentage: number (0-100, always positive, e.g. 20 for "stop out at a 20% loss")
- takeProfits: array of { profitPercentage: number, sellPercentage: number } — sellPercentage
  values are percent of the ORIGINAL position, must sum to <= 100
- trailingStopPercentage: number (0-100)
- maxHoldingPeriodMinutes: number
- cooldownMinutesAfterLoss: number
- dailyTradeLimit: integer

If the instruction asks for something unbounded or unsafe (whole wallet, unlimited slippage,
ignoring safety checks, no stop loss), do not attempt to translate it — output exactly:
{"error": "<one sentence explaining exactly what is unsafe or ambiguous>"}`;

export async function tryParseWithClaude(instruction: string): Promise<ParseResult | null> {
  if (!env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: instruction }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const jsonText = extractJson(textBlock.text);
    if (!jsonText) return null;

    const parsed: unknown = JSON.parse(jsonText);

    if (parsed && typeof parsed === "object" && "error" in parsed) {
      return { ok: false, rules: {}, warnings: [], errors: [String((parsed as { error: unknown }).error)] };
    }

    const validated = PartialRulesSchema.safeParse(parsed);
    if (!validated.success) {
      return {
        ok: false,
        rules: {},
        warnings: [],
        errors: [
          "The AI-assisted parser returned a value that didn't match the strategy schema, so it was discarded: " +
            validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        ],
      };
    }

    const errors: string[] = [];
    if (validated.data.maxTradeUsd === undefined) {
      errors.push('Could not find a maximum trade size. Please state one explicitly, e.g. "buy up to $20".');
    }
    if (validated.data.stopLossPercentage === undefined) {
      errors.push('Could not find a stop loss. Every strategy needs one, e.g. "stop loss at 20%".');
    }

    return {
      ok: errors.length === 0,
      rules: validated.data,
      warnings: errors.length === 0 ? ["Parsed with AI assistance — please review every field carefully."] : [],
      errors,
    };
  } catch (err) {
    logger.error({ err: (err as Error).message }, "AI-assisted strategy parsing failed; falling back to local parser result");
    return null;
  }
}

function extractJson(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return text.slice(start, end + 1);
}
