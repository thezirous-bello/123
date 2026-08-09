import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSession, destroySession, isAuthenticated, verifyCredentials } from "../lib/auth.js";

const LoginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error" });
    if (!verifyCredentials(parsed.data.username, parsed.data.password)) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    createSession(reply);
    return { ok: true };
  });

  app.post("/auth/logout", async (request, reply) => {
    destroySession(request, reply);
    return { ok: true };
  });

  app.get("/auth/me", async (request, reply) => {
    if (!isAuthenticated(request)) return reply.code(401).send({ authenticated: false });
    return { authenticated: true };
  });
}
