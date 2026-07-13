import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Lead, Delivery, StatusEvent, AuditLog } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";
import { leadScopeFilter, withScope } from "@/lib/leadScope";

export const dynamic = "force-dynamic";

/** Удаление лида вместе с его отгрузками и историей статусов. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireUser();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Лид не найден");
    await dbConnect();
    const lead = await Lead.findOne(withScope({ _id: params.id }, await leadScopeFilter(me)));
    if (!lead) throw new HttpError(404, "Лид не найден");
    await Promise.all([Delivery.deleteMany({ lead: lead._id }), StatusEvent.deleteMany({ lead: lead._id })]);
    await lead.deleteOne();
    await AuditLog.create({ user: me.id, action: "lead.delete", entity: "Lead", entityId: params.id });
    return { ok: true };
  });
}
