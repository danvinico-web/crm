import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Team, Agent, AuditLog } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(2, "Название слишком короткое"),
  code: z
    .string()
    .trim()
    .min(2, "Код слишком короткий")
    .regex(/^[a-z0-9_-]+$/i, "Код: латиница, цифры, - и _"),
});

/** Список команд. Админ видит все, пользователь — только свои. */
export async function GET() {
  return apiHandler(async () => {
    const me = await requireUser();
    await dbConnect();
    const filter = me.role === "ADMIN" ? {} : { owner: me.id };
    const teams = await Team.find(filter).sort({ createdAt: -1 }).lean();
    const counts = await Agent.aggregate<{ _id: unknown; n: number }>([
      { $match: { team: { $ne: null } } },
      { $group: { _id: "$team", n: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
    return {
      teams: teams.map((t) => ({
        id: String(t._id),
        name: t.name,
        code: t.code,
        owner: String(t.owner),
        agents: countMap.get(String(t._id)) ?? 0,
        createdAt: t.createdAt,
      })),
    };
  });
}

/** Создание команды. Доступно любому авторизованному пользователю (владельцем станет он). */
export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    }
    await dbConnect();

    const dup = await Team.findOne({ owner: me.id, code: parsed.data.code });
    if (dup) throw new HttpError(409, "У вас уже есть команда с таким кодом");

    const team = await Team.create({
      name: parsed.data.name,
      code: parsed.data.code.toLowerCase(),
      owner: me.id,
    });

    await AuditLog.create({
      user: me.id,
      action: "team.create",
      entity: "Team",
      entityId: String(team._id),
      meta: { name: team.name, code: team.code },
    });

    return { team: { id: String(team._id), name: team.name, code: team.code, agents: 0 } };
  });
}
