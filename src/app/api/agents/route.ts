import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Agent, AuditLog } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const GRADIENTS = ["#4f7cff,#6a5cff", "#f5a524,#f5455c", "#25c281,#1fa86e", "#9b6dff,#6a5cff", "#4f7cff,#25c281", "#f5455c,#9b6dff"];

const createSchema = z.object({
  name: z.string().trim().min(2, "Имя слишком короткое"),
  title: z.string().trim().default("Sales agent"),
  teamId: z.string().optional().nullable(),
  isOnline: z.boolean().optional(),
  capacity: z.number().int().min(1).max(1000).default(12),
});

export async function GET() {
  return apiHandler(async () => {
    await requireUser();
    await dbConnect();
    const agents = await Agent.find().sort({ createdAt: 1 }).lean();
    return { agents: agents.map((a) => ({ id: String(a._id), name: a.name, title: a.title, isOnline: a.isOnline, team: a.team ? String(a.team) : null })) };
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireUser();
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    await dbConnect();
    const team = parsed.data.teamId && mongoose.isValidObjectId(parsed.data.teamId) ? parsed.data.teamId : null;
    const agent = await Agent.create({
      name: parsed.data.name,
      title: parsed.data.title,
      isOnline: parsed.data.isOnline ?? false,
      capacity: parsed.data.capacity,
      team,
      owner: me.id,
      color: GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)],
    });
    await AuditLog.create({ user: me.id, action: "agent.create", entity: "Agent", entityId: String(agent._id) });
    return { agent: { id: String(agent._id), name: agent.name, title: agent.title } };
  });
}
