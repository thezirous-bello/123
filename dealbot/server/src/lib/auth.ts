import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env.js";

const SESSION_COOKIE = "dealbot_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// Single-operator private admin tool — sessions live in memory, not the DB.
// A server restart logs the operator out, which is an acceptable tradeoff
// for a tool with exactly one user and no self-registration.
const sessions = new Map<string, number>(); // token -> expiresAtMs

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyCredentials(username: string, password: string): boolean {
  return safeEqual(username, env.DASHBOARD_USERNAME) && safeEqual(password, env.DASHBOARD_PASSWORD);
}

export function createSession(reply: FastifyReply): void {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function destroySession(request: FastifyRequest, reply: FastifyReply): void {
  const token = request.cookies[SESSION_COOKIE];
  if (token) sessions.delete(token);
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function isAuthenticated(request: FastifyRequest): boolean {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

/** Fastify preHandler — every route registered under it 401s without a
 * valid session cookie. Applied to every /api/* route except /api/auth/*. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!isAuthenticated(request)) {
    reply.code(401).send({ error: "unauthorized" });
  }
}
