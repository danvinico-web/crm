import { Sliders, ShieldCheck, GitBranch } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { Integration, AuditLog, User } from "@/models";
import { getSessionUser } from "@/lib/rbac";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/enums";
import LeadFieldsManager from "@/components/LeadFieldsManager";

export const dynamic = "force-dynamic";

const LEAD_FIELDS = ["Имя", "Email", "Телефон", "Гео", "Метка аффилиата", "Баланс", "Комментарий", "Статус", "Внешний ID"];

export default async function SettingsPage() {
  const me = await getSessionUser();
  const isAdmin = me?.role === "ADMIN";

  await dbConnect();
  const integration = await Integration.findOne({ statusMappings: { $ne: [] } }).lean();
  const auditRaw = isAdmin ? await AuditLog.find().sort({ createdAt: -1 }).limit(15).lean() : [];
  const userIds = [...new Set(auditRaw.map((a) => String(a.user)))];
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select("name").lean() : [];
  const userName = new Map(users.map((u) => [String(u._id), u.name]));

  return (
    <>
      <div className="section-head"><h2>Настройки</h2></div>

      <div className="mini-grid" style={{ marginBottom: 16 }}>
        <div className="card ov-card">
          <div className="ic i-blue"><Sliders size={20} /></div>
          <h4>Поля лида</h4>
          <p>{LEAD_FIELDS.join(" · ")}</p>
        </div>
        <div className="card ov-card">
          <div className="ic i-amber"><GitBranch size={20} /></div>
          <h4>Дедуп и валидация</h4>
          <p>Окно дедупа: <b>30 дней</b> (по телефону/email). Телефон → E.164, email → lowercase. Идемпотентность приёма: источник + контакт + сутки. Лог согласия по лиду.</p>
        </div>
        <div className="card ov-card">
          <div className="ic i-purple"><ShieldCheck size={20} /></div>
          <h4>Роли и доступы</h4>
          <p><b>ADMIN</b> — создаёт пользователей, видит всё, управляет ключами. <b>USER</b> — создаёт команды/агентов, работает с лидами и отгрузкой.</p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <LeadFieldsManager />
      </div>

      <div className="grid-2b">
        <div className="card table-card">
          <div className="tbl-toolbar"><b style={{ fontSize: 14 }}>Статус-маппинг</b><span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>внешний → внутренний</span></div>
          <div className="tbl-scroll">
            <table>
              <thead><tr><th>Внешний статус (CRM)</th><th>Внутренний</th></tr></thead>
              <tbody>
                {(integration?.statusMappings ?? []).map((m, i) => (
                  <tr key={i}>
                    <td className="mono muted">{m.externalValue}</td>
                    <td>{LEAD_STATUS_LABEL[m.internalValue as LeadStatus]}</td>
                  </tr>
                ))}
                {(!integration || integration.statusMappings.length === 0) && (
                  <tr><td colSpan={2} className="muted" style={{ textAlign: "center", padding: 20 }}>Маппинги не заданы.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card table-card">
          <div className="tbl-toolbar"><b style={{ fontSize: 14 }}>Аудит-лог</b><span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>{isAdmin ? "последние действия" : "только для админа"}</span></div>
          <div className="tbl-scroll">
            <table>
              <thead><tr><th>Действие</th><th>Кто</th><th>Когда</th></tr></thead>
              <tbody>
                {!isAdmin && <tr><td colSpan={3} className="muted" style={{ textAlign: "center", padding: 20 }}>Доступно администратору.</td></tr>}
                {isAdmin && auditRaw.length === 0 && <tr><td colSpan={3} className="muted" style={{ textAlign: "center", padding: 20 }}>Записей нет.</td></tr>}
                {isAdmin && auditRaw.map((a) => (
                  <tr key={String(a._id)}>
                    <td><span className="chip src">{a.action}</span></td>
                    <td className="muted">{userName.get(String(a.user)) ?? "—"}</td>
                    <td className="mono muted">{new Date(a.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
