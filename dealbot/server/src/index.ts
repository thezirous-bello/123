import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import staticPlugin from "@fastify/static";
import Fastify, { type FastifyError } from "fastify";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env, isDemoMode, isTelegramConfigured } from "./env.js";
import "./db/index.js";
import { logger } from "./lib/logger.js";
import { isAuthenticated } from "./lib/auth.js";
import { stopBot } from "./controller.js";

import authRoutes from "./routes/auth.js";
import controlRoutes from "./routes/control.js";
import dealRoutes from "./routes/deals.js";
import sourceRoutes from "./routes/sources.js";
import channelRoutes from "./routes/channels.js";
import activityRoutes from "./routes/activity.js";
import settingsRoutes from "./routes/settings.js";
import blocklistRoutes from "./routes/blocklist.js";
import metricsRoutes from "./routes/metrics.js";
import healthRoutes from "./routes/health.js";
import streamRoutes from "./routes/stream.js";
import redirectRoutes from "./routes/redirect.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";
// Dev: Vite owns the user-facing PORT and proxies /api to this server on
// PORT+1. Prod: this server owns PORT directly and also serves the built
// dashboard as static files — same wiring as this codebase's sibling
// trading-bot project.
const apiPort = isProd ? env.PORT : env.PORT + 1;

const app = Fastify({ logger: false });

await app.register(cors, {
  origin: [`http://localhost:${env.PORT}`, `http://127.0.0.1:${env.PORT}`],
  credentials: true,
});
await app.register(sensible);
await app.register(cookie);

// Public, unauthenticated — Telegram viewers click this.
await app.register(redirectRoutes);

// Everything under /api requires a valid dashboard session, except
// /api/auth/* (login has to be reachable before you have a session).
await app.register(
  async (api) => {
    api.addHook("onRequest", async (request, reply) => {
      if (request.raw.url?.startsWith("/api/auth")) return;
      if (!isAuthenticated(request)) reply.code(401).send({ error: "unauthorized" });
    });

    await api.register(authRoutes);
    await api.register(controlRoutes);
    await api.register(dealRoutes);
    await api.register(sourceRoutes);
    await api.register(channelRoutes);
    await api.register(activityRoutes);
    await api.register(settingsRoutes);
    await api.register(blocklistRoutes);
    await api.register(metricsRoutes);
    await api.register(healthRoutes);
    await api.register(streamRoutes);
  },
  { prefix: "/api" },
);

if (isProd) {
  const webDist = join(__dirname, "..", "..", "web", "dist");
  await app.register(staticPlugin, { root: webDist });
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith("/api") || request.raw.url?.startsWith("/r/")) {
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

// Bind to loopback only by default — same safety posture as this
// codebase's sibling trading-bot project. If you deploy this to run
// 24/7 on a server (per the spec), put it behind a reverse proxy
// (nginx/caddy) rather than binding it to 0.0.0.0 directly.
await app.listen({ port: apiPort, host: "127.0.0.1" });

logger.info({ apiPort, dashboardPort: env.PORT, mode: isProd ? "production" : "development" }, "DealBot API ready");
logger.info(
  { dealbotMode: env.DEALBOT_MODE, telegramConfigured: isTelegramConfigured, publicBaseUrl: env.PUBLIC_BASE_URL ?? null },
  isDemoMode ? "Running in DEMO mode — using sample data only, never posted as real." : "Running in PRODUCTION mode — only real connected sources are used.",
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
