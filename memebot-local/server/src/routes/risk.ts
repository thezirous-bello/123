import type { FastifyInstance } from "fastify";
import { MomentumConfigSchema, RiskLimitsSchema, getMomentumConfig, getRiskLimits, updateMomentumConfig, updateRiskLimits } from "../lib/settings.js";
import { recentRiskEvents } from "../lib/auditLog.js";

export default async function riskRoutes(app: FastifyInstance) {
  app.get("/risk/limits", async () => getRiskLimits());

  app.patch("/risk/limits", async (request, reply) => {
    const parsed = RiskLimitsSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    return updateRiskLimits(parsed.data);
  });

  app.get("/risk/events", async () => recentRiskEvents());

  // Momentum-scoring weights/thresholds — the account-level defaults every
  // strategy falls back to unless it sets its own override (schema.ts).
  app.get("/momentum/config", async () => getMomentumConfig());

  app.patch("/momentum/config", async (request, reply) => {
    const parsed = MomentumConfigSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    return updateMomentumConfig(parsed.data);
  });
}
