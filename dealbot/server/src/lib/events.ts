import { EventEmitter } from "node:events";

export type BotEventName =
  | "bot_state_changed"
  | "activity_logged"
  | "deal_discovered"
  | "deal_updated"
  | "deal_posted"
  | "source_health_changed"
  | "telegram_health_changed"
  | "click_recorded"
  | "conversion_recorded";

class BotEventBus extends EventEmitter {
  emitEvent(name: BotEventName, payload: unknown) {
    this.emit(name, payload);
    this.emit("*", { event: name, payload });
  }
}

export const botEvents = new BotEventBus();
botEvents.setMaxListeners(50);
