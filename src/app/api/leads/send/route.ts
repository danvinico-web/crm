import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";
import { sendLeadsToOffice } from "@/lib/injection";

export const dynamic = "force-dynamic";

const schema = z.object({
  leadIds: z.array(z.string()).min(1, "Не выбраны лиды"),
  officeId: z.string(),
});

/** Отгрузка выбранных лидов в офис. */
export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    if (!mongoose.isValidObjectId(parsed.data.officeId)) throw new HttpError(404, "Офис не найден");

    await dbConnect();
    const res = await sendLeadsToOffice(parsed.data.leadIds, parsed.data.officeId);
    if ("error" in res && res.error) throw new HttpError(409, res.error);

    await AuditLog.create({
      user: me.id,
      action: "lead.send",
      entity: "Office",
      entityId: parsed.data.officeId,
      meta: { count: parsed.data.leadIds.length, sent: res.sent },
    });

    return res;
  });
}
