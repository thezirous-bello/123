import type { FastifyInstance } from "fastify";
import { RiskLimitsSchema, getRiskLimits, updateRiskLimits } from "../lib/settings.js";
import { recentRiskEvents } from "../lib/auditLog.js";

export default async function riskRoutes(app: FastifyInstance) {
  app.get("/risk/limits", async () => getRiskLimits());

  app.patch("/risk/limits", async (request, reply) => {
    const parsed = RiskLimitsSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    return updateRiskLimits(parsed.data);
  });

  app.get("/risk/events", async () => recentRiskEvents());
}
