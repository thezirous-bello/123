import { useEffect, useSyncExternalStore } from "react";

export const BOT_EVENT_NAMES = [
  "bot_state_changed",
  "activity_logged",
  "deal_discovered",
  "deal_updated",
  "deal_posted",
  "source_health_changed",
  "telegram_health_changed",
  "click_recorded",
  "conversion_recorded",
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
