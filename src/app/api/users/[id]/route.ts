import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { User, AuditLog } from "@/models";
import { apiHandler, requireAdmin, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Удаление пользователя (только админ; себя удалить нельзя). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const admin = await requireAdmin();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Пользователь не найден");
    if (params.id === admin.id) throw new HttpError(400, "Нельзя удалить самого себя");
    await dbConnect();
    const user = await User.findByIdAndDelete(params.id);
    if (!user) throw new HttpError(404, "Пользователь не найден");
    await AuditLog.create({ user: admin.id, action: "user.delete", entity: "User", entityId: params.id, meta: { email: user.email } });
    return { ok: true };
  });
}
