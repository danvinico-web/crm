import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { LeadField, AuditLog } from "@/models";
import { apiHandler, requireAdmin, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Удаление определения кастомного поля (значения в лидах остаются). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireAdmin();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Поле не найдено");
    await dbConnect();
    const field = await LeadField.findByIdAndDelete(params.id);
    if (!field) throw new HttpError(404, "Поле не найдено");
    await AuditLog.create({ user: me.id, action: "leadField.delete", entity: "LeadField", entityId: params.id });
    return { ok: true };
  });
}
