import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Lead, StatusEvent, AuditLog } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";
import { getStatusKeys } from "@/lib/statuses";
import { leadScopeFilter, withScope } from "@/lib/leadScope";
import { publishLeadStatus } from "@/lib/events";
import { resolveLeadFilter } from "@/lib/bulk";

export const dynamic = "force-dynamic";

const schema = z.object({
  leadIds: z.array(z.string()).optional(),
  allMatching: z.boolean().optional(),
  filter: z.string().optional(),
  status: z.string().min(1),
});

/** Массовая смена статуса — по списку или по всему фильтру. */
export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");

    await dbConnect();
    const { status } = parsed.data;
    const keys = await getStatusKeys();
    if (!keys.has(status)) throw new HttpError(422, "Неизвестный статус");
    const filter = withScope(resolveLeadFilter(parsed.data), await leadScopeFilter(me));

    const leads = await Lead.find(filter).select("_id").lean();
    const ids = leads.map((l) => l._id);
    if (ids.length === 0) return { ok: true, changed: 0 };

    await Lead.updateMany({ _id: { $in: ids } }, { $set: { status } });
    await StatusEvent.insertMany(
      ids.map((id) => ({ lead: id, rawStatus: status, status, source: "MANUAL", note: "Массовая смена статуса" })),
    );
    // Для небольших наборов — real-time пуш по каждому лиду.
    if (ids.length <= 100) {
      for (const id of ids) {
        publishLeadStatus({ type: "lead.status.changed", leadId: String(id), status, rawStatus: status, source: "MANUAL", at: new Date().toISOString() });
      }
    }
    await AuditLog.create({ user: me.id, action: "lead.status", entity: "Lead", meta: { count: ids.length, status } });
    return { ok: true, changed: ids.length };
  });
}
