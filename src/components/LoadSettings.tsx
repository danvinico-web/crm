"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gauge, Check } from "lucide-react";
import type { StatusDef } from "@/lib/enums";

interface Props {
  initialStatuses: string[];
  initialCapacity: number;
  statusDefs: StatusDef[];
}

/** Настройка расчёта нагрузки агентов: какие статусы «в работе» + ёмкость. */
export default function LoadSettings({ initialStatuses, initialCapacity, statusDefs }: Props) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Set<string>>(new Set(initialStatuses));
  const [capacity, setCapacity] = useState(initialCapacity);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(s: string) {
    setSaved(false);
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  async function save() {
    setError(null);
    if (statuses.size === 0) { setError("Выберите хотя бы один статус"); return; }
    if (capacity < 1) { setError("Ёмкость должна быть ≥ 1"); return; }
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loadStatuses: [...statuses], loadCapacity: capacity }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Ошибка сохранения");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card panel">
      <div className="panel-head">
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Gauge size={17} /> Расчёт нагрузки агентов</h3>
        <span className="muted" style={{ fontSize: 12.5 }}>нагрузка = лиды в выбранных статусах ÷ ёмкость</span>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label>Статусы, считающиеся «в работе»</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {statusDefs.map((s) => {
            const on = statuses.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                className={`badge ${on ? s.badge : "b-off"}`}
                style={{ border: on ? "1px solid transparent" : "1px dashed var(--border)", cursor: "pointer", opacity: on ? 1 : 0.55, padding: "7px 11px" }}
              >
                {on && <Check size={12} style={{ marginRight: 4 }} />}{s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div className="field" style={{ marginBottom: 0, maxWidth: 220 }}>
          <label>Ёмкость (100% нагрузки), лидов</label>
          <input
            type="number"
            min={1}
            max={1000}
            value={capacity}
            onChange={(e) => { setSaved(false); setCapacity(parseInt(e.target.value, 10) || 0); }}
          />
        </div>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving} style={{ marginBottom: 2 }}>
          {saving ? "Сохраняем…" : saved ? "Сохранено ✓" : "Сохранить"}
        </button>
      </div>
      {error && <div style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{error}</div>}
    </div>
  );
}
