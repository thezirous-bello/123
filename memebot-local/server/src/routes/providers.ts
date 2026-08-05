import type { FastifyInstance } from "fastify";
import { getProviderHealth } from "../lib/providerHealth.js";

export default async function providerRoutes(app: FastifyInstance) {
  app.get("/providers/status", async () => getProviderHealth());
}
