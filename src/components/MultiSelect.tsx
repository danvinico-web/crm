"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface MSOption {
  value: string;
  label: string;
}

interface Props {
  label: string; // напр. «Все статусы»
  options: MSOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

/** Мультивыбор в виде поповера с чекбоксами. Внешний вид как у фильтр-селектов. */
export default function MultiSelect({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const active = selected.length > 0;
  const summary =
    selected.length === 0
      ? label
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? label
        : `${label} · ${selected.length}`;

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          background: "var(--surface-2)",
          border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
          color: active ? "var(--accent)" : "var(--text)",
          borderRadius: 9,
          padding: "7px 11px",
          fontSize: 12.5,
          fontWeight: 500,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {summary}
        <ChevronDown size={14} style={{ opacity: 0.7 }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 40,
            minWidth: 210,
            maxHeight: 320,
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 11,
            boxShadow: "0 12px 32px rgba(0,0,0,.35)",
            padding: 6,
          }}
        >
          {active && (
            <button
              type="button"
              onClick={() => onChange([])}
              style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: "var(--text-dim)", fontSize: 12, padding: "6px 8px", cursor: "pointer" }}
            >
              Сбросить выбор
            </button>
          )}
          {options.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: "8px 10px" }}>Нет значений</div>}
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <div
                key={o.value}
                onClick={() => toggle(o.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "7px 8px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  background: on ? "var(--accent-soft)" : "transparent",
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 5,
                    border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`,
                    background: on ? "var(--accent)" : "transparent",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {on && <Check size={11} color="#fff" />}
                </span>
                {o.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
