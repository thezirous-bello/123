import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";
import { getScoreThresholds } from "../deals/scoring.js";
import { getPostingRules, updatePostingRules } from "../rules/postingRules.js";

const RulesPatchSchema = z.object({
  minDealScore: z.number().optional(),
  minDealConfidence: z.number().optional(),
  minDiscountPct: z.number().optional(),
  minRating: z.number().optional(),
  minReviews: z.number().optional(),
  minEstimatedCommission: z.string().optional(),
  requireInStock: z.boolean().optional(),
  requireAffiliateUrl: z.boolean().optional(),
  allowedCategories: z.array(z.string()).optional(),
  allowedCountries: z.array(z.string()).optional(),
  repostCooldownHours: z.number().optional(),
});

const ThresholdsSchema = z.object({
  reject: z.number(),
  weak: z.number(),
  good: z.number(),
  veryGood: z.number(),
  excellent: z.number(),
});

export default async function settingsRoutes(app: FastifyInstance) {
  app.get("/settings/posting-rules", async () => getPostingRules());

  app.patch("/settings/posting-rules", async (request, reply) => {
    const parsed = RulesPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    return updatePostingRules(parsed.data);
  });

  app.get("/settings/score-thresholds", async () => getScoreThresholds());

  app.patch("/settings/score-thresholds", async (request, reply) => {
    const parsed = ThresholdsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('score_thresholds', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).run(JSON.stringify(parsed.data), new Date().toISOString());
    return { ok: true };
  });
}
