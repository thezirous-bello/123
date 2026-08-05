import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import staticPlugin from "@fastify/static";
import Fastify, { type FastifyError } from "fastify";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env, liveTradingAllowedByConfig } from "./env.js";
import "./db/index.js";
import { logger } from "./lib/logger.js";
import { isWalletConfigured } from "./wallet/walletManager.js";
import { stopBot } from "./engine/botController.js";
import { recordHttpTraffic, startSystemStatsSampler } from "./lib/systemStats.js";

import statusRoutes from "./routes/status.js";
import walletRoutes from "./routes/wallet.js";
import strategyRoutes from "./routes/strategy.js";
import tokenRoutes from "./routes/tokens.js";
import positionRoutes from "./routes/positions.js";
import tradeRoutes from "./routes/trades.js";
import riskRoutes from "./routes/risk.js";
import controlRoutes from "./routes/control.js";
import logRoutes from "./routes/logs.js";
import streamRoutes from "./routes/stream.js";
import systemRoutes from "./routes/system.js";
import analyticsRoutes from "./routes/analytics.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";
// Dev: Vite owns the user-facing PORT (3000) and proxies /api to this
// server on PORT+1. Prod: this server owns PORT directly and also serves
// the built dashboard as static files. See README "How it's wired up".
const apiPort = isProd ? env.PORT : env.PORT + 1;

const app = Fastify({ logger: false });

await app.register(cors, {
  origin: [`http://localhost:${env.PORT}`, `http://127.0.0.1:${env.PORT}`],
  credentials: true,
});
await app.register(sensible);

app.addHook("onResponse", async (request, reply) => {
  const bytesIn = Number.parseInt((request.headers["content-length"] as string) ?? "0", 10) || 0;
  const bytesOut = Number.parseInt(String(reply.getHeader("content-length") ?? "0"), 10) || 0;
  recordHttpTraffic(bytesIn, bytesOut);
});

await app.register(statusRoutes, { prefix: "/api" });
await app.register(walletRoutes, { prefix: "/api" });
await app.register(strategyRoutes, { prefix: "/api" });
await app.register(tokenRoutes, { prefix: "/api" });
await app.register(positionRoutes, { prefix: "/api" });
await app.register(tradeRoutes, { prefix: "/api" });
await app.register(riskRoutes, { prefix: "/api" });
await app.register(controlRoutes, { prefix: "/api" });
await app.register(logRoutes, { prefix: "/api" });
await app.register(streamRoutes, { prefix: "/api" });
await app.register(systemRoutes, { prefix: "/api" });
await app.register(analyticsRoutes, { prefix: "/api" });

startSystemStatsSampler();

if (isProd) {
  const webDist = join(__dirname, "..", "..", "web", "dist");
  await app.register(staticPlugin, { root: webDist });
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith("/api")) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
    reply.sendFile("index.html");
  });
}

app.setErrorHandler((error: FastifyError, request, reply) => {
  logger.error({ err: error.message, url: request.url }, "unhandled route error");
  reply.code(error.statusCode ?? 500).send({ error: "internal_error", message: error.message });
});

// Bind to loopback only — per project safety rules, this app is local-only
// unless the user deliberately changes this.
await app.listen({ port: apiPort, host: "127.0.0.1" });

logger.info({ apiPort, dashboardPort: env.PORT, mode: isProd ? "production" : "development" }, "MemeBot Local API ready");
logger.info(
  { walletConfigured: isWalletConfigured(), liveTradingAllowedByConfig },
  liveTradingAllowedByConfig
    ? "Live trading is ENABLED by server configuration — still requires dashboard confirmation to actually switch modes."
    : "Live trading is disabled (paper-only) by server configuration.",
);
if (!isProd) {
  logger.info(`Open the dashboard at http://localhost:${env.PORT} (run "npm run dev" from the project root, not this workspace alone).`);
}

async function shutdown() {
  logger.info("Shutting down...");
  stopBot();
  await app.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
