import type { FastifyInstance } from "fastify";
import { liveTradingAllowedByConfig } from "../env.js";
import { getBotState } from "../engine/emergency.js";
import { isWalletConfigured } from "../wallet/walletManager.js";
import { getActiveStrategy } from "../strategy/repository.js";

export default async function statusRoutes(app: FastifyInstance) {
  app.get("/status", async () => {
    const state = getBotState();
    const strategy = getActiveStrategy();
    return {
      running: state.running,
      mode: state.mode,
      emergencyStopped: state.emergencyStopped,
      emergencyStoppedAt: state.emergencyStoppedAt,
      emergencyStoppedReason: state.emergencyStoppedReason,
      liveTradingAllowedByConfig,
      walletConfigured: isWalletConfigured(),
      activeStrategy: strategy ? { id: strategy.id, name: strategy.name } : null,
      updatedAt: state.updatedAt,
    };
  });

  app.get("/health", async () => ({ ok: true }));
}
