import { env } from "./env.js";
import { logActivity } from "./lib/activityLog.js";
import { botEvents } from "./lib/events.js";
import { getBotState, setRunning, setPaused, recordScanCompleted } from "./state.js";
import { listSources, recordSourceScanResult, ensureDemoSourceSeeded, getSource } from "./sources/repository.js";
import { getAdapter } from "./sources/registry.js";
import {
  upsertOffer,
  getOffer,
  getProduct,
  getPriceHistory,
  updateOfferStatus,
  markOfferPosted,
  listOffersByStatus,
  listOffersForProduct,
  lastPostedAgoHours,
  type OfferRow,
  type ProductRow,
} from "./deals/repository.js";
import { verifyDeal } from "./deals/verification.js";
import { scoreOffer } from "./deals/scoring.js";
import { saveAnalysis, saveScore, getLatestAnalysis, getLatestScore } from "./deals/analysisRepository.js";
import { buildAffiliateUrl } from "./affiliate/linkBuilder.js";
import { createAffiliateLink } from "./affiliate/repository.js";
import { generatePost } from "./telegram/postGenerator.js";
import {
  createPost,
  markPostResult,
  markPostDealEnded,
  listChannels,
  getChannel,
  listPostsForOffer,
  postsInLastHour,
  postsToday,
  type ChannelRow,
} from "./telegram/repository.js";
import { sendTelegramMessage, editTelegramMessage, sendAdminNotification } from "./telegram/client.js";
import { evaluatePostingRules } from "./rules/postingRules.js";
import { isProductBlocked, isBrandBlocked } from "./rules/blocklistRepository.js";

let timer: ReturnType<typeof setTimeout> | null = null;
let scanning = false;
let lastSourceStatus = new Map<string, string>();

export function startBot(): void {
  ensureDemoSourceSeeded();
  setRunning(true);
  logActivity("info", "bot", "Bot started");
  scheduleNext(0);
}

export function stopBot(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  const wasRunning = getBotState().running;
  setRunning(false);
  if (wasRunning) {
    logActivity("warn", "bot", "Bot stopped");
    void sendAdminNotification("🔴 DealBot stopped.");
  }
}

export function pauseBot(paused: boolean): void {
  setPaused(paused);
  logActivity("info", "bot", paused ? "Bot paused" : "Bot resumed");
}

/** Manual "SCAN NOW" — runs immediately regardless of running/stopped
 * state (spec section 12 lists it as an independent control, not a
 * shortcut for "start + wait"). Does not affect the recurring schedule. */
export async function triggerScanNow(): Promise<void> {
  await performScanCycle(false);
}

function scheduleNext(delayMs: number): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void scheduledScanCycle();
  }, delayMs);
}

async function scheduledScanCycle(): Promise<void> {
  if (!getBotState().running) return;
  await performScanCycle(true);
}

async function performScanCycle(reschedule: boolean): Promise<void> {
  if (scanning) return;
  scanning = true;
  let found = 0;
  try {
    const state = getBotState();
    if (!state.paused) {
      found = await scanSources();
      await analyzeDiscoveredOffers();
      await monitorPostedOffers();
      await autoPostQualifiedOffers();
      logActivity("debug", "scan", "Continuing scan...");
    } else {
      logActivity("debug", "bot", "Scan skipped — bot is paused.");
    }
  } catch (err) {
    logActivity("error", "bot", `Scan cycle failed: ${(err as Error).message}`);
  } finally {
    scanning = false;
    const intervalMs = env.SCAN_INTERVAL_MINUTES * 60_000;
    const nextAt = new Date(Date.now() + intervalMs).toISOString();
    recordScanCompleted(found, reschedule ? nextAt : null);
    if (reschedule && getBotState().running) scheduleNext(intervalMs);
  }
}

