"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export default function AgentCreate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Sales agent");
  const [isOnline, setIsOnline] = useState(true);
  const [capacity, setCapacity] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, title, isOnline, capacity: Number(capacity) || 12 }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Ошибка");
      return;
    }
    setOpen(false);
    setName("");
    router.refresh();
  }

  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={16} /> Добавить агента</button>
      {open && (
        <div className="overlay show" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-head"><h3>Новый агент</h3><div className="mini" onClick={() => setOpen(false)}><X size={16} /></div></div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div className="field"><label>Имя</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Пётр Иванов" required /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field"><label>Роль</label>
                    <select value={title} onChange={(e) => setTitle(e.target.value)}>
                      <option>Sales agent</option><option>Retention</option><option>Team Lead</option>
                    </select>
                  </div>
                  <div className="field"><label>Ёмкость (лидов)</label><input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} /></div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} style={{ width: 16, height: 16 }} /> Онлайн
                </label>
                {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{error}</div>}
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Создаём…" : "Создать"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
