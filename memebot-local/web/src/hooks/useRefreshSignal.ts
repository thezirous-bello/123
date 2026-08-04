import { useSyncExternalStore } from "react";

// One shared SSE connection for the whole app. Every subscriber (dashboard
// panel) re-fetches its own data whenever this counter changes, which
// happens on every server-pushed event and on a 5s fallback in case the
// SSE connection drops — simple, no shared cache to keep consistent.
let tick = 0;
const listeners = new Set<() => void>();

function bump() {
  tick += 1;
  for (const l of listeners) l();
}

let started = false;
function ensureStarted() {
  if (started) return;
  started = true;

  const source = new EventSource("/api/stream");
  source.addEventListener("message", bump);
  for (const evt of ["bot_state_changed", "position_changed", "trade_created", "log_created", "risk_event_created", "wallet_balance_changed"]) {
    source.addEventListener(evt, bump);
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
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => tick,
  );
}