async function scanSources(): Promise<number> {
  logActivity("info", "scan", "Scanning product feeds...");
  const sources = listSources().filter((s) => s.enabled);
  if (sources.length === 0) {
    logActivity("warn", "scan", "No sources enabled — nothing to scan.");
    return 0;
  }

  let totalOffers = 0;
  for (const source of sources) {
    const adapter = getAdapter(source.kind);
    if (!adapter) {
      logActivity("warn", "scan", `Source "${source.name}" has unknown adapter kind "${source.kind}" — skipping.`);
      continue;
    }
    const result = await adapter.scan(JSON.parse(source.config_json));
    recordSourceScanResult(source.id, result.ok, result.error);

    const previousStatus = lastSourceStatus.get(source.id);
    if (!result.ok) {
      logActivity("error", "scan", `Source "${source.name}" scan failed: ${result.error}`);
      if (previousStatus !== "down") void sendAdminNotification(`⚠️ DealBot source "${source.name}" is failing: ${result.error}`);
      lastSourceStatus.set(source.id, "down");
      continue;
    }
    lastSourceStatus.set(source.id, "ok");

    for (const raw of result.offers) {
      upsertOffer(source.id, raw);
      totalOffers++;
    }
    logActivity("info", "scan", `${result.offers.length} product(s) received from "${source.name}".`);
  }
  return totalOffers;
}

function priceIsLowestAmongOffers(offer: OfferRow): { competingCount: number; isLowest: boolean } {
  const siblings = listOffersForProduct(offer.product_id).filter((o) => o.id !== offer.id && o.status !== "rejected");
  if (siblings.length === 0) return { competingCount: 0, isLowest: true };
  const lowestSibling = Math.min(...siblings.map((o) => Number(o.current_price)));
  return { competingCount: siblings.length, isLowest: Number(offer.current_price) <= lowestSibling };
}

async function analyzeDiscoveredOffers(): Promise<void> {
  const discovered = listOffersByStatus("discovered", 500);
  if (discovered.length === 0) return;
  logActivity("info", "analysis", `Comparing prices for ${discovered.length} product(s)...`);

  let qualified = 0;
  for (const offer of discovered) {
    updateOfferStatus(offer.id, "analyzing");
    const history = getPriceHistory(offer.id, 30);
    const verification = verifyDeal(offer, history);
    saveAnalysis(offer.id, verification);

    const product = getProduct(offer.product_id)!;
    const source = getSource(offer.source_id);
    const commissionInfo = source ? (JSON.parse(source.commission_info_json) as { defaultPct?: number }) : {};
    const { competingCount, isLowest } = priceIsLowestAmongOffers(offer);

    const score = scoreOffer({
      discountPct: verification.discountPct,
      dealConfidence: verification.confidence,
      rating: product.rating,
      reviewCount: product.review_count,
      availability: offer.availability,
      competingOfferCount: competingCount,
      isPriceLowestAmongOffers: isLowest,
      commissionPct: commissionInfo.defaultPct ?? null,
      currentPrice: Number(offer.current_price),
    });
    saveScore(offer.id, score);

    logActivity("info", "analysis", `Evaluating ${product.name}`);
    logActivity("info", "analysis", `Deal Score: ${score.dealScore}`);
    logActivity("info", "analysis", `Profit Score: ${score.profitScore}`);

    if (score.statusLabel === "reject") {
      updateOfferStatus(offer.id, "rejected", `Deal score ${score.dealScore} (below threshold).`);
    } else {
      updateOfferStatus(offer.id, "approved");
      qualified++;
      if (score.statusLabel === "excellent") {
        void sendAdminNotification(`🔥 Exceptional deal detected: ${product.name} — Deal Score ${score.dealScore}, Profit Score ${score.profitScore}.`);
      }
    }
  }
  logActivity("info", "analysis", `${qualified} potential deal(s) found.`);
}

/** Spec section 15: stop promoting deals that no longer hold — if a
 * previously-posted offer comes back out of stock on a later scan, mark
 * it expired and, where we have the Telegram message id, edit the post to
 * say so instead of leaving a stale promotion up. */
