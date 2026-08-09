import type { FastifyInstance } from "fastify";
import { isTelegramConfigured } from "../env.js";
import { getProviderHealth } from "../lib/apiLog.js";
import { checkTelegramHealth } from "../telegram/client.js";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/health/telegram", async () => {
    if (!isTelegramConfigured) return { configured: false, ok: false };
    const result = await checkTelegramHealth();
    return { configured: true, ...result, apiHealth: getProviderHealth("telegram") };
  });
}
