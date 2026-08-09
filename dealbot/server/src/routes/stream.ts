import type { FastifyInstance } from "fastify";
import { botEvents } from "../lib/events.js";

/** Server-Sent Events stream for live dashboard updates — bot state
 * changes, new activity log lines, deal discoveries/posts, click events. */
export default async function streamRoutes(app: FastifyInstance) {
  app.get("/stream", async (request, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    reply.raw.write(":ok\n\n");

    const send = (event: { event: string; payload: unknown }) => {
      reply.raw.write(`event: ${event.event}\ndata: ${JSON.stringify(event.payload)}\n\n`);
    };

    botEvents.on("*", send);
    const keepAlive = setInterval(() => reply.raw.write(":keep-alive\n\n"), 15_000);

    request.raw.on("close", () => {
      clearInterval(keepAlive);
      botEvents.off("*", send);
    });
  });
}
