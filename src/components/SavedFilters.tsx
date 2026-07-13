"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkPlus, X, Check } from "lucide-react";
import type { LeadFilterState } from "@/components/LeadsFilters";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/enums";

/** Подпись статуса (мультивыбор через запятую) с фолбэком на ключ. */
function statusLabels(value: string): string {
  return value
    .split(",")
    .filter(Boolean)
    .map((k) => LEAD_STATUS_LABEL[k as LeadStatus] ?? k)
    .join(" / ");
}

interface SavedGroup {
  id: string;
  name: string;
  params: LeadFilterState;
}

interface Props {
  current: LeadFilterState;
  basePath: string;
  /** Метки для авто-имени: id агента/офиса → имя. */
  agentNames?: Record<string, string>;
  officeNames?: Record<string, string>;
}

function storageKey(basePath: string) {
  return `leadhub:savedViews:${basePath}`;
}

/** Активные фильтры без пустых значений и без page. */
function activeParams(current: LeadFilterState): LeadFilterState {
  const out: LeadFilterState = {};
  for (const [k, v] of Object.entries(current)) {
    if (v) out[k as keyof LeadFilterState] = v;
  }
  return out;
}

export default function SavedFilters({ current, basePath, agentNames = {}, officeNames = {} }: Props) {
  const router = useRouter();
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  const active = activeParams(current);
  const hasActive = Object.keys(active).length > 0;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(basePath));
      if (raw) setGroups(JSON.parse(raw));
    } catch {
      /* пустой/битый storage — игнор */
    }
  }, [basePath]);

  function persist(next: SavedGroup[]) {
    setGroups(next);
    try {
      localStorage.setItem(storageKey(basePath), JSON.stringify(next));
    } catch {
      /* приватный режим — не критично */
    }
  }

  /** Читаемое имя из активных фильтров, напр. «Депозит · FR · fb_pro». */
  function autoName(p: LeadFilterState): string {
    const parts: string[] = [];
    if (p.status) parts.push(statusLabels(p.status));
    if (p.balance === "deposit") parts.push("с депозитом");
    if (p.geo) parts.push(p.geo);
    if (p.tag) parts.push(p.tag);
    if (p.agent) parts.push(p.agent === "none" ? "без агента" : agentNames[p.agent] ?? "агент");
    if (p.office) parts.push(p.office === "none" ? "без офиса" : officeNames[p.office] ?? "офис");
    if (p.q) parts.push(`«${p.q}»`);
    if (p.from || p.to) parts.push("период");
    return parts.join(" · ") || "Группа фильтров";
  }

  function beginSave() {
    setDraftName(autoName(active));
    setNaming(true);
  }

  function confirmSave() {
    const name = draftName.trim() || autoName(active);
    // Один и тот же набор фильтров не дублируем — обновляем имя.
    const key = JSON.stringify(active);
    const rest = groups.filter((g) => JSON.stringify(g.params) !== key);
    persist([...rest, { id: key, name, params: active }]);
    setNaming(false);
    setDraftName("");
  }

  function applyGroup(g: SavedGroup) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(g.params)) if (v) sp.set(k, v);
    const qs = sp.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  function removeGroup(id: string) {
    persist(groups.filter((g) => g.id !== id));
  }

  const activeKey = JSON.stringify(active);

  if (groups.length === 0 && !hasActive) return null;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
      {groups.length > 0 && (
        <span className="muted" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Bookmark size={13} /> Группы:
        </span>
      )}
      {groups.map((g) => {
        const isCurrent = g.id === activeKey;
        return (
          <span
            key={g.id}
            className={`filter${isCurrent ? " on" : ""}`}
            style={{ cursor: "pointer", gap: 6 }}
            onClick={() => applyGroup(g)}
            title="Применить группу фильтров"
          >
            {g.name}
            <X
              size={12}
              style={{ cursor: "pointer", opacity: 0.7 }}
              onClick={(e) => { e.stopPropagation(); removeGroup(g.id); }}
            />
          </span>
        );
      })}

      {hasActive && !naming && (
        <button className="btn btn-ghost btn-sm" onClick={beginSave}>
          <BookmarkPlus size={14} /> Сохранить группу
        </button>
      )}
      {naming && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmSave(); if (e.key === "Escape") setNaming(false); }}
            placeholder="Название группы"
            style={{ background: "var(--surface-2)", border: "1px solid var(--accent)", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, color: "var(--text)", outline: "none", width: 190 }}
          />
          <button className="btn btn-primary btn-sm" onClick={confirmSave}><Check size={14} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setNaming(false)}><X size={14} /></button>
        </span>
      )}
    </div>
  );
}
