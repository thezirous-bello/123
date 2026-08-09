const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { ...(hasBody ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(body?.message ?? body?.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

function get<T>(path: string): Promise<T> {
  return request<T>(path);
}
function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });
}
function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}
function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

// ---- Types ----

export interface BotState {
  running: number;
  paused: number;
  last_scan_at: string | null;
  next_scan_at: string | null;
  last_scan_products_found: number;
  demoMode: boolean;
}

export interface DashboardMetrics {
  dealsScannedToday: number;
  qualifiedDealsToday: number;
  dealsPostedToday: number;
  clicksToday: number;
  conversionsToday: number;
  revenueToday: string;
  revenueThisMonth: string;
  averageCommission: string | null;
  bestChannel: { name: string; clicks: number } | null;
  conversionsTracked: boolean;
}

export interface ActivityRecord {
  id: string;
  level: "debug" | "info" | "warn" | "error";
  category: string;
  message: string;
  details_json: string;
  created_at: string;
}

export interface DealFeedRow {
  id: string;
  productId: string;
  name: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  merchant: string;
  sourceName: string;
  country: string | null;
  currency: string;
  currentPrice: string;
  referencePrice: string | null;
  discountPct: number | null;
  dealConfidence: number | null;
  dealScore: number | null;
  profitScore: number | null;
  estimatedCommission: string | null;
  statusLabel: string | null;
  availability: string;
  status: string;
  rejectReason: string | null;
  channelName: string | null;
  clicks: number;
  conversions: number;
  revenue: string;
  firstDiscoveredAt: string;
  lastSeenAt: string;
  lastPostedAt: string | null;
}

export interface DealDetail extends DealFeedRow {
  productUrl: string;
  evidence: Record<string, unknown> | null;
  scoreBreakdown: Record<string, number> | null;
  affiliateLink: { provider: string; affiliateUrl: string | null; status: string; error: string | null; trackingSlug: string | null } | null;
  posts: Array<{ id: string; channel_id: string; channelName: string | null; message_text: string; status: string; error: string | null; posted_at: string | null; created_at: string }>;
  priceHistory: Array<{ price: string; currency: string; recorded_at: string }>;
}

export interface SourceRow {
  id: string;
  name: string;
  kind: string;
  enabled: number;
  affiliate_tag: string | null;
  countries_json: string;
  categories_json: string;
  commission_info_json: string;
  api_status: "ok" | "degraded" | "down" | "unknown";
  last_error: string | null;
  last_successful_scan_at: string | null;
  health: { status: string; lastSuccessAt: string | null; lastError: string | null; totalCalls: number; totalFailures: number };
}

export interface ChannelRow {
  id: string;
  name: string;
  chat_id: string;
  language: string;
  country: string | null;
  categories_json: string;
  min_deal_score: number;
  min_profit_score: number;
  max_posts_per_hour: number;
  max_posts_per_day: number;
  enabled: number;
}

export interface PostingRules {
  min_deal_score: number;
  min_deal_confidence: number;
  min_discount_pct: number;
  min_rating: number;
  min_reviews: number;
  min_estimated_commission: string;
  require_in_stock: number;
  require_affiliate_url: number;
  allowed_categories_json: string;
  allowed_countries_json: string;
  repost_cooldown_hours: number;
}

export interface BlockedProduct {
  id: string;
  product_id: string;
  label: string;
  reason: string | null;
  created_at: string;
}
export interface BlockedBrand {
  id: string;
  brand: string;
  reason: string | null;
  created_at: string;
}

export interface TelegramHealth {
  configured: boolean;
  ok?: boolean;
  botUsername?: string;
  error?: string;
  apiHealth?: { status: string; totalCalls: number; totalFailures: number };
}

export const api = {
  login: (username: string, password: string) => post<{ ok: boolean }>("/auth/login", { username, password }),
  logout: () => post<{ ok: boolean }>("/auth/logout"),
  me: () => get<{ authenticated: boolean }>("/auth/me"),

  status: () => get<BotState>("/status"),
  start: () => post<BotState>("/control/start"),
  stop: () => post<BotState>("/control/stop"),
  pause: () => post<BotState>("/control/pause"),
  resume: () => post<BotState>("/control/resume"),
  scanNow: () => post<{ ok: boolean }>("/control/scan-now"),

  metrics: () => get<DashboardMetrics>("/metrics"),
  activity: (limit = 200) => get<ActivityRecord[]>(`/activity?limit=${limit}`),

  deals: (status?: string, limit = 300) => get<DealFeedRow[]>(`/deals?limit=${limit}${status ? `&status=${status}` : ""}`),
  deal: (id: string) => get<DealDetail>(`/deals/${id}`),
  postDealNow: (id: string, channelId: string) => post<{ ok: boolean }>(`/deals/${id}/post-now`, { channelId }),
  rejectDeal: (id: string) => post<{ ok: boolean }>(`/deals/${id}/reject`),
  blockProduct: (id: string) => post<{ ok: boolean }>(`/deals/${id}/block-product`),
  blockBrand: (id: string) => post<{ ok: boolean }>(`/deals/${id}/block-brand`),
  regeneratePost: (id: string) => post<{ messageText: string }>(`/deals/${id}/regenerate-post`),

  sources: () => get<SourceRow[]>("/sources"),
  sourceKinds: () => get<string[]>("/sources/kinds"),
  createSource: (input: { name: string; kind: string; affiliateTag?: string; countries?: string[]; categories?: string[] }) =>
    post<SourceRow>("/sources", input),
  updateSource: (id: string, body: Partial<{ name: string; affiliateTag: string; countries: string[]; categories: string[] }>) =>
    patch<SourceRow>(`/sources/${id}`, body),
  setSourceEnabled: (id: string, enabled: boolean) => post<{ ok: boolean }>(`/sources/${id}/enabled`, { enabled }),

  channels: () => get<ChannelRow[]>("/channels"),
  createChannel: (input: {
    name: string;
    chatId: string;
    language?: string;
    country?: string;
    categories?: string[];
    minDealScore?: number;
    minProfitScore?: number;
    maxPostsPerHour?: number;
    maxPostsPerDay?: number;
  }) => post<ChannelRow>("/channels", input),
  updateChannel: (id: string, body: Record<string, unknown>) => patch<{ ok: boolean }>(`/channels/${id}`, body),
  deleteChannel: (id: string) => del<{ ok: boolean }>(`/channels/${id}`),

  postingRules: () => get<PostingRules>("/settings/posting-rules"),
  updatePostingRules: (body: Record<string, unknown>) => patch<PostingRules>("/settings/posting-rules", body),

  blockedProducts: () => get<BlockedProduct[]>("/blocklist/products"),
  blockedBrands: () => get<BlockedBrand[]>("/blocklist/brands"),
  unblockProduct: (id: string) => del<{ ok: boolean }>(`/blocklist/products/${id}`),
  unblockBrand: (id: string) => del<{ ok: boolean }>(`/blocklist/brands/${id}`),

  telegramHealth: () => get<TelegramHealth>("/health/telegram"),
};
