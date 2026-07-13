import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/rbac";
import { dbConnect } from "@/lib/db";
import { User } from "@/models";
import { ROLE_LABELS } from "@/lib/roles";
import CreateUserForm from "@/components/CreateUserForm";
import { DeleteButton } from "@/components/RowActions";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

export default async function UsersPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role !== "ADMIN") redirect("/dashboard");

  await dbConnect();
  const users = await User.find().sort({ createdAt: -1 }).lean();

  return (
    <>
      <div className="section-head">
        <h2>Пользователи · {users.length}</h2>
      </div>

      <div style={{ marginBottom: 16 }}>
        <CreateUserForm />
      </div>

      <div className="card table-card">
        <div className="tbl-toolbar">
          <b style={{ fontSize: 14 }}>Аккаунты</b>
          <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>
            Админ создаёт пользователей · пользователи создают команды
          </span>
        </div>
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Создан</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={String(u._id)}>
                  <td>
                    <div className="cust">
                      <div className="av-sm" style={{ background: u.role === "ADMIN" ? "linear-gradient(135deg,#4f7cff,#6a5cff)" : "linear-gradient(135deg,#f5a524,#f5455c)" }}>
                        {initials(u.name)}
                      </div>
                      <div>
                        <div className="nm">{u.name}</div>
                        <div className="em">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${u.role === "ADMIN" ? "b-new" : "b-sent"}`}>{ROLE_LABELS[u.role]}</span>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? "b-dep" : "b-off"}`}>{u.isActive ? "Активен" : "Отключён"}</span>
                  </td>
                  <td className="mono muted">{new Date(u.createdAt).toLocaleDateString("ru-RU")}</td>
                  <td>
                    <div className="row-act" style={{ opacity: 1 }}>
                      {String(u._id) !== me.id && (
                        <DeleteButton endpoint={`/api/users/${String(u._id)}`} confirmText={`Удалить пользователя ${u.email}?`} />
                      )}
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
