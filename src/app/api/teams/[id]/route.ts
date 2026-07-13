import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Team, Agent, AuditLog } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Удаление команды (владелец или админ). Агенты команды остаются без команды. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireUser();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Команда не найдена");
    await dbConnect();
    const team = await Team.findById(params.id);
    if (!team) throw new HttpError(404, "Команда не найдена");
    if (me.role !== "ADMIN" && String(team.owner) !== me.id) throw new HttpError(403, "Нет доступа к этой команде");
    await Agent.updateMany({ team: team._id }, { $set: { team: null } });
    await team.deleteOne();
    await AuditLog.create({ user: me.id, action: "team.delete", entity: "Team", entityId: params.id });
    return { ok: true };
  });
}
