"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Lock, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { STATUS_BADGE_OPTIONS, type StatusDef } from "@/lib/enums";

/** Управление статусами лида: добавить, переименовать, цвет, скрыть, удалить. */
export default function StatusManager({ initial }: { initial: StatusDef[] }) {
  const router = useRouter();
  const [items, setItems] = useState<StatusDef[]>(initial);
  const [newLabel, setNewLabel] = useState("");
  const [newBadge, setNewBadge] = useState("b-new");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setLocal(key: string, patch: Partial<StatusDef>) {
    setItems((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  async function patch(key: string, body: Partial<StatusDef>) {
    setError(null);
    const res = await fetch(`/api/lead-statuses/${key}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Ошибка сохранения"); router.refresh(); }
    else router.refresh();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setBusy(true); setError(null);
    const res = await fetch("/api/lead-statuses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: newLabel, badge: newBadge }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error ?? "Ошибка"); return; }
    setItems((list) => [...list, d.status]);
    setNewLabel("");
    router.refresh();
  }

  async function del(s: StatusDef) {
    if (!window.confirm(`Удалить статус «${s.label}»?`)) return;
    setError(null);
    const res = await fetch(`/api/lead-statuses/${s.key}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Не удалось удалить"); return; }
    setItems((list) => list.filter((x) => x.key !== s.key));
    router.refresh();
  }

  async function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const a = items[idx], b = items[j];
    setItems((list) => { const n = [...list]; [n[idx], n[j]] = [n[j], n[idx]]; return n; });
    await Promise.all([patch(a.key, { order: b.order }), patch(b.key, { order: a.order })]);
  }

  return (
    <div className="card table-card">
      <div className="tbl-toolbar">
        <b style={{ fontSize: 14 }}>Статусы лида</b>
        <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>переименовать · цвет · скрыть · добавить свои</span>
      </div>

      <div style={{ padding: "12px 16px" }}>
        <form onSubmit={add} style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Новый статус (напр. «Горячий»)"
            style={{ flex: 1, minWidth: 180, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none" }} />
          <select value={newBadge} onChange={(e) => setNewBadge(e.target.value)}
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none" }}>
            {STATUS_BADGE_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <span className={`badge ${newBadge}`}>{newLabel.trim() || "Превью"}</span>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}><Plus size={16} /> Добавить</button>
        </form>
        {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((s, i) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 10px", background: "var(--surface-2)", borderRadius: 10, opacity: s.active ? 1 : 0.55 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <ChevronUp size={14} style={{ cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 0.8 }} onClick={() => move(i, -1)} />
                <ChevronDown size={14} style={{ cursor: i === items.length - 1 ? "default" : "pointer", opacity: i === items.length - 1 ? 0.3 : 0.8 }} onClick={() => move(i, 1)} />
              </div>
              <span className={`badge ${s.badge}`} style={{ minWidth: 90, justifyContent: "center" }}>{s.label || "—"}</span>
              <input
                value={s.label}
                onChange={(e) => setLocal(s.key, { label: e.target.value })}
                onBlur={() => patch(s.key, { label: s.label })}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                style={{ width: 150, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px", color: "var(--text)", fontSize: 13, outline: "none" }}
              />
              <select value={s.badge} onChange={(e) => { setLocal(s.key, { badge: e.target.value }); patch(s.key, { badge: e.target.value }); }}
                style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px", color: "var(--text)", fontSize: 12.5, outline: "none" }}>
                {STATUS_BADGE_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-dim)", cursor: "pointer" }}>
                <input type="checkbox" checked={s.isTerminal} onChange={(e) => { setLocal(s.key, { isTerminal: e.target.checked }); patch(s.key, { isTerminal: e.target.checked }); }} />
                терминальный
              </label>
              <button type="button" className="btn btn-ghost btn-sm" title={s.active ? "Скрыть из фильтров" : "Показывать"} onClick={() => { setLocal(s.key, { active: !s.active }); patch(s.key, { active: !s.active }); }}>
                {s.active ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
                {s.isSystem
                  ? <span title="Встроенный статус — можно переименовать/скрыть, но не удалить"><Lock size={14} style={{ color: "var(--text-mute)" }} /></span>
                  : <Trash2 size={15} style={{ cursor: "pointer", color: "var(--red)" }} onClick={() => del(s)} />}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
