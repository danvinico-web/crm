"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

export default function CreateUserForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setLoading(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка создания");
      return;
    }
    setOk(`Пользователь ${data.user.email} создан.`);
    setName("");
    setEmail("");
    setPassword("");
    setRole("USER");
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
            <label>Роль</label>
            <select value={role} onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}>
              <option value="USER">Пользователь</option>
              <option value="ADMIN">Администратор</option>
            </select>
          </div>
        </div>
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
