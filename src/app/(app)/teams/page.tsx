import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/rbac";
import { dbConnect } from "@/lib/db";
import { Team, Agent, User } from "@/models";
import CreateTeamForm from "@/components/CreateTeamForm";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  await dbConnect();
  const filter = me.role === "ADMIN" ? {} : { owner: me.id };
  const teams = await Team.find(filter).sort({ createdAt: -1 }).lean();

  const ownerIds = [...new Set(teams.map((t) => String(t.owner)))];
  const owners = await User.find({ _id: { $in: ownerIds } }).lean();
  const ownerName = new Map(owners.map((o) => [String(o._id), o.name]));

  const counts = await Agent.aggregate<{ _id: unknown; n: number }>([
    { $match: { team: { $ne: null } } },
    { $group: { _id: "$team", n: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));

  return (
    <>
      <div className="section-head">
        <h2>Команды · {teams.length}</h2>
      </div>

      <div style={{ marginBottom: 16 }}>
        <CreateTeamForm />
      </div>

      <div className="card table-card">
        <div className="tbl-toolbar">
          <b style={{ fontSize: 14 }}>Ваши команды</b>
          <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>
            {me.role === "ADMIN" ? "Показаны все команды" : "Показаны команды, где вы владелец"}
          </span>
        </div>
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr>
                <th>Команда</th>
                <th>Код</th>
                <th>Владелец</th>
                <th>Агентов</th>
                <th>Создана</th>
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: "center", padding: 28 }}>
                    Команд пока нет. Создайте первую.
                  </td>
                </tr>
              )}
              {teams.map((t) => (
                <tr key={String(t._id)}>
                  <td><b>{t.name}</b></td>
                  <td><span className="chip src">{t.code}</span></td>
                  <td className="muted">{ownerName.get(String(t.owner)) ?? "—"}</td>
                  <td className="mono">{countMap.get(String(t._id)) ?? 0}</td>
                  <td className="mono muted">{new Date(t.createdAt).toLocaleDateString("ru-RU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
