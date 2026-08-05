import { useEffect, useSyncExternalStore } from "react";

// One shared SSE connection for the whole app. Every subscriber (dashboard
// panel) re-fetches its own data whenever this counter changes, which
// happens on every server-pushed event and on a 5s fallback in case the
// SSE connection drops — simple, no shared cache to keep consistent.
//
// useBotEvent (below) taps the same connection for consumers that want the
// actual event payload (e.g. which mint just traded) rather than just a
// "something changed, go refetch" signal.
export const BOT_EVENT_NAMES = [
  "bot_state_changed",
  "position_changed",
  "trade_created",
  "log_created",
  "risk_event_created",
  "wallet_balance_changed",
  "provider_health_changed",
] as const;
export type BotEventName = (typeof BOT_EVENT_NAMES)[number];

let tick = 0;
const tickListeners = new Set<() => void>();
const rawListeners = new Map<BotEventName, Set<(payload: unknown) => void>>();

function bump() {
  tick += 1;
  for (const l of tickListeners) l();
}

let started = false;
function ensureStarted() {
  if (started) return;
  started = true;

  const source = new EventSource("/api/stream");
  for (const evt of BOT_EVENT_NAMES) {
    source.addEventListener(evt, (e: MessageEvent) => {
      bump();
      let payload: unknown = null;
      try {
        payload = JSON.parse(e.data);
      } catch {
        // ignore malformed payloads — the tick-based refetch still covers it
      }
      const set = rawListeners.get(evt);
      if (set) for (const l of set) l(payload);
    });
  }
  source.onerror = () => {
    // EventSource auto-reconnects; the fallback interval below covers gaps.
  };

  setInterval(bump, 5000);
}

export function useRefreshSignal(): number {
  ensureStarted();
  return useSyncExternalStore(
    (onStoreChange) => {
      tickListeners.add(onStoreChange);
      return () => tickListeners.delete(onStoreChange);
    },
    () => tick,
  );
}

/** Subscribes to the raw payload of a specific server-pushed event, over
 * the same shared SSE connection. Use for live animations/feeds that need
 * to react to exactly what happened, not just "refetch everything". */
export function useBotEvent<T = unknown>(name: BotEventName, handler: (payload: T) => void): void {
  ensureStarted();
  useEffect(() => {
    if (!rawListeners.has(name)) rawListeners.set(name, new Set());
    const set = rawListeners.get(name)!;
    const wrapped = (payload: unknown) => handler(payload as T);
    set.add(wrapped);
    return () => {
      set.delete(wrapped);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, handler]);
}
