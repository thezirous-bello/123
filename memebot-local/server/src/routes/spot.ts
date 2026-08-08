import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { spotLiveTradingAllowedByConfig } from "../env.js";
import { isBybitConfigured, type BybitMode } from "../bybit/client.js";
import { getWalletBalance } from "../bybit/trading.js";
import { getKlines, getOrderbook, getTicker } from "../bybit/marketData.js";
import { getSpotStrategyConfig, updateSpotStrategyConfig } from "../spot/configStore.js";
import { manualCloseSpotPosition, requestSpotModeChange, startSpotBot, stopSpotBot } from "../spot/controller.js";
import { listSpotPositions, listSpotTrades, listSignals } from "../spot/repository.js";
import { SpotStrategyConfigObjectSchema } from "../spot/schema.js";
import { getSpotBotState, resumeSpotFromEmergencyStop, triggerSpotEmergencyStop } from "../spot/state.js";

/** Same symbol the market-chart panel on the dashboard's Live tab should
 * show: the bot's own open position when it has one (real, currently
 * traded), otherwise BTCUSDT — always-liquid on Bybit spot, so the chart
 * has real data to show even while idle rather than going blank. */
function defaultChartSymbol(): string {
  const open = listSpotPositions().find((p) => p.status === "open");
  return open?.symbol ?? "BTCUSDT";
}

const ModeBodySchema = z.object({ mode: z.enum(["testnet", "live"]), confirmed: z.boolean().default(false) });
const EmergencyStopBodySchema = z.object({ reason: z.string().min(1).max(500) });
const ResumeBodySchema = z.object({ confirm: z.literal(true) });
const ConfigPatchSchema = SpotStrategyConfigObjectSchema.partial();

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

export default async function spotRoutes(app: FastifyInstance) {
  app.get("/spot/status", async () => {
    const state = getSpotBotState();
    const config = getSpotStrategyConfig();
    return {
      running: state.running,
      mode: state.mode,
      emergencyStopped: state.emergencyStopped,
      emergencyStoppedAt: state.emergencyStoppedAt,
      emergencyStoppedReason: state.emergencyStoppedReason,
      consecutiveLosses: state.consecutiveLosses,
      tradingHaltedUntil: state.tradingHaltedUntil,
      liveTradingAllowedByConfig: spotLiveTradingAllowedByConfig,
      testnetConfigured: isBybitConfigured("testnet"),
      liveConfigured: isBybitConfigured("live"),
      strategyEnabled: config.enabled,
      updatedAt: state.updatedAt,
    };
  });

  app.get("/spot/wallet", async (request, reply) => {
    const mode = ((request.query as Record<string, string>).mode as BybitMode) ?? getSpotBotState().mode;
    if (!isBybitConfigured(mode)) return { configured: false, mode, totalEquityUsd: null, availableBalanceUsd: null };
    try {
      const balance = await getWalletBalance(mode);
      return { configured: true, mode, totalEquityUsd: balance?.totalEquityUsd ?? null, availableBalanceUsd: balance?.availableBalanceUsd ?? null };
    } catch (err) {
      return reply.code(502).send({ error: "bybit_error", message: (err as Error).message });
    }
  });

  app.get("/spot/config", async () => getSpotStrategyConfig());

  app.patch("/spot/config", async (request, reply) => {
    const parsed = ConfigPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    try {
      return updateSpotStrategyConfig(parsed.data);
    } catch (err) {
      return reply.code(400).send({ error: "validation_error", message: (err as Error).message });
    }
  });

  app.post("/spot/control/start", async () => startSpotBot());
  app.post("/spot/control/stop", async () => stopSpotBot());

  app.post("/spot/control/mode", async (request, reply) => {
    const parsed = ModeBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    const result = requestSpotModeChange(parsed.data.mode, parsed.data.confirmed);
    if (!result.ok) return reply.code(400).send({ error: "mode_change_rejected", message: result.reason });
    return result.state;
  });

  app.post("/spot/control/emergency-stop", async (request, reply) => {
    const parsed = EmergencyStopBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    stopSpotBot();
    return triggerSpotEmergencyStop("dashboard-user", parsed.data.reason);
  });

  app.post("/spot/control/resume", async (request, reply) => {
    const parsed = ResumeBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", message: "Resuming requires { confirm: true }." });
    return resumeSpotFromEmergencyStop("dashboard-user");
  });

  app.get("/spot/signals", async () => decimalToPlain(listSignals(100)));

  app.get("/spot/positions", async (request) => {
    const mode = (request.query as Record<string, string>).mode as BybitMode | undefined;
    return decimalToPlain(listSpotPositions(mode, 200));
  });

  app.post("/spot/positions/:id/close", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await manualCloseSpotPosition(id);
    if (!result.ok) return reply.code(400).send({ error: "close_failed", message: result.reason });
    return { ok: true };
  });

  app.get("/spot/trades", async () => listSpotTrades(200));

  app.get("/spot/candles", async (request, reply) => {
    const q = request.query as Record<string, string>;
    const symbol = q.symbol || defaultChartSymbol();
    const mode = (q.mode as BybitMode) ?? getSpotBotState().mode;
    try {
      const candles = await getKlines(symbol, 5, 120, mode, "spot");
      return { symbol, mode, candles };
    } catch (err) {
      return reply.code(502).send({ error: "bybit_error", message: (err as Error).message });
    }
  });

  app.get("/spot/orderbook", async (request, reply) => {
    const q = request.query as Record<string, string>;
    const symbol = q.symbol || defaultChartSymbol();
    const mode = (q.mode as BybitMode) ?? getSpotBotState().mode;
    try {
      const book = await getOrderbook(symbol, 12, mode, "spot");
      return { symbol, mode, ...book };
    } catch (err) {
      return reply.code(502).send({ error: "bybit_error", message: (err as Error).message });
    }
  });

  app.get("/spot/ticker", async (request, reply) => {
    const q = request.query as Record<string, string>;
    const symbol = q.symbol || defaultChartSymbol();
    const mode = (q.mode as BybitMode) ?? getSpotBotState().mode;
    try {
      const ticker = await getTicker(symbol, mode, "spot");
      return { symbol, mode, ticker };
    } catch (err) {
      return reply.code(502).send({ error: "bybit_error", message: (err as Error).message });
    }
  });
}
