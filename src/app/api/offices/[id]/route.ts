import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Office, Integration, Lead, AuditLog } from "@/models";
import { apiHandler, requireAdmin, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  logoText: z.string().trim().max(3).optional(),
  color: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireAdmin();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Офис не найден");
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, "Неверные данные");
    await dbConnect();
    const office = await Office.findByIdAndUpdate(params.id, { $set: parsed.data }, { new: true });
    if (!office) throw new HttpError(404, "Офис не найден");
    await AuditLog.create({ user: me.id, action: "office.update", entity: "Office", entityId: params.id });
    return { ok: true };
  });
}

/** Удаление офиса: удаляет его интеграции, лиды офиса становятся нераспределёнными. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireAdmin();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Офис не найден");
    await dbConnect();
    const office = await Office.findById(params.id);
    if (!office) throw new HttpError(404, "Офис не найден");
    await Promise.all([
      Integration.deleteMany({ office: office._id }),
      Lead.updateMany({ office: office._id }, { $set: { office: null } }),
    ]);
    await office.deleteOne();
    await AuditLog.create({ user: me.id, action: "office.delete", entity: "Office", entityId: params.id, meta: { name: office.name } });
    return { ok: true };
  });
}
