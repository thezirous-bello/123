import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPosition, listPositions } from "../engine/positionRepository.js";
import { manualSell } from "../engine/botController.js";
import type { Mode } from "../engine/queries.js";

const ListQuerySchema = z.object({ mode: z.enum(["paper", "live"]).optional() });
const SellBodySchema = z.object({ percentage: z.number().gt(0).max(100).default(100) });

function serializePosition(p: ReturnType<typeof getPosition>) {
  if (!p) return null;
  return {
    ...p,
    entryPriceUsd: p.entryPriceUsd.toFixed(),
    entryAmountUsd: p.entryAmountUsd.toFixed(),
    tokenAmount: p.tokenAmount.toFixed(),
    remainingTokenAmount: p.remainingTokenAmount.toFixed(),
    costBasisUsd: p.costBasisUsd.toFixed(),
    trailingStopHighUsd: p.trailingStopHighUsd?.toFixed() ?? null,
    realizedPnlUsd: p.realizedPnlUsd.toFixed(),
  };
}

export default async function positionRoutes(app: FastifyInstance) {
  app.get("/positions", async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    const positions = listPositions(parsed.data.mode as Mode | undefined);
    return positions.map(serializePosition);
  });

  app.get("/positions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const position = getPosition(id);
    if (!position) return reply.code(404).send({ error: "not_found" });
    return serializePosition(position);
  });

  app.post("/positions/:id/sell", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = SellBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    const result = await manualSell(id, parsed.data.percentage);
    if (!result.ok) return reply.code(400).send({ error: "sell_failed", details: result.reasons });
    return { ok: true };
  });

  app.post("/positions/:id/close", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await manualSell(id, 100);
    if (!result.ok) return reply.code(400).send({ error: "close_failed", details: result.reasons });
    return { ok: true };
  });
}
