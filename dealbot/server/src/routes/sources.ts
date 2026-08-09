import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getProviderHealth } from "../lib/apiLog.js";
import { listAdapterKinds } from "../sources/registry.js";
import { createSource, listSources, setSourceEnabled, updateSource } from "../sources/repository.js";

const CreateSourceSchema = z.object({
  name: z.string().min(1),
  kind: z.string().min(1),
  affiliateTag: z.string().optional(),
  countries: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
});

export default async function sourceRoutes(app: FastifyInstance) {
  app.get("/sources", async () => listSources().map((s) => ({ ...s, health: getProviderHealth(s.id) })));
  app.get("/sources/kinds", async () => listAdapterKinds());

  app.post("/sources", async (request, reply) => {
    const parsed = CreateSourceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    return createSource(parsed.data);
  });

  app.patch("/sources/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = CreateSourceSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    const updated = updateSource(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return updated;
  });

  app.post("/sources/:id/enabled", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z.object({ enabled: z.boolean() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error" });
    setSourceEnabled(id, parsed.data.enabled);
    return { ok: true };
  });
}
