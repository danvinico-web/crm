import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { RoutingRule, AuditLog } from "@/models";
import { apiHandler, requireAdmin, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  officeId: z.string().optional(),
  priority: z.number().int().optional(),
  enabled: z.boolean().optional(),
  conditions: z
    .object({
      affiliateTags: z.array(z.string()),
      geos: z.array(z.string()),
      balanceZero: z.boolean(),
    })
    .optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireAdmin();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Правило не найдено");
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, "Неверные данные");
    await dbConnect();
    const rule = await RoutingRule.findById(params.id);
    if (!rule) throw new HttpError(404, "Правило не найдено");
    const d = parsed.data;
    if (d.name !== undefined) rule.name = d.name;
    if (d.officeId && mongoose.isValidObjectId(d.officeId)) rule.office = new mongoose.Types.ObjectId(d.officeId);
    if (d.priority !== undefined) rule.priority = d.priority;
    if (d.enabled !== undefined) rule.enabled = d.enabled;
    if (d.conditions) rule.conditions = { ...d.conditions, geos: d.conditions.geos.map((g) => g.toUpperCase()) };
    await rule.save();
    await AuditLog.create({ user: me.id, action: "rule.update", entity: "RoutingRule", entityId: params.id });
    return { ok: true };
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireAdmin();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Правило не найдено");
    await dbConnect();
    const rule = await RoutingRule.findByIdAndDelete(params.id);
    if (!rule) throw new HttpError(404, "Правило не найдено");
    await AuditLog.create({ user: me.id, action: "rule.delete", entity: "RoutingRule", entityId: params.id });
    return { ok: true };
  });
}
