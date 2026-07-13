import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Lead, Agent, AuditLog } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";
import { resolveLeadFilter } from "@/lib/bulk";

export const dynamic = "force-dynamic";

const schema = z.object({
  leadIds: z.array(z.string()).optional(),
  allMatching: z.boolean().optional(),
  filter: z.string().optional(),
  agentId: z.string().nullable(), // null = снять назначение
});

/** Массовое назначение (или снятие) агента — по списку или по всему фильтру. */
export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");

    const { agentId } = parsed.data;
    await dbConnect();

    if (agentId) {
      if (!mongoose.isValidObjectId(agentId)) throw new HttpError(404, "Агент не найден");
      const exists = await Agent.exists({ _id: agentId });
      if (!exists) throw new HttpError(404, "Агент не найден");
    }

    const filter = resolveLeadFilter(parsed.data);
    const res = await Lead.updateMany(filter, { $set: { agent: agentId } });
    await AuditLog.create({ user: me.id, action: "lead.assign", entity: "Lead", meta: { count: res.modifiedCount, agentId } });
    return { ok: true, updated: res.modifiedCount };
  });
}