async function monitorPostedOffers(): Promise<void> {
  const posted = listOffersByStatus("posted", 500);
  for (const offer of posted) {
    if (offer.availability !== "out_of_stock") continue;
    updateOfferStatus(offer.id, "out_of_stock");
    logActivity("warn", "monitor", `${offer.merchant} offer for this product is now out of stock — marking expired.`);

    for (const post of listPostsForOffer(offer.id)) {
      if (post.status !== "posted" || !post.telegram_message_id) continue;
      const channel = getChannel(post.channel_id);
      if (!channel) continue;
      const result = await editTelegramMessage(channel.chat_id, post.telegram_message_id, `${post.message_text}\n\n❌ DEAL ENDED`);
      if (result.ok) markPostDealEnded(post.id);
    }
  }
}

function pickChannelForOffer(channels: ChannelRow[], product: ProductRow): ChannelRow | undefined {
  const specific = channels.find((c) => {
    const cats = JSON.parse(c.categories_json) as string[];
    return cats.length > 0 && product.category && cats.includes(product.category);
  });
  if (specific) return specific;
  return channels.find((c) => (JSON.parse(c.categories_json) as string[]).length === 0);
}

async function autoPostQualifiedOffers(): Promise<void> {
  const approved = listOffersByStatus("approved", 200);
  if (approved.length === 0) return;
  const channels = listChannels().filter((c) => c.enabled);
  if (channels.length === 0) return;

  for (const offer of approved) {
    const product = getProduct(offer.product_id)!;
    if (isProductBlocked(product.id) || isBrandBlocked(product.brand)) {
      updateOfferStatus(offer.id, "rejected", "Blocked product/brand.");
      continue;
    }

    const channel = pickChannelForOffer(channels, product);
    if (!channel) continue;

    const analysis = getLatestAnalysis(offer.id)!;
    const score = getLatestScore(offer.id)!;

    if (score.deal_score < channel.min_deal_score || score.profit_score < channel.min_profit_score) continue;
    if (postsInLastHour(channel.id) >= channel.max_posts_per_hour) continue;
    if (postsToday(channel.id) >= channel.max_posts_per_day) continue;

    const source = getSource(offer.source_id)!;
    const linkResult = buildAffiliateUrl({ productUrl: offer.product_url, affiliateTag: source.affiliate_tag ?? env.DEFAULT_AFFILIATE_TAG ?? null });
    const link = createAffiliateLink({
      offerId: offer.id,
      originalUrl: offer.product_url,
      affiliateUrl: linkResult.affiliateUrl,
      provider: linkResult.ok ? "tag-based" : "none",
      ok: linkResult.ok,
      error: linkResult.error,
    });

    if (!linkResult.ok) {
      // Per spec section 9: never auto-post without a real affiliate link.
      updateOfferStatus(offer.id, "error", `AFFILIATE LINK ERROR: ${linkResult.error}`);
      logActivity("error", "affiliate", `AFFILIATE LINK ERROR for ${product.name}: ${linkResult.error}`);
      void sendAdminNotification(`⚠️ Affiliate link failed for ${product.name}: ${linkResult.error}`);
      continue;
    }
    logActivity("info", "affiliate", "Affiliate link generated");

    const ruleCheck = evaluatePostingRules({
      dealScore: score.deal_score,
      dealConfidence: analysis.deal_confidence,
      discountPct: analysis.discount_pct,
      rating: product.rating,
      reviewCount: product.review_count,
      estimatedCommission: score.estimated_commission,
      availability: offer.availability,
      hasAffiliateUrl: true,
      category: product.category,
      country: offer.country,
      isBlocked: false,
      lastPostedAgoHours: lastPostedAgoHours(product.id),
    });

    if (!ruleCheck.passes) {
      updateOfferStatus(offer.id, "rejected", ruleCheck.reasons.join(" "));
      continue;
    }

    updateOfferStatus(offer.id, "queued");

    const outboundUrl = env.PUBLIC_BASE_URL ? `${env.PUBLIC_BASE_URL}/r/${link.tracking_slug}` : link.affiliate_url!;
    if (!env.PUBLIC_BASE_URL) {
      logActivity("debug", "affiliate", "PUBLIC_BASE_URL not set — posting the affiliate URL directly; click tracking is unavailable.");
    }

    const messageText = generatePost(
      {
        productName: product.name,
        brand: product.brand,
        currentPrice: offer.current_price,
        currency: offer.currency,
        referencePrice: offer.reference_price,
        discountPct: analysis.discount_pct,
        absoluteSaving: analysis.absolute_saving,
        rating: product.rating,
        reviewCount: product.review_count,
        affiliateUrl: outboundUrl,
      },
      hashSeed(offer.id),
    );
    logActivity("info", "post", "Telegram post generated");

    const postRow = createPost({ offerId: offer.id, channelId: channel.id, messageText });
    const sendResult = await sendTelegramMessage(channel.chat_id, messageText);
    if (sendResult.ok) {
      markPostResult(postRow.id, true, sendResult.messageId);
      markOfferPosted(offer.id);
      logActivity("info", "post", `Posted → ${channel.name}`);
      botEvents.emitEvent("deal_posted", { offerId: offer.id, channelId: channel.id, channelName: channel.name });
    } else {
      markPostResult(postRow.id, false, undefined, sendResult.error);
      updateOfferStatus(offer.id, "error", `Telegram post failed: ${sendResult.error}`);
      logActivity("error", "post", `Telegram post failed for ${product.name}: ${sendResult.error}`);
      void sendAdminNotification(`⚠️ Telegram post failed for ${product.name}: ${sendResult.error}`);
    }
  }
}

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Manual "POST NOW" from the dashboard — bypasses the score/rule gate
 * (the operator is explicitly overriding), but still requires a real
 * affiliate link, same as the automatic path. */
