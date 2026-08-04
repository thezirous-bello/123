import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requestModeChange, startBot, stopBot } from "../engine/botController.js";
import { getBotState, resumeFromEmergencyStop, triggerEmergencyStop } from "../engine/emergency.js";
import { resetPaperAccount } from "../engine/paperAccount.js";
import { Decimal } from "../lib/decimal.js";

const ModeBodySchema = z.object({ mode: z.enum(["paper", "live"]), confirmed: z.boolean().default(false) });
const EmergencyStopBodySchema = z.object({ reason: z.string().min(1).max(500) });
const ResumeBodySchema = z.object({ confirm: z.literal(true) });
const PaperResetBodySchema = z.object({ startingBalanceUsd: z.number().gt(0).max(10_000_000) });

export default async function controlRoutes(app: FastifyInstance) {
  app.post("/control/start", async () => startBot());

  app.post("/control/stop", async () => stopBot());

  app.post("/control/mode", async (request, reply) => {
    const parsed = ModeBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    const result = requestModeChange(parsed.data.mode, parsed.data.confirmed);
    if (!result.ok) return reply.code(400).send({ error: "mode_change_rejected", message: result.reason });
    return result.state;
  });

  app.post("/control/emergency-stop", async (request, reply) => {
    const parsed = EmergencyStopBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    stopBot();
    return triggerEmergencyStop("dashboard-user", parsed.data.reason);
  });

  app.post("/control/resume", async (request, reply) => {
    const parsed = ResumeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", message: "Resuming requires { confirm: true }." });
    }
    return resumeFromEmergencyStop("dashboard-user");
  });

  app.get("/control/state", async () => getBotState());

  app.post("/paper/reset", async (request, reply) => {
    const parsed = PaperResetBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    const account = resetPaperAccount(new Decimal(parsed.data.startingBalanceUsd));
    return { startingBalanceUsd: account.startingBalanceUsd.toFixed(), cashBalanceUsd: account.cashBalanceUsd.toFixed() };
  });
}
