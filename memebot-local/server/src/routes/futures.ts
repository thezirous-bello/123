import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { futuresLiveTradingAllowedByConfig } from "../env.js";
import { isBybitConfigured, type BybitMode } from "../bybit/client.js";
import { getWalletBalance } from "../bybit/trading.js";
import { getKlines, getOrderbook, getTicker } from "../bybit/marketData.js";
import { getFuturesStrategyConfig, updateFuturesStrategyConfig } from "../futures/configStore.js";
import { manualCloseFuturesPosition, requestFuturesModeChange, startFuturesBot, stopFuturesBot } from "../futures/controller.js";
import { listFuturesPositions, listFuturesTrades, listSignals } from "../futures/repository.js";
import { FuturesStrategyConfigObjectSchema } from "../futures/schema.js";
import { getFuturesBotState, resumeFuturesFromEmergencyStop, triggerFuturesEmergencyStop } from "../futures/state.js";

/** Same symbol the market-chart panel on the dashboard's Live tab should
 * show: the bot's own open position when it has one (real, currently
 * traded), otherwise BTCUSDT — always-liquid on Bybit, so the chart has
 * real data to show even while idle rather than going blank. */
function defaultChartSymbol(): string {
  const open = listFuturesPositions().find((p) => p.status === "open");
  return open?.symbol ?? "BTCUSDT";
}

const ModeBodySchema = z.object({ mode: z.enum(["testnet", "live"]), confirmed: z.boolean().default(false) });
const EmergencyStopBodySchema = z.object({ reason: z.string().min(1).max(500) });
const ResumeBodySchema = z.object({ confirm: z.literal(true) });
const ConfigPatchSchema = FuturesStrategyConfigObjectSchema.partial();

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

export default async function futuresRoutes(app: FastifyInstance) {
  app.get("/futures/status", async () => {
    const state = getFuturesBotState();
    const config = getFuturesStrategyConfig();
    return {
      running: state.running,
      mode: state.mode,
      emergencyStopped: state.emergencyStopped,
      emergencyStoppedAt: state.emergencyStoppedAt,
      emergencyStoppedReason: state.emergencyStoppedReason,
      consecutiveLosses: state.consecutiveLosses,
      tradingHaltedUntil: state.tradingHaltedUntil,
      liveTradingAllowedByConfig: futuresLiveTradingAllowedByConfig,
      testnetConfigured: isBybitConfigured("testnet"),
      liveConfigured: isBybitConfigured("live"),
      strategyEnabled: config.enabled,
      updatedAt: state.updatedAt,
    };
  });

  app.get("/futures/wallet", async (request, reply) => {
    const mode = ((request.query as Record<string, string>).mode as BybitMode) ?? getFuturesBotState().mode;
    if (!isBybitConfigured(mode)) return { configured: false, mode, totalEquityUsd: null, availableBalanceUsd: null };
    try {
      const balance = await getWalletBalance(mode);
      return { configured: true, mode, totalEquityUsd: balance?.totalEquityUsd ?? null, availableBalanceUsd: balance?.availableBalanceUsd ?? null };
    } catch (err) {
      return reply.code(502).send({ error: "bybit_error", message: (err as Error).message });
    }
  });

  app.get("/futures/config", async () => getFuturesStrategyConfig());

  app.patch("/futures/config", async (request, reply) => {
    const parsed = ConfigPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    try {
      return updateFuturesStrategyConfig(parsed.data);
    } catch (err) {
      return reply.code(400).send({ error: "validation_error", message: (err as Error).message });
    }
  });

  app.post("/futures/control/start", async () => startFuturesBot());
  app.post("/futures/control/stop", async () => stopFuturesBot());

  app.post("/futures/control/mode", async (request, reply) => {
    const parsed = ModeBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    const result = requestFuturesModeChange(parsed.data.mode, parsed.data.confirmed);
    if (!result.ok) return reply.code(400).send({ error: "mode_change_rejected", message: result.reason });
    return result.state;
  });

  app.post("/futures/control/emergency-stop", async (request, reply) => {
    const parsed = EmergencyStopBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    stopFuturesBot();
    return triggerFuturesEmergencyStop("dashboard-user", parsed.data.reason);
  });

  app.post("/futures/control/resume", async (request, reply) => {
    const parsed = ResumeBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", message: "Resuming requires { confirm: true }." });
    return resumeFuturesFromEmergencyStop("dashboard-user");
  });

  app.get("/futures/signals", async () => decimalToPlain(listSignals(100)));

  app.get("/futures/positions", async (request) => {
    const mode = (request.query as Record<string, string>).mode as BybitMode | undefined;
    return decimalToPlain(listFuturesPositions(mode, 200));
  });

  app.post("/futures/positions/:id/close", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await manualCloseFuturesPosition(id);
    if (!result.ok) return reply.code(400).send({ error: "close_failed", message: result.reason });
    return { ok: true };
  });

  app.get("/futures/trades", async () => listFuturesTrades(200));

  app.get("/futures/candles", async (request, reply) => {
    const q = request.query as Record<string, string>;
    const symbol = q.symbol || defaultChartSymbol();
    const mode = (q.mode as BybitMode) ?? getFuturesBotState().mode;
    try {
      const candles = await getKlines(symbol, 5, 120, mode, "linear");
      return { symbol, mode, candles };
    } catch (err) {
      return reply.code(502).send({ error: "bybit_error", message: (err as Error).message });
    }
  });

  app.get("/futures/orderbook", async (request, reply) => {
    const q = request.query as Record<string, string>;
    const symbol = q.symbol || defaultChartSymbol();
    const mode = (q.mode as BybitMode) ?? getFuturesBotState().mode;
    try {
      const book = await getOrderbook(symbol, 12, mode, "linear");
      return { symbol, mode, ...book };
    } catch (err) {
      return reply.code(502).send({ error: "bybit_error", message: (err as Error).message });
    }
  });

  app.get("/futures/ticker", async (request, reply) => {
    const q = request.query as Record<string, string>;
    const symbol = q.symbol || defaultChartSymbol();
    const mode = (q.mode as BybitMode) ?? getFuturesBotState().mode;
    try {
      const ticker = await getTicker(symbol, mode, "linear");
      return { symbol, mode, ticker };
    } catch (err) {
      return reply.code(502).send({ error: "bybit_error", message: (err as Error).message });
    }
  });
}
