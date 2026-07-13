import type { HydratedDocument } from "mongoose";
import Lead, { type ILead, type ILeadMethods } from "@/models/Lead";
import StatusEvent from "@/models/StatusEvent";
import type { IIntegration, IStatusMap } from "@/models/Integration";
import { LEAD_STATUSES, type LeadStatus, type EventSource } from "@/lib/enums";
import { publishLeadStatus } from "@/lib/events";

/**
 * Нормализация внешнего статуса → внутренний LeadStatus.
 * Сначала по StatusMapping интеграции, затем — прямое совпадение с enum.
 */
export function normalizeStatus(
  rawStatus: string,
  mappings?: IStatusMap[],
): { status: LeadStatus | null; known: boolean } {
  const raw = rawStatus.trim().toLowerCase();
  const mapped = mappings?.find((m) => m.externalValue.trim().toLowerCase() === raw);
  if (mapped) return { status: mapped.internalValue, known: true };

  const direct = raw.toUpperCase().replace(/\s+/g, "_");
  if ((LEAD_STATUSES as readonly string[]).includes(direct)) {
    return { status: direct as LeadStatus, known: true };
  }
  return { status: null, known: false };
}

export interface StatusUpdateResult {
  changed: boolean;
  status: string;
  known: boolean;
}

/**
 * Применяет входящий статус к лиду: нормализует, пишет StatusEvent, обновляет
 * лид и публикует real-time событие. Общий путь для callback, поллинга и тикера.
 */
export async function applyStatusUpdate(
  lead: HydratedDocument<ILead, ILeadMethods>,
  integration: (IIntegration & { _id: unknown }) | null,
  rawStatus: string,
  source: EventSource,
): Promise<StatusUpdateResult> {
  const { status: normalized, known } = normalizeStatus(rawStatus, integration?.statusMappings);
  const effective: string = normalized ?? lead.status;
  const changed = normalized != null && normalized !== lead.status;

  await StatusEvent.create({
    lead: lead._id,
    integration: integration?._id ?? null,
    rawStatus,
    status: effective,
    source,
    note: known ? undefined : `Неизвестный внешний статус: ${rawStatus}`,
  });

  if (changed && normalized) {
    lead.status = normalized;
    // FTD/депозит — проставим баланс, если ещё нулевой.
    if (normalized === "DEPOSIT" && (!lead.balance || lead.balance === 0)) {
      lead.balance = 200 + Math.floor(Math.random() * 1300);
    }
    await lead.save();
  }

  publishLeadStatus({
    type: "lead.status.changed",
    leadId: String(lead._id),
    status: effective,
    rawStatus,
    source,
    at: new Date().toISOString(),
  });

  return { changed, status: effective, known };
}

/** Находит лид по внешнему ID (для входящего callback). */
export async function findLeadByExternalId(externalId: string) {
  return Lead.findOne({ externalId });
}
