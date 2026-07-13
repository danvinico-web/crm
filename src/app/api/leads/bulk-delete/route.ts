import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Lead, Delivery, StatusEvent, AuditLog } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";
import { resolveLeadFilter } from "@/lib/bulk";

export const dynamic = "force-dynamic";

const schema = z.object({
  leadIds: z.array(z.string()).optional(),
  allMatching: z.boolean().optional(),
  filter: z.string().optional(),
});

/** Массовое удаление лидов (по списку или по всему фильтру) + связанные доставки/события. */
export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new HttpError(422, "Неверные данные");

    await dbConnect();
    const filter = resolveLeadFilter(parsed.data);
    const ids = await Lead.find(filter).distinct("_id");
    if (ids.length === 0) return { ok: true, deleted: 0 };

    await Promise.all([Delivery.deleteMany({ lead: { $in: ids } }), StatusEvent.deleteMany({ lead: { $in: ids } })]);
    const res = await Lead.deleteMany({ _id: { $in: ids } });
    await AuditLog.create({ user: me.id, action: "lead.bulkDelete", entity: "Lead", meta: { count: res.deletedCount } });
    return { ok: true, deleted: res.deletedCount };
  });
}
