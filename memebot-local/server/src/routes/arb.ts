import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { abortJourney, emergencyStopArb, getArbWallet, resumeArb, startArbBot, stopArbBot } from "../arb/controller.js";
import { getArbStrategyConfig, updateArbStrategyConfig } from "../arb/configStore.js";
import { ArbStrategyConfigObjectSchema, DEFAULT_ARB_SYMBOLS } from "../arb/schema.js";
import { getArbBotState } from "../arb/state.js";
import { botControlledCapitalByExchange, listArbTrades, listExchangeBalances, listJourneys, listOpportunities, realizedPnlSinceArb } from "../arb/repository.js";
import { ALL_EXCHANGE_IDS } from "../arb/exchanges/index.js";
import { listExchangeAuthStatus } from "../arb/exchanges/auth/index.js";
import { hasIdentityDataFor, countIdentityDataFor } from "../arb/identity.js";
import { getProviderHealth } from "../lib/providerHealth.js";

const EmergencyStopBodySchema = z.object({ reason: z.string().min(1).max(500) });
const ResumeBodySchema = z.object({ confirm: z.literal(true) });
const AbortJourneyBodySchema = z.object({ reason: z.string().min(1).max(500) });
const ConfigPatchSchema = ArbStrategyConfigObjectSchema.partial();

function decimalToPlain(value: unknown): unknown {
  if (value && typeof value === "object" && "toFixed" in value && typeof (value as { toFixed: unknown }).toFixed === "function") {
    return (value as { toFixed: () => string }).toFixed();
  }
  if (Array.isArray(value)) return value.map(decimalToPlain);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decimalToPlain(v)]));
  }
  return value;
}

export default async function arbRoutes(app: FastifyInstance) {
  app.get("/arb/status", async () => {
    const state = getArbBotState();
    const config = getArbStrategyConfig();
    return {
      running: state.running,
      emergencyStopped: state.emergencyStopped,
      emergencyStoppedAt: state.emergencyStoppedAt,
      emergencyStoppedReason: state.emergencyStoppedReason,
      lastScanAt: state.lastScanAt,
      totalScans: state.totalScans,
      strategyEnabled: config.enabled,
      exchanges: config.exchanges,
      updatedAt: state.updatedAt,
    };
  });

  app.get("/arb/exchanges", async () => ALL_EXCHANGE_IDS);

  app.get("/arb/wallet", async () => {
    const wallet = getArbWallet();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return {
      cashBalanceUsd: wallet.cashBalanceUsd.toFixed(),
      startingBalanceUsd: wallet.startingBalanceUsd.toFixed(),
      realizedPnl24hUsd: realizedPnlSinceArb(dayAgo).toFixed(),
    };
  });

  app.get("/arb/config", async () => getArbStrategyConfig());

  /** The full ~540-coin curated default symbol list, so the dashboard can
   * offer "load recommended coins" without the frontend having to duplicate
   * (and risk drifting from) this list — useful both for fresh installs and
   * for anyone whose settings already persisted the old, shorter default
   * before this list was expanded. */
  app.get("/arb/config/default-symbols", async () => DEFAULT_ARB_SYMBOLS);

  app.patch("/arb/config", async (request, reply) => {
    const parsed = ConfigPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    try {
      return updateArbStrategyConfig(parsed.data);
    } catch (err) {
      return reply.code(400).send({ error: "validation_error", message: (err as Error).message });
    }
  });

  app.post("/arb/control/start", async () => startArbBot());
  app.post("/arb/control/stop", async () => stopArbBot());

  app.post("/arb/control/emergency-stop", async (request, reply) => {
    const parsed = EmergencyStopBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    return emergencyStopArb("dashboard-user", parsed.data.reason);
  });

  app.post("/arb/control/resume", async (request, reply) => {
    const parsed = ResumeBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", message: "Resuming requires { confirm: true }." });
    return resumeArb("dashboard-user");
  });

  app.get("/arb/opportunities", async () => decimalToPlain(listOpportunities(100)));
  app.get("/arb/trades", async () => decimalToPlain(listArbTrades(200)));

  /** Every in-flight-or-recent multi-leg journey (buy -> withdraw -> sell ->
   * chain-or-return-home) — see arb/journeyEngine.ts for the state machine. */
  app.get("/arb/journeys", async () => decimalToPlain(listJourneys(100)));

  app.post("/arb/journeys/:id/abort", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = AbortJourneyBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    try {
      return decimalToPlain(abortJourney(id, parsed.data.reason));
    } catch (err) {
      return reply.code(404).send({ error: "not_found", message: (err as Error).message });
    }
  });

  /** Per-exchange operational status the dashboard needs to explain WHY a
   * given exchange isn't completing trades: whether a read-only API key is
   * configured for it, whether it has cached coin-identity data yet, its
   * real (informational-only) balance snapshot, how much of the bot's own
   * paper capital is currently in flight there, and the last error any call
   * to that exchange hit (so an auth failure like MEXC's "Api key info
   * invalid" shows up here instead of only in the server's terminal log). */
  app.get("/arb/exchange-health", async () => {
    const config = getArbStrategyConfig();
    const authStatus = listExchangeAuthStatus(config.exchanges);
    const balances = listExchangeBalances(config.exchanges);
    const committed = botControlledCapitalByExchange();
    const balanceByExchange = new Map(balances.map((b) => [b.exchange, b]));
    const providerHealthByExchange = new Map(getProviderHealth().map((h) => [h.provider, h]));
    return config.exchanges.map((exchange) => {
      const health = providerHealthByExchange.get(exchange);
      return {
        exchange,
        apiKeyConfigured: authStatus.find((a) => a.exchange === exchange)?.configured ?? false,
        identityDataCached: hasIdentityDataFor(exchange),
        identitySymbolCount: countIdentityDataFor(exchange),
        realBalance: balanceByExchange.get(exchange) ?? { exchange, hasRealFunds: null, checkedAt: null },
        botCommittedCapitalUsd: committed[exchange]?.toFixed() ?? "0",
        lastError: health?.lastError ?? null,
        lastErrorAt: health?.lastFailureAt ?? null,
      };
    });
  });
}
