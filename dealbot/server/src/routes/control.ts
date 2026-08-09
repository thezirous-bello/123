import type { FastifyInstance } from "fastify";
import { pauseBot, startBot, stopBot, triggerScanNow } from "../controller.js";
import { isDemoMode } from "../env.js";
import { getBotState } from "../state.js";

export default async function controlRoutes(app: FastifyInstance) {
  app.get("/status", async () => ({ ...getBotState(), demoMode: isDemoMode }));

  app.post("/control/start", async () => {
    startBot();
    return getBotState();
  });
  app.post("/control/stop", async () => {
    stopBot();
    return getBotState();
  });
  app.post("/control/pause", async () => {
    pauseBot(true);
    return getBotState();
  });
  app.post("/control/resume", async () => {
    pauseBot(false);
    return getBotState();
  });
  app.post("/control/scan-now", async () => {
    void triggerScanNow();
    return { ok: true };
  });
}
