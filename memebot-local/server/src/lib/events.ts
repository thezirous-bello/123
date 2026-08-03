import { EventEmitter } from "node:events";

export type BotEventName =
  | "bot_state_changed"
  | "position_changed"
  | "trade_created"
  | "log_created"
  | "risk_event_created"
  | "wallet_balance_changed";

class BotEventBus extends EventEmitter {
  emitEvent(name: BotEventName, payload: unknown) {
    this.emit(name, payload);
    this.emit("*", { event: name, payload });
  }
}

export const botEvents = new BotEventBus();
botEvents.setMaxListeners(50);
