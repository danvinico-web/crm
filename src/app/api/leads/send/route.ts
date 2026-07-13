import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Lead, AuditLog } from "@/models";
import { apiHandler, requireAdmin, HttpError } from "@/lib/rbac";
import { sendLeadsToOffice } from "@/lib/injection";
import { resolveLeadFilter } from "@/lib/bulk";

export const dynamic = "force-dynamic";

const SEND_CAP = 500; // предохранитель для «отправить все по фильтру»

const schema = z.object({
  leadIds: z.array(z.string()).optional(),
  allMatching: z.boolean().optional(),
  filter: z.string().optional(),
  officeId: z.string(),
});

/** Отгрузка лидов в офис — по списку или по всему фильтру (до 500 за раз). */
export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    if (!mongoose.isValidObjectId(parsed.data.officeId)) throw new HttpError(404, "Офис не найден");

    await dbConnect();
    const filter = resolveLeadFilter(parsed.data);
    const leads = await Lead.find(filter).select("_id").limit(SEND_CAP + 1).lean();
    const capped = leads.length > SEND_CAP;
    const ids = leads.slice(0, SEND_CAP).map((l) => String(l._id));
    if (ids.length === 0) throw new HttpError(422, "Нет лидов для отправки");

    const res = await sendLeadsToOffice(ids, parsed.data.officeId);
    if ("error" in res && res.error) throw new HttpError(409, res.error);

    await AuditLog.create({ user: me.id, action: "lead.send", entity: "Office", entityId: parsed.data.officeId, meta: { count: ids.length, sent: res.sent } });
    return { ...res, capped, cap: SEND_CAP };
  });
}
