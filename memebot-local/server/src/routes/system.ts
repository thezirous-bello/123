import type { FastifyInstance } from "fastify";
import { getSystemStats } from "../lib/systemStats.js";

export default async function systemRoutes(app: FastifyInstance) {
  app.get("/system", async () => getSystemStats());
}
