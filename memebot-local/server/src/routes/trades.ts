import type { FastifyInstance } from "fastify";
import { listTrades } from "../engine/positionRepository.js";

export default async function tradeRoutes(app: FastifyInstance) {
  app.get("/trades", async () => listTrades());
}
