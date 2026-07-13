import { EventEmitter } from "node:events";
import type { EventSource } from "@/lib/enums";

/** Внутрипроцессная шина событий для real-time (SSE). Синглтон на globalThis. */
const g = globalThis as unknown as { __leadhubBus?: EventEmitter };
export const bus: EventEmitter = (g.__leadhubBus ??= new EventEmitter());
bus.setMaxListeners(0);

export interface LeadStatusChanged {
  type: "lead.status.changed";
  leadId: string;
  status: string;
  rawStatus: string;
  source: EventSource;
  at: string;
}

const CHANNEL = "lead";

export function publishLeadStatus(e: LeadStatusChanged): void {
  bus.emit(CHANNEL, e);
}

export function onLeadStatus(handler: (e: LeadStatusChanged) => void): () => void {
  bus.on(CHANNEL, handler);
  return () => bus.off(CHANNEL, handler);
}

/** Число активных подписчиков (используется демо-тикером, чтобы не молотить впустую). */
export function subscriberCount(): number {
  return bus.listenerCount(CHANNEL);
}
