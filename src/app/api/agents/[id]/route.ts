import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Agent, Lead, AuditLog } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  title: z.string().trim().optional(),
  isOnline: z.boolean().optional(),
  teamId: z.string().nullable().optional(),
  capacity: z.number().int().min(1).max(1000).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireUser();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Агент не найден");
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, "Неверные данные");
    await dbConnect();
    const agent = await Agent.findById(params.id);
    if (!agent) throw new HttpError(404, "Агент не найден");
    const d = parsed.data;
    if (d.name !== undefined) agent.name = d.name;
    if (d.title !== undefined) agent.title = d.title;
    if (d.isOnline !== undefined) agent.isOnline = d.isOnline;
    if (d.capacity !== undefined) agent.capacity = d.capacity;
    if (d.teamId !== undefined) agent.team = d.teamId && mongoose.isValidObjectId(d.teamId) ? (d.teamId as unknown as typeof agent.team) : null;
    await agent.save();
    await AuditLog.create({ user: me.id, action: "agent.update", entity: "Agent", entityId: params.id });
    return { ok: true };
  });
}

/** Удаление агента: его лиды становятся неназначенными. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireUser();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Агент не найден");
    await dbConnect();
    const agent = await Agent.findById(params.id);
    if (!agent) throw new HttpError(404, "Агент не найден");
    await Lead.updateMany({ agent: agent._id }, { $set: { agent: null } });
    await agent.deleteOne();
    await AuditLog.create({ user: me.id, action: "agent.delete", entity: "Agent", entityId: params.id });
    return { ok: true };
  });
}
