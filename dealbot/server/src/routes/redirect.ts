import type { FastifyInstance } from "fastify";
import { getLinkBySlug, recordClick } from "../affiliate/repository.js";

/** Public, unauthenticated — this is the URL embedded in Telegram posts.
 * Logs a real click (not an estimate) before forwarding to the real
 * affiliate URL. Registered without the /api prefix and outside the
 * auth-required plugin scope in index.ts, since anonymous Telegram
 * viewers need to be able to click it. */
export default async function redirectRoutes(app: FastifyInstance) {
  app.get("/r/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const link = getLinkBySlug(slug);
    if (!link || !link.affiliate_url) {
      return reply.code(404).send("Link not found or no longer valid.");
    }
    recordClick(link.id, link.offer_id, null, (request.headers["user-agent"] as string) ?? null);
    reply.redirect(link.affiliate_url, 302);
  });
}
