"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

interface Props {
  teams: { id: string; name: string }[];
  curators: { id: string; name: string }[];
}

export default function CreateUserForm({ teams, curators }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN" | "AGENT">("USER");
  const [title, setTitle] = useState("Sales agent");
  const [teamId, setTeamId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setLoading(true);
    const body: Record<string, unknown> = { name, email, password, role };
    if (role === "AGENT") {
      body.title = title;
      if (teamId) body.teamId = teamId;
      if (ownerId) body.ownerId = ownerId;
    }
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка создания");
      return;
    }
    setOk(`${role === "AGENT" ? "Агент" : "Пользователь"} ${data.user.email} создан — вход по email и паролю.`);
    setName("");
    setEmail("");
    setPassword("");
    setRole("USER");
    setTeamId("");
    setOwnerId("");
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
        <UserPlus size={16} /> Создать пользователя
      </button>
    );
  }

  return (
    <div className="card panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h3>Новый пользователь</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Свернуть</button>
      </div>
      <form onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Имя</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Пётр Иванов" required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@leadhub.local" required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Пароль</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="минимум 8 символов" required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Роль аккаунта</label>
            <select value={role} onChange={(e) => setRole(e.target.value as "USER" | "ADMIN" | "AGENT")}>
              <option value="USER">Пользователь</option>
              <option value="ADMIN">Администратор</option>
              <option value="AGENT">Агент</option>
            </select>
          </div>
        </div>

        {role === "AGENT" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 12 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Роль агента</label>
                <select value={title} onChange={(e) => setTitle(e.target.value)}>
                  <option>Sales agent</option><option>Retention</option><option>Team Lead</option>
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Команда</label>
                <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">— без команды —</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Куратор (кто смотрит)</label>
                <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                  <option value="">— не выбран —</option>
                  {curators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Агент появится на вкладке «Агенты» и сможет входить по этому email и паролю.
            </div>
          </>
        )}

        {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginTop: 12 }}>{error}</div>}
        {ok && <div style={{ color: "var(--green)", fontSize: 12.5, fontWeight: 600, marginTop: 12 }}>{ok}</div>}
        <div style={{ marginTop: 14 }}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
            <UserPlus size={16} /> {loading ? "Создаём…" : "Создать"}
          </button>
        </div>
      </form>
    </div>
  );
}
