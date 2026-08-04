import type { FastifyInstance } from "fastify";
import { recentLogs } from "../lib/auditLog.js";

export default async function logRoutes(app: FastifyInstance) {
  app.get("/logs", async (request) => {
    const { limit } = request.query as { limit?: string };
    return recentLogs(limit ? Number.parseInt(limit, 10) : 200);
  });
}
