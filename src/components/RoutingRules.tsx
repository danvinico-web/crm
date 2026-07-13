"use client";

import { useEffect, useState } from "react";
import { Plus, X, Pencil, Trash2 } from "lucide-react";

interface Conditions { affiliateTags: string[]; geos: string[]; balanceZero: boolean }
interface Rule { id: string; name: string; priority: number; enabled: boolean; officeId: string; officeName: string; conditions: Conditions }
interface Office { id: string; name: string }
interface FormState { id?: string; name: string; officeId: string; priority: number; enabled: boolean; affiliateTags: string; geos: string; balanceZero: boolean }

function condText(c: Conditions) {
  const parts: React.ReactNode[] = [];
  if (c.affiliateTags.length) parts.push(<span key="a">метка ∈ <b>{c.affiliateTags.join(", ")}</b></span>);
  if (c.geos.length) parts.push(<span key="g">гео ∈ <b>{c.geos.join(", ")}</b></span>);
  if (c.balanceZero) parts.push(<span key="b"><b>баланс = 0</b></span>);
  if (parts.length === 0) return <>любой лид</>;
  return <>{parts.map((p, i) => <span key={i}>{i > 0 ? " и " : ""}{p}</span>)}</>;
}

export default function RoutingRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const d = await fetch("/api/routing-rules").then((r) => r.json()).catch(() => ({ rules: [], offices: [] }));
    setRules(d.rules ?? []);
    setOffices(d.offices ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggle(r: Rule) {
    await fetch(`/api/routing-rules/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !r.enabled }) });
    load();
  }
  async function del(r: Rule) {
    if (!window.confirm(`Удалить правило «${r.name}»?`)) return;
    await fetch(`/api/routing-rules/${r.id}`, { method: "DELETE" });
    load();
  }
  function openNew() {
    setError(null);
    setForm({ name: "", officeId: offices[0]?.id ?? "", priority: (rules.length + 1) * 1, enabled: false, affiliateTags: "", geos: "", balanceZero: false });
  }
  function openEdit(r: Rule) {
    setError(null);
    setForm({ id: r.id, name: r.name, officeId: r.officeId, priority: r.priority, enabled: r.enabled, affiliateTags: r.conditions.affiliateTags.join(", "), geos: r.conditions.geos.join(", "), balanceZero: r.conditions.balanceZero });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    const payload = {
      name: form.name,
      officeId: form.officeId,
      priority: Number(form.priority) || 100,
      enabled: form.enabled,
      conditions: {
        affiliateTags: form.affiliateTags.split(",").map((s) => s.trim()).filter(Boolean),
        geos: form.geos.split(",").map((s) => s.trim()).filter(Boolean),
        balanceZero: form.balanceZero,
      },
    };
    const res = await fetch(form.id ? `/api/routing-rules/${form.id}` : "/api/routing-rules", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Ошибка сохранения"); return; }
    setForm(null);
    load();
  }

  return (
    <>
      <div className="card">
        <div className="tbl-toolbar">
          <b style={{ fontSize: 14 }}>Правила распределения (авто-роутинг)</b>
          <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={openNew}><Plus size={16} /> Новое правило</button>
        </div>
        {loading && <div className="muted" style={{ padding: 16 }}>Загрузка…</div>}
        {!loading && rules.length === 0 && <div className="muted" style={{ padding: 16, fontSize: 13 }}>Правил нет. Создайте первое — новые лиды будут авто-отгружаться в офис при совпадении условий.</div>}
        {rules.map((r) => (
          <div className="rule" key={r.id}>
            <div className="prio">{r.priority}</div>
            <div className="cond">Если {condText(r.conditions)} <span className="arrow">→</span> <b>{r.officeName}</b></div>
            <button className="mini" title="Редактировать" onClick={() => openEdit(r)}><Pencil size={14} /></button>
            <button className="mini" title="Удалить" style={{ color: "var(--red)" }} onClick={() => del(r)}><Trash2 size={14} /></button>
            <button className={`switch${r.enabled ? "" : " off"}`} title="Вкл/выкл" onClick={() => toggle(r)} />
          </div>
        ))}
      </div>

      <div className="card panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h3>Postback от офисов</h3><span className="conn ok">● Приём включён</span></div>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Офисы возвращают события <b style={{ color: "var(--text)" }}>FTD / депозит / статус</b> на callback-endpoint. Статус лида обновляется автоматически (см. вкладку «Логи» и карточку лида).
        </p>
        <div className="map-col" style={{ marginTop: 12, fontFamily: "monospace", fontSize: 12 }}>
          <span>POST&nbsp; /api/status/{"{integrationId}"}</span><span className="chip src">JSON + HMAC</span>
        </div>
      </div>

      {form && (
        <div className="overlay show" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-head"><h3>{form.id ? "Редактировать правило" : "Новое правило"}</h3><div className="mini" onClick={() => setForm(null)}><X size={16} /></div></div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div className="field"><label>Название</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Karl DE/AT → Alpha" required /></div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                  <div className="field"><label>Офис назначения</label>
                    <select value={form.officeId} onChange={(e) => setForm({ ...form, officeId: e.target.value })} required>
                      {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Приоритет</label><input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
                </div>
                <div className="section-title" style={{ margin: "6px 0 12px" }}>Условия (пусто = не учитывать)</div>
                <div className="field"><label>Метки аффилиата (через запятую)</label><input value={form.affiliateTags} onChange={(e) => setForm({ ...form, affiliateTags: e.target.value })} placeholder="aff_karl, fb_pro" /></div>
                <div className="field"><label>Гео (ISO-2, через запятую)</label><input value={form.geos} onChange={(e) => setForm({ ...form, geos: e.target.value })} placeholder="DE, AT" /></div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginBottom: 12 }}>
                  <input type="checkbox" checked={form.balanceZero} onChange={(e) => setForm({ ...form, balanceZero: e.target.checked })} style={{ width: 16, height: 16 }} /> Только баланс = 0
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} style={{ width: 16, height: 16 }} /> Включено (авто-отгрузка новых лидов)
                </label>
                {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{error}</div>}
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Отмена</button>
                <button type="submit" className="btn btn-primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
