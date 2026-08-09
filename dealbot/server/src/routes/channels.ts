import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createChannel, deleteChannel, listChannels, updateChannel } from "../telegram/repository.js";

const ChannelSchema = z.object({
  name: z.string().min(1),
  chatId: z.string().min(1),
  language: z.string().optional(),
  country: z.string().optional(),
  categories: z.array(z.string()).optional(),
  minDealScore: z.number().optional(),
  minProfitScore: z.number().optional(),
  maxPostsPerHour: z.number().optional(),
  maxPostsPerDay: z.number().optional(),
});

export default async function channelRoutes(app: FastifyInstance) {
  app.get("/channels", async () => listChannels());

  app.post("/channels", async (request, reply) => {
    const parsed = ChannelSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    return createChannel(parsed.data);
  });

  app.patch("/channels/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = ChannelSchema.partial().extend({ enabled: z.boolean().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    updateChannel(id, parsed.data);
    return { ok: true };
  });

  app.delete("/channels/:id", async (request) => {
    const { id } = request.params as { id: string };
    deleteChannel(id);
    return { ok: true };
  });
}
