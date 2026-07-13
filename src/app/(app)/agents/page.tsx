import { dbConnect } from "@/lib/db";
import { Agent, Lead } from "@/models";
import { initials } from "@/lib/format";
import AgentCreate from "@/components/AgentCreate";
import { DeleteButton } from "@/components/RowActions";

export const dynamic = "force-dynamic";

interface AgentStat {
  id: string;
  name: string;
  title: string;
  isOnline: boolean;
  color: string;
  assigned: number;
  inWork: number;
  deposits: number;
  conversion: number;
  capacity: number;
  load: number;
}

function loadColor(v: number) {
  return v >= 80 ? "var(--red)" : v >= 65 ? "var(--amber)" : "var(--green)";
}

export default async function AgentsPage() {
  await dbConnect();
  const agents = await Agent.find().sort({ createdAt: 1 }).lean();
  const stats = await Lead.aggregate<{ _id: unknown; assigned: number; inWork: number; deposits: number }>([
    { $match: { agent: { $ne: null } } },
    {
      $group: {
        _id: "$agent",
        assigned: { $sum: 1 },
        inWork: { $sum: { $cond: [{ $in: ["$status", ["CALLBACK", "NO_ANSWER", "IN_PROGRESS", "SENT"]] }, 1, 0] } },
        deposits: { $sum: { $cond: [{ $eq: ["$status", "DEPOSIT"] }, 1, 0] } },
      },
    },
  ]);
  const statMap = new Map(stats.map((s) => [String(s._id), s]));

  const rows: AgentStat[] = agents.map((a) => {
    const st = statMap.get(String(a._id));
    const assigned = st?.assigned ?? 0;
    const deposits = st?.deposits ?? 0;
    const capacity = a.capacity ?? 12;
    return {
      id: String(a._id),
      name: a.name,
      title: a.title,
      isOnline: a.isOnline,
      color: a.color,
      assigned,
      inWork: st?.inWork ?? 0,
      deposits,
      conversion: assigned ? Math.round((deposits / assigned) * 1000) / 10 : 0,
      capacity,
      // Нагрузка = сколько лидов ведёт агент относительно его ёмкости (capacity).
      load: Math.min(100, Math.round((assigned / capacity) * 100)),
    };
  });
  const online = rows.filter((r) => r.isOnline).length;

  return (
    <>
      <div className="section-head">
        <h2>Команда · {rows.length} агентов, {online} онлайн</h2>
        <AgentCreate />
      </div>

      <div className="agent-grid">
        {rows.map((a) => (
          <div className="card agent-card" key={a.id}>
            <div className="agent-top">
              <div className="av" style={{ background: `linear-gradient(135deg,${a.color})` }}>
                {initials(a.name)}
                <span className={`status-dot ${a.isOnline ? "on-dot" : "off-dot"}`} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="nm">{a.name}</div>
                <div className="rl">{a.title} · {a.isOnline ? "онлайн" : "офлайн"}</div>
              </div>
            </div>
            <div className="agent-stats">
              <div className="s"><div className="v">{a.assigned}</div><div className="k">назначено</div></div>
              <div className="s"><div className="v">{a.inWork}</div><div className="k">в работе</div></div>
              <div className="s"><div className="v" style={{ color: "var(--green)" }}>{a.conversion}%</div><div className="k">конв.</div></div>
            </div>
            <div className="load-lbl"><span>Нагрузка · {a.assigned}/{a.capacity} лидов</span><span style={{ fontWeight: 700, color: loadColor(a.load) }}>{a.load}%</span></div>
            <div className="load"><span style={{ width: `${a.load}%`, background: loadColor(a.load) }} /></div>
          </div>
        ))}
      </div>

      <div className="card table-card">
        <div className="tbl-toolbar">
          <b style={{ fontSize: 14 }}>Нагрузка и KPI</b>
          <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>Данные из БД</span>
        </div>
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr><th>Агент</th><th>Роль</th><th>Статус</th><th>Назначено</th><th>В работе</th><th>Конверсия</th><th>Депозиты</th><th>Нагрузка</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><div className="cust"><div className="av-sm" style={{ background: `linear-gradient(135deg,${a.color})` }}>{initials(a.name)}</div><div className="nm">{a.name}</div></div></td>
                  <td><span className="chip src">{a.title}</span></td>
                  <td><span className={`badge ${a.isOnline ? "b-dep" : "b-off"}`}>{a.isOnline ? "Онлайн" : "Офлайн"}</span></td>
                  <td className="mono">{a.assigned}</td>
                  <td className="mono">{a.inWork}</td>
                  <td><span className={`badge ${a.conversion >= 25 ? "b-dep" : a.conversion >= 15 ? "b-work" : "b-rej"}`}>{a.conversion}%</span></td>
                  <td className="mono">{a.deposits}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="load" style={{ width: 80 }}><span style={{ width: `${a.load}%`, background: loadColor(a.load) }} /></div>
                      <span className="muted" style={{ fontSize: 12 }}>{a.load}% · {a.assigned}/{a.capacity}</span>
                    </div>
                  </td>
                  <td>
                    <div className="row-act" style={{ opacity: 1 }}>
                      <DeleteButton endpoint={`/api/agents/${a.id}`} confirmText={`Удалить агента ${a.name}? Его лиды станут нераспределёнными.`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
