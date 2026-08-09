import type { FastifyInstance } from "fastify";
import { recentActivity } from "../lib/activityLog.js";

export default async function activityRoutes(app: FastifyInstance) {
  app.get("/activity", async (request) => {
    const { limit } = request.query as { limit?: string };
    return recentActivity(limit ? Number(limit) : 200);
  });
}
