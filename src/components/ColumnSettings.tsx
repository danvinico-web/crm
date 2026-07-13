"use client";

import { useEffect, useRef, useState } from "react";
import { Columns3, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";

export interface ColumnMeta {
  key: string;
  label: string; // дефолтная подпись
  required?: boolean; // нельзя скрыть (напр. «Лид»)
}

export interface ColumnConfig {
  order: string[];
  hidden: string[];
  labels: Record<string, string>;
}

interface Props {
  columns: ColumnMeta[]; // уже в эффективном порядке
  config: ColumnConfig;
  onChange: (c: ColumnConfig) => void;
}

/** Настройка колонок таблицы лидов: показать/скрыть, порядок, переименование. */
export default function ColumnSettings({ columns, config, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const hidden = new Set(config.hidden);

  function toggle(key: string) {
    onChange({ ...config, hidden: hidden.has(key) ? config.hidden.filter((k) => k !== key) : [...config.hidden, key] });
  }
  function rename(key: string, label: string) {
    onChange({ ...config, labels: { ...config.labels, [key]: label } });
  }
  function move(idx: number, dir: -1 | 1) {
    const keys = columns.map((c) => c.key);
    const j = idx + dir;
    if (j < 0 || j >= keys.length) return;
    [keys[idx], keys[j]] = [keys[j], keys[idx]];
    onChange({ ...config, order: keys });
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
        <Columns3 size={16} /> Колонки
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 50,
            width: 300,
            maxHeight: 420,
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 14px 36px rgba(0,0,0,.32)",
            padding: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 8px" }}>
            <b style={{ fontSize: 13 }}>Колонки таблицы</b>
            <button className="btn btn-ghost btn-sm" title="Сбросить" onClick={() => onChange({ order: [], hidden: [], labels: {} })}>
              <RotateCcw size={13} /> Сброс
            </button>
          </div>
          {columns.map((c, i) => {
            const on = !hidden.has(c.key);
            return (
              <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 8 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <ChevronUp size={13} style={{ cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 0.8 }} onClick={() => move(i, -1)} />
                  <ChevronDown size={13} style={{ cursor: i === columns.length - 1 ? "default" : "pointer", opacity: i === columns.length - 1 ? 0.3 : 0.8 }} onClick={() => move(i, 1)} />
                </div>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={c.required}
                  onChange={() => toggle(c.key)}
                  title={c.required ? "Обязательная колонка" : on ? "Скрыть" : "Показать"}
                  style={{ width: 15, height: 15 }}
                />
                <input
                  value={config.labels[c.key] ?? c.label}
                  onChange={(e) => rename(c.key, e.target.value)}
                  style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 8px", color: on ? "var(--text)" : "var(--text-mute)", fontSize: 12.5, outline: "none" }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
