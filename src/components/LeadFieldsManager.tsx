"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

interface Field { id: string; key: string; label: string }

export default function LeadFieldsManager() {
  const [fields, setFields] = useState<Field[]>([]);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await fetch("/api/lead-fields").then((r) => r.json()).catch(() => ({ fields: [] }));
    setFields(d.fields ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/lead-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Ошибка"); return; }
    setLabel("");
    load();
  }
  async function del(f: Field) {
    if (!window.confirm(`Удалить поле «${f.label}»? Значения в лидах останутся.`)) return;
    await fetch(`/api/lead-fields/${f.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="card table-card">
      <div className="tbl-toolbar">
        <b style={{ fontSize: 14 }}>Кастомные поля лида</b>
        <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>напр. «Воронка», «Реклама»</span>
      </div>
      <div style={{ padding: "12px 16px" }}>
        <form onSubmit={add} style={{ display: "flex", gap: 8, marginBottom: fields.length ? 12 : 0 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Название поля (напр. Воронка)"
            style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none" }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}><Plus size={16} /> Добавить</button>
        </form>
        {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>{error}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {fields.map((f) => (
            <div key={f.id} className="chip src" style={{ padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 8 }}>
              {f.label} <span className="muted mono" style={{ fontSize: 11 }}>{f.key}</span>
              <Trash2 size={13} style={{ cursor: "pointer", color: "var(--red)" }} onClick={() => del(f)} />
            </div>
          ))}
          {fields.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Полей нет. Добавьте — они появятся в импорте и форме лида.</span>}
        </div>
      </div>
    </div>
  );
}
