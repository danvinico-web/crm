"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function CreateTeamForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка создания");
      return;
    }
    setName("");
    setCode("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
        <Plus size={16} /> Создать команду
      </button>
    );
  }

  return (
    <div className="card panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h3>Новая команда</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Свернуть</button>
      </div>
      <form onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Название</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Команда Альфа" required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Код</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="alpha" required />
          </div>
        </div>
        {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginTop: 12 }}>{error}</div>}
        <div style={{ marginTop: 14 }}>
          <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
            <Plus size={16} /> {loading ? "Создаём…" : "Создать команду"}
          </button>
        </div>
      </form>
    </div>
  );
}
