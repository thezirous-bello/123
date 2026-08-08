import { botEvents } from "./events.js";

export type ProviderId =
  | "dexscreener"
  | "solanaRpc"
  | "jupiter"
  | "helius"
  | "bybit"
  | "fearGreed"
  | "binance"
  | "okx"
  | "kucoin"
  | "gateio"
  | "mexc";

export interface ProviderHealthState {
  provider: ProviderId;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  totalCalls: number;
  totalFailures: number;
  lastLatencyMs: number | null;
}

const state = new Map<ProviderId, ProviderHealthState>();

function ensure(provider: ProviderId): ProviderHealthState {
  let entry = state.get(provider);
  if (!entry) {
    entry = {
      provider,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
      consecutiveFailures: 0,
      totalCalls: 0,
      totalFailures: 0,
      lastLatencyMs: null,
    };
    state.set(provider, entry);
  }
  return entry;
}

export function recordProviderSuccess(provider: ProviderId, latencyMs: number): void {
  const entry = ensure(provider);
  entry.lastSuccessAt = new Date().toISOString();
  entry.consecutiveFailures = 0;
  entry.totalCalls += 1;
  entry.lastLatencyMs = Math.round(latencyMs);
  botEvents.emitEvent("provider_health_changed", entry);
}

export function recordProviderFailure(provider: ProviderId, error: string): void {
  const entry = ensure(provider);
  entry.lastFailureAt = new Date().toISOString();
  entry.lastError = error;
  entry.consecutiveFailures += 1;
  entry.totalCalls += 1;
  entry.totalFailures += 1;
  botEvents.emitEvent("provider_health_changed", entry);
}

export function getProviderHealth(): ProviderHealthState[] {
  return Array.from(state.values());
}
