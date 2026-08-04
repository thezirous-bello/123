import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { explainStrategyRules, interpretStrategyInstruction } from "../strategy/index.js";
import { enforceGlobalLimits, validateStrategyRules } from "../strategy/validator.js";
import { getRiskLimits } from "../lib/settings.js";
import {
  archiveStrategy,
  createStrategy,
  duplicateStrategy,
  getStrategy,
  listStrategies,
  listStrategyVersions,
  restoreStrategyVersion,
  setStrategyEnabled,
  updateStrategyRules,
} from "../strategy/repository.js";
import { pauseStrategy, resumeStrategy } from "../engine/botController.js";

const InterpretBodySchema = z.object({ instruction: z.string().min(1).max(4000) });
const CreateBodySchema = z.object({
  name: z.string().min(1).max(120),
  rawInstruction: z.string().min(1).max(4000),
  rules: z.record(z.string(), z.unknown()),
});
const UpdateBodySchema = z.object({ rules: z.record(z.string(), z.unknown()) });

export default async function strategyRoutes(app: FastifyInstance) {
  app.post("/strategies/interpret", async (request, reply) => {
    const parsed = InterpretBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    const result = await interpretStrategyInstruction(parsed.data.instruction);
    return result;
  });

  app.get("/strategies", async () => listStrategies());

  app.post("/strategies", async (request, reply) => {
    const parsed = CreateBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });

    const validated = validateStrategyRules(parsed.data.rules);
    if (!validated.ok || !validated.rules) {
      return reply.code(400).send({ error: "invalid_rules", details: validated.errors });
    }
    const limits = getRiskLimits();
    const { rules, warnings } = enforceGlobalLimits(validated.rules, limits);
    const strategy = createStrategy({ name: parsed.data.name, rawInstruction: parsed.data.rawInstruction, rules, warnings });
    return reply.code(201).send(strategy);
  });

  app.get("/strategies/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const strategy = getStrategy(id);
    if (!strategy) return reply.code(404).send({ error: "not_found" });
    return { ...strategy, plainEnglish: explainStrategyRules(strategy.rules) };
  });

  app.patch("/strategies/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });

    const validated = validateStrategyRules(parsed.data.rules);
    if (!validated.ok || !validated.rules) {
      return reply.code(400).send({ error: "invalid_rules", details: validated.errors });
    }
    const limits = getRiskLimits();
    const { rules, warnings } = enforceGlobalLimits(validated.rules, limits);
    const strategy = updateStrategyRules(id, rules, warnings);
    if (!strategy) return reply.code(404).send({ error: "not_found" });
    return strategy;
  });

  app.post("/strategies/:id/activate", async (request, reply) => {
    const { id } = request.params as { id: string };
    const strategy = setStrategyEnabled(id, true);
    if (!strategy) return reply.code(404).send({ error: "not_found" });
    resumeStrategy(id);
    return strategy;
  });

  app.post("/strategies/:id/pause", async (request, reply) => {
    const { id } = request.params as { id: string };
    const strategy = setStrategyEnabled(id, false);
    if (!strategy) return reply.code(404).send({ error: "not_found" });
    pauseStrategy(id);
    return strategy;
  });

  app.post("/strategies/:id/archive", async (request, reply) => {
    const { id } = request.params as { id: string };
    const strategy = archiveStrategy(id);
    if (!strategy) return reply.code(404).send({ error: "not_found" });
    return strategy;
  });

  app.post("/strategies/:id/duplicate", async (request, reply) => {
    const { id } = request.params as { id: string };
    const strategy = duplicateStrategy(id);
    if (!strategy) return reply.code(404).send({ error: "not_found" });
    return reply.code(201).send(strategy);
  });

  app.get("/strategies/:id/versions", async (request) => {
    const { id } = request.params as { id: string };
    return listStrategyVersions(id);
  });

  app.post("/strategies/:id/restore/:version", async (request, reply) => {
    const { id, version } = request.params as { id: string; version: string };
    const strategy = restoreStrategyVersion(id, Number.parseInt(version, 10));
    if (!strategy) return reply.code(404).send({ error: "not_found" });
    return strategy;
  });
}
