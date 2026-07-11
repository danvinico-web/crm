import { dbConnect } from "@/lib/db";
import Lead from "@/models/Lead";
import Integration from "@/models/Integration";
import { applyStatusUpdate } from "@/lib/statusSync";
import { subscriberCount } from "@/lib/events";
import { ACTIVE_LEAD_STATUSES, type LeadStatus } from "@/lib/enums";

/**
 * Демо-поллер: имитирует поток изменений статусов из внешней CRM, чтобы показать
 * real-time в UI без реального внешнего сервиса. Работает только пока есть
 * SSE-подписчики. В проде эту роль играет реальный воркер-поллер (fetchCrmStatus).
 */

// Правдоподобные переходы статусов (внешние «сырые» значения).
const NEXT_RAW: Record<string, string[]> = {
  SENT: ["call back", "no answer", "in progress", "wrong info"],
  CALLBACK: ["in progress", "no answer", "deposit", "not interested"],
  NO_ANSWER: ["call back", "not interested", "in progress"],
  IN_PROGRESS: ["deposit", "call back", "not interested"],
};

function pickRaw(status: LeadStatus): string | null {
  const opts = NEXT_RAW[status];
  if (!opts || opts.length === 0) return null;
  return opts[Math.floor(Math.random() * opts.length)];
}

const g = globalThis as unknown as { __leadhubTicker?: boolean };

export function ensureDemoTicker(): void {
  if (g.__leadhubTicker) return;
  if (process.env.DEMO_TICKER === "false") return;
  g.__leadhubTicker = true;

  setInterval(async () => {
    try {
      if (subscriberCount() === 0) return; // никто не смотрит — не шумим
      await dbConnect();
      const active = await Lead.find({
        status: { $in: ACTIVE_LEAD_STATUSES.filter((s) => s !== "NEW") },
        office: { $ne: null },
        externalId: { $ne: null },
      }).limit(30);
      if (active.length === 0) return;

      const lead = active[Math.floor(Math.random() * active.length)];
      const raw = pickRaw(lead.status);
      if (!raw) return;
      const integration = await Integration.findOne({ office: lead.office });
      await applyStatusUpdate(lead, integration, raw, "POLL");
    } catch {
      /* демо-тик не критичен */
    }
  }, 4500);
}
