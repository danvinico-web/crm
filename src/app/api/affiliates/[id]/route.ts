import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Affiliate, AuditLog } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  tag: z.string().trim().min(2).regex(/^[a-z0-9_-]+$/i, "Метка: латиница, цифры, - и _").optional(),
  platform: z.string().trim().optional(),
  status: z.enum(["active", "review", "paused"]).optional(),
  cpa: z.number().min(0).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireUser();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Аффилиат не найден");
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    await dbConnect();
    const aff = await Affiliate.findById(params.id);
    if (!aff) throw new HttpError(404, "Аффилиат не найден");
    if (parsed.data.tag && parsed.data.tag !== aff.tag) {
      const dup = await Affiliate.findOne({ tag: parsed.data.tag });
      if (dup) throw new HttpError(409, "Метка уже занята");
      aff.tag = parsed.data.tag;
    }
    if (parsed.data.name !== undefined) aff.name = parsed.data.name;
    if (parsed.data.platform !== undefined) aff.platform = parsed.data.platform;
    if (parsed.data.status !== undefined) aff.status = parsed.data.status;
    if (parsed.data.cpa !== undefined) aff.cpa = parsed.data.cpa;
    await aff.save();
    await AuditLog.create({ user: me.id, action: "affiliate.update", entity: "Affiliate", entityId: params.id });
    return { ok: true };
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireUser();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Аффилиат не найден");
    await dbConnect();
    const aff = await Affiliate.findByIdAndDelete(params.id);
    if (!aff) throw new HttpError(404, "Аффилиат не найден");
    await AuditLog.create({ user: me.id, action: "affiliate.delete", entity: "Affiliate", entityId: params.id });
    return { ok: true };
  });
}
