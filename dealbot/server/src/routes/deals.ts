import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getOffer, getProduct, listOffers, updateOfferStatus } from "../deals/repository.js";
import { getLatestAnalysis } from "../deals/analysisRepository.js";
import { offerToDetail, offerToFeedRow } from "../deals/view.js";
import { getLatestLinkForOffer } from "../affiliate/repository.js";
import { postOfferNow } from "../controller.js";
import { blockBrand, blockProduct } from "../rules/blocklistRepository.js";
import { generatePost } from "../telegram/postGenerator.js";

export default async function dealRoutes(app: FastifyInstance) {
  app.get("/deals", async (request) => {
    const { status, limit } = request.query as { status?: string; limit?: string };
    const rows = listOffers(limit ? Number(limit) : 300);
    const filtered = status ? rows.filter((r) => r.status === status) : rows;
    return filtered.map(offerToFeedRow);
  });

  app.get("/deals/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const offer = getOffer(id);
    if (!offer) return reply.code(404).send({ error: "not_found" });
    return offerToDetail(offer);
  });

  app.post("/deals/:id/post-now", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z.object({ channelId: z.string() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error" });
    const result = await postOfferNow(id, parsed.data.channelId);
    if (!result.ok) return reply.code(400).send({ error: "post_failed", message: result.error });
    return { ok: true };
  });

  app.post("/deals/:id/reject", async (request, reply) => {
    const { id } = request.params as { id: string };
    const offer = getOffer(id);
    if (!offer) return reply.code(404).send({ error: "not_found" });
    updateOfferStatus(id, "rejected", "Manually rejected.");
    return { ok: true };
  });

  app.post("/deals/:id/block-product", async (request, reply) => {
    const { id } = request.params as { id: string };
    const offer = getOffer(id);
    if (!offer) return reply.code(404).send({ error: "not_found" });
    const product = getProduct(offer.product_id)!;
    blockProduct(product.id, product.name);
    updateOfferStatus(id, "rejected", "Product blocked.");
    return { ok: true };
  });

  app.post("/deals/:id/block-brand", async (request, reply) => {
    const { id } = request.params as { id: string };
    const offer = getOffer(id);
    if (!offer) return reply.code(404).send({ error: "not_found" });
    const product = getProduct(offer.product_id)!;
    if (!product.brand) return reply.code(400).send({ error: "no_brand" });
    blockBrand(product.brand);
    updateOfferStatus(id, "rejected", "Brand blocked.");
    return { ok: true };
  });

  app.post("/deals/:id/regenerate-post", async (request, reply) => {
    const { id } = request.params as { id: string };
    const offer = getOffer(id);
    if (!offer) return reply.code(404).send({ error: "not_found" });
    const product = getProduct(offer.product_id)!;
    const analysis = getLatestAnalysis(id);
    const link = getLatestLinkForOffer(id);
    const outboundUrl = link?.affiliate_url ?? offer.product_url;
    const messageText = generatePost(
      {
        productName: product.name,
        brand: product.brand,
        currentPrice: offer.current_price,
        currency: offer.currency,
        referencePrice: offer.reference_price,
        discountPct: analysis?.discount_pct ?? offer.discount_pct,
        absoluteSaving: analysis?.absolute_saving ?? null,
        rating: product.rating,
        reviewCount: product.review_count,
        affiliateUrl: outboundUrl,
      },
      Date.now(),
    );
    return { messageText };
  });
}
