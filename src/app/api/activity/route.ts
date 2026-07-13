import { dbConnect } from "@/lib/db";
import { StatusEvent, Lead } from "@/models";
import { apiHandler, requireUser } from "@/lib/rbac";
import { leadScopeFilter } from "@/lib/leadScope";
import { decryptNullable } from "@/lib/crypto";
import { LEAD_STATUS_LABEL, type LeadStatus, type EventSource } from "@/lib/enums";

export const dynamic = "force-dynamic";

const SRC_LABEL: Record<EventSource, string> = { CALLBACK: "callback", POLL: "поллинг", MANUAL: "вручную", SYSTEM: "система" };

/** Лента последних событий статусов (для колокольчика). */
export async function GET() {
  return apiHandler(async () => {
    const me = await requireUser();
    await dbConnect();
    // Скоуп по роли: агент/пользователь видит события только своих лидов.
    const scope = await leadScopeFilter(me);
    let eventFilter: Record<string, unknown> = {};
    if (Object.keys(scope).length) {
      const scoped = await Lead.find(scope).select("_id").lean();
      eventFilter = { lead: { $in: scoped.map((l) => l._id) } };
    }
    const events = await StatusEvent.find(eventFilter).sort({ createdAt: -1 }).limit(12).lean();
    const leadIds = [...new Set(events.map((e) => String(e.lead)))];
    const leads = await Lead.find({ _id: { $in: leadIds } }).select("fullNameEnc").lean();
    const name = new Map(leads.map((l) => [String(l._id), decryptNullable(l.fullNameEnc) ?? "—"]));
    return {
      items: events.map((e) => ({
        id: String(e._id),
        leadId: String(e.lead),
        leadName: name.get(String(e.lead)) ?? "—",
        status: e.status as LeadStatus,
        statusLabel: LEAD_STATUS_LABEL[e.status as LeadStatus],
        source: SRC_LABEL[e.source as EventSource],
        at: e.createdAt,
      })),
    };
  });
}
