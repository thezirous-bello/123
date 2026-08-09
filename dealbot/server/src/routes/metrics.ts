import type { FastifyInstance } from "fastify";
import { getDashboardMetrics } from "../tracking/repository.js";

export default async function metricsRoutes(app: FastifyInstance) {
  app.get("/metrics", async () => getDashboardMetrics());
}