export async function postOfferNow(offerId: string, channelId: string): Promise<{ ok: boolean; error?: string }> {
  const offer = getOffer(offerId);
  if (!offer) return { ok: false, error: "Offer not found." };
  const product = getProduct(offer.product_id);
  if (!product) return { ok: false, error: "Product not found." };
  const channel = getChannel(channelId);
  if (!channel) return { ok: false, error: "Channel not found." };

  const source = getSource(offer.source_id);
  const linkResult = buildAffiliateUrl({ productUrl: offer.product_url, affiliateTag: source?.affiliate_tag ?? env.DEFAULT_AFFILIATE_TAG ?? null });
  const link = createAffiliateLink({
    offerId: offer.id,
    originalUrl: offer.product_url,
    affiliateUrl: linkResult.affiliateUrl,
    provider: linkResult.ok ? "tag-based" : "none",
    ok: linkResult.ok,
    error: linkResult.error,
  });
  if (!linkResult.ok) {
    updateOfferStatus(offer.id, "error", `AFFILIATE LINK ERROR: ${linkResult.error}`);
    return { ok: false, error: linkResult.error ?? "Affiliate link generation failed." };
  }

  const analysis = getLatestAnalysis(offer.id);
  const outboundUrl = env.PUBLIC_BASE_URL ? `${env.PUBLIC_BASE_URL}/r/${link.tracking_slug}` : link.affiliate_url!;
  const messageText = generatePost(
    {
      productName: product.name,
      brand: product.brand,
      currentPrice: offer.current_price,
      currency: offer.currency,
      referencePrice: offer.reference_price,
      discountPct: analysis?.discount_pct ?? offer.discount_pct,
      absoluteSaving: analysis?.absolute_saving ?? null,
      rating: product.rating,
      reviewCount: product.review_count,
      affiliateUrl: outboundUrl,
    },
    hashSeed(offer.id + Date.now()),
  );

  const postRow = createPost({ offerId: offer.id, channelId: channel.id, messageText });
  const sendResult = await sendTelegramMessage(channel.chat_id, messageText);
  if (sendResult.ok) {
    markPostResult(postRow.id, true, sendResult.messageId);
    markOfferPosted(offer.id);
    logActivity("info", "post", `Posted → ${channel.name} (manual)`);
    botEvents.emitEvent("deal_posted", { offerId: offer.id, channelId: channel.id, channelName: channel.name });
    return { ok: true };
  }
  markPostResult(postRow.id, false, undefined, sendResult.error);
  return { ok: false, error: sendResult.error };
}
