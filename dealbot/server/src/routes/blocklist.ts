import type { FastifyInstance } from "fastify";
import { listBlockedBrands, listBlockedProducts, unblockBrand, unblockProduct } from "../rules/blocklistRepository.js";

export default async function blocklistRoutes(app: FastifyInstance) {
  app.get("/blocklist/products", async () => listBlockedProducts());
  app.get("/blocklist/brands", async () => listBlockedBrands());

  app.delete("/blocklist/products/:id", async (request) => {
    const { id } = request.params as { id: string };
    unblockProduct(id);
    return { ok: true };
  });

  app.delete("/blocklist/brands/:id", async (request) => {
    const { id } = request.params as { id: string };
    unblockBrand(id);
    return { ok: true };
  });
}
