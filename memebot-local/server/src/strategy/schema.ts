import { z } from "zod";

// Every trading rule the bot can act on. Deliberately closed (.strict()) so
// neither the AI parser nor a hand-edited request body can smuggle in a field
// the deterministic evaluator doesn't know about, and deliberately free of
// anything resembling executable code or credentials — it is pure data.
export const TakeProfitLevelSchema = z
  .object({
    profitPercentage: z.number().gt(0).max(10_000),
    sellPercentage: z.number().gt(0).max(100),
  })
  .strict();

// Kept separate from StrategyRulesSchema (below) specifically so callers that
// need a partial version — the AI parser, which may only fill in some
// fields — can call `.partial()` on it: Zod does not allow `.partial()` on a
// schema that already carries `.superRefine()` cross-field checks.
export const StrategyRulesObjectSchema = z
  .object({
    quoteToken: z.enum(["SOL", "USDC"]).default("SOL"),

    // Position sizing / entry universe
    maxTradeUsd: z.number().gt(0).max(1_000_000),
    minimumLiquidityUsd: z.number().gte(0).default(0),
    minimumVolume5mUsd: z.number().gte(0).optional(),
    minimumVolume1hUsd: z.number().gte(0).optional(),
    minimumTokenAgeMinutes: z.number().gte(0).optional(),
    maximumTokenAgeMinutes: z.number().gt(0).optional(),
    maximumTop10HolderPercentage: z.number().gte(0).lte(100).default(100),

    // Security requirements
    requireMintAuthorityDisabled: z.boolean().default(true),
    requireFreezeAuthorityDisabled: z.boolean().default(true),
    requireSellSimulation: z.boolean().default(true),

    // Price-action entry filters
    minimumPriceChange5mPct: z.number().optional(),
    maximumPriceChange5mPct: z.number().optional(),
    minimumPriceChange1hPct: z.number().optional(),
    maximumPriceChange1hPct: z.number().optional(),

    // Momentum-quality entry gating. Left undefined here means "use the
    // account-level momentum config" (lib/settings.ts MomentumConfigSchema),
    // which itself defaults to real gating on — this strategy is only for
    // strategies that need a *different* threshold than the account default,
    // not for opting out of momentum confirmation entirely.
    minimumMomentumScore: z.number().gte(0).max(100).optional(),
    requireVolumeAccelerating: z.boolean().optional(),
    requireBuyPressureDominant: z.boolean().optional(),
    requireTxAccelerating: z.boolean().optional(),
    requireTrendBullish: z.boolean().optional(),

    // Dynamic momentum-based exit gating — same fallback-to-account-default
    // behavior as the entry fields above.
    exitOnMomentumReversal: z.boolean().optional(),
    exitMomentumScoreThreshold: z.number().gte(0).max(100).optional(),

    // Execution limits
    maximumSlippagePercentage: z.number().gt(0).max(50).default(3),
    maximumPriceImpactPercentage: z.number().gt(0).max(50).default(2),

    // Exit plan
    stopLossPercentage: z.number().gt(0).max(100),
    takeProfits: z.array(TakeProfitLevelSchema).max(5).default([]),
    trailingStopPercentage: z.number().gt(0).max(100).optional(),
    maxHoldingPeriodMinutes: z.number().gt(0).optional(),

    // Account-level pacing for this strategy
    cooldownMinutesAfterLoss: z.number().gte(0).max(1440).default(15),
    dailyTradeLimit: z.number().int().gt(0).max(500).default(20),
  })
  .strict();

export const StrategyRulesSchema = StrategyRulesObjectSchema.superRefine((rules, ctx) => {
  const totalSellPct = rules.takeProfits.reduce((sum, tp) => sum + tp.sellPercentage, 0);
  if (totalSellPct > 100) {
    ctx.addIssue({
      code: "custom",
      path: ["takeProfits"],
      message: `Take-profit sell percentages add up to ${totalSellPct}%, which exceeds the 100% you actually hold.`,
    });
  }
  if (
    rules.minimumTokenAgeMinutes !== undefined &&
    rules.maximumTokenAgeMinutes !== undefined &&
    rules.minimumTokenAgeMinutes >= rules.maximumTokenAgeMinutes
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["maximumTokenAgeMinutes"],
      message: "maximumTokenAgeMinutes must be greater than minimumTokenAgeMinutes.",
    });
  }
});

export type StrategyRules = z.infer<typeof StrategyRulesSchema>;
export type TakeProfitLevel = z.infer<typeof TakeProfitLevelSchema>;

export const StrategySchema = z
  .object({
    id: z.string(),
    name: z.string().min(1).max(120),
    rawInstruction: z.string().min(1).max(4000),
    rules: StrategyRulesSchema,
    warnings: z.array(z.string()).default([]),
    enabled: z.boolean().default(false),
    archived: z.boolean().default(false),
    version: z.number().int().positive().default(1),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export type Strategy = z.infer<typeof StrategySchema>;
