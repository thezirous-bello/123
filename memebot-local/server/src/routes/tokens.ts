import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { searchTokens, getFreshTokenSnapshot, listRecentSnapshots } from "../market/snapshotService.js";
import { fetchHolderConcentration, fetchOnChainMintInfo } from "../market/onchain.js";
import { checkSellRoute } from "../jupiter/quote.js";
import { quoteTokenMint } from "../jupiter/constants.js";
import { latestSecurityReport, persistSecurityReport, runTokenSecurityAnalysis } from "../security/tokenSecurity.js";
import { addToWatchlist, listWatchlist, removeFromWatchlist, setTokenBlocked } from "../market/watchlist.js";
import { runAutoDiscovery } from "../engine/botController.js";
import { Decimal } from "../lib/decimal.js";
import { fetchBirdeyeEnrichment } from "../market/birdeye.js";
import { listLatestMomentumScores } from "../market/momentumRepository.js";

const SearchQuerySchema = z.object({ q: z.string().min(1).max(100) });
const WatchlistBodySchema = z.object({ mint: z.string().min(32).max(64), symbol: z.string().optional(), name: z.string().optional() });

export default async function tokenRoutes(app: FastifyInstance) {
  app.get("/tokens/search", async (request, reply) => {
    const parsed = SearchQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    const results = await searchTokens(parsed.data.q);
    return results;
  });

  app.get("/tokens/:mint", async (request, reply) => {
    const { mint } = request.params as { mint: string };
    const snapshot = await getFreshTokenSnapshot(mint);
    if (!snapshot) return reply.code(404).send({ error: "not_found", message: "No market data found for this mint address." });

    const [onchain, holders] = await Promise.all([fetchOnChainMintInfo(mint), fetchHolderConcentration(mint)]);
    let sellRoute = null;
    if (onchain) {
      const nominalAmount = new Decimal(10).times(10 ** onchain.decimals).toFixed(0);
      sellRoute = await checkSellRoute(mint, nominalAmount, quoteTokenMint("SOL"));
    }
    const security = runTokenSecurityAnalysis({ mint, snapshot, onchain, holders, sellRoute });
    persistSecurityReport(security);

    // Best-effort, on-demand only — never called from the per-tick scan
    // loop, so a single-token detail lookup can't burn through Birdeye's
    // rate limits the way calling it for the whole watchlist would.
    const birdeye = await fetchBirdeyeEnrichment(mint);

    return { snapshot, onchain, holders, security, birdeye };
  });

  /** The live ranked opportunity table: every currently-watched token's most
   * recent momentum score, sorted by the bot's own opportunity score rather
   * than raw 24h gain — see market/momentum.ts and momentumRepository.ts. */
  app.get("/tokens/ranking", async () => listLatestMomentumScores(150));

  app.get("/tokens/:mint/history", async (request) => {
    const { mint } = request.params as { mint: string };
    const { limit } = request.query as { limit?: string };
    return listRecentSnapshots(mint, limit ? Number.parseInt(limit, 10) : 60);
  });

  app.get("/tokens/:mint/security", async (request, reply) => {
    const { mint } = request.params as { mint: string };
    const report = latestSecurityReport(mint);
    if (!report) return reply.code(404).send({ error: "not_found" });
    return report;
  });

  app.get("/watchlist", async () => listWatchlist());

  /** Manually kick off the same auto-discovery pass the bot runs on its own
   * interval — lets the dashboard populate the watchlist immediately
   * instead of waiting for the next scheduled round. */
  app.post("/tokens/discover", async () => runAutoDiscovery());

  app.post("/watchlist", async (request, reply) => {
    const parsed = WatchlistBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    const entry = addToWatchlist(parsed.data.mint, parsed.data.symbol ?? null, parsed.data.name ?? null);
    return reply.code(201).send(entry);
  });

  app.delete("/watchlist/:mint", async (request) => {
    const { mint } = request.params as { mint: string };
    removeFromWatchlist(mint);
    return { ok: true };
  });

  app.post("/watchlist/:mint/block", async (request) => {
    const { mint } = request.params as { mint: string };
    setTokenBlocked(mint, true);
    return { ok: true };
  });

  app.post("/watchlist/:mint/unblock", async (request) => {
    const { mint } = request.params as { mint: string };
    setTokenBlocked(mint, false);
    return { ok: true };
  });
}
