import { EventEmitter } from "node:events";

export type BotEventName =
  | "bot_state_changed"
  | "position_changed"
  | "trade_created"
  | "log_created"
  | "risk_event_created"
  | "wallet_balance_changed"
  | "provider_health_changed"
  | "spot_state_changed"
  | "spot_signal_changed"
  | "spot_position_changed"
  | "spot_trade_created"
  | "futures_state_changed"
  | "futures_signal_changed"
  | "futures_position_changed"
  | "futures_trade_created"
  | "arb_state_changed"
  | "arb_opportunity_created"
  | "arb_trade_created"
  | "arb_journey_changed";

class BotEventBus extends EventEmitter {
  emitEvent(name: BotEventName, payload: unknown) {
    this.emit(name, payload);
    this.emit("*", { event: name, payload });
  }
}

export const botEvents = new BotEventBus();
botEvents.setMaxListeners(50);
