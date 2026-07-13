"use client";

import { useRouter } from "next/navigation";
import { Download, Upload, X } from "lucide-react";
import type { StatusDef } from "@/lib/enums";
import SavedFilters from "@/components/SavedFilters";
import MultiSelect from "@/components/MultiSelect";

export interface LeadFilterState {
  q?: string;
  status?: string; // мультивыбор: значения через запятую
  tag?: string;
  geo?: string;
  agent?: string;
  office?: string;
  balance?: string;
  from?: string;
  to?: string;
}

interface Props {
  current: LeadFilterState;
  statuses: StatusDef[];
  tags: string[];
  agents: { id: string; name: string }[];
  offices: { id: string; name: string }[];
  geos: string[];
  exportHref: string;
  basePath?: string;
  hideOffice?: boolean;
}

const selStyle: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "7px 11px",
  fontSize: 12.5,
  color: "var(--text)",
  fontWeight: 500,
  outline: "none",
};

/** Разбор/сборка мульти-значения фильтра. */
const split = (v?: string) => (v ? v.split(",").filter(Boolean) : []);
const join = (a: string[]) => (a.length ? a.join(",") : undefined);

export default function LeadsFilters({ current, statuses, tags, agents, offices, geos, exportHref, basePath = "/leads", hideOffice = false }: Props) {
  const router = useRouter();

  function apply(patch: Partial<LeadFilterState>) {
    const next: LeadFilterState = { ...current, ...patch };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
    const qs = sp.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  const hasActive = !!(current.status || current.tag || current.geo || current.agent || current.office || current.balance || current.from || current.to || current.q);

  const agentNames = Object.fromEntries(agents.map((a) => [a.id, a.name]));
  const officeNames = Object.fromEntries(offices.map((o) => [o.id, o.name]));

  const statusOpts = statuses.map((s) => ({ value: s.key, label: s.label }));
  const tagOpts = tags.map((t) => ({ value: t, label: t }));
  const agentOpts = [{ value: "none", label: "Без агента" }, ...agents.map((a) => ({ value: a.id, label: a.name }))];
  const officeOpts = [{ value: "none", label: "Без офиса" }, ...offices.map((o) => ({ value: o.id, label: o.name }))];
  const geoOpts = geos.map((g) => ({ value: g, label: g }));

  return (
    <>
      <SavedFilters current={current} basePath={basePath} agentNames={agentNames} officeNames={officeNames} />
      <div className="section-head">
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
          {current.q && (
            <div className="filter on">
              Поиск: {current.q}
              <X size={13} style={{ cursor: "pointer" }} onClick={() => apply({ q: undefined })} />
            </div>
          )}
          <MultiSelect label="Все статусы" options={statusOpts} selected={split(current.status)} onChange={(v) => apply({ status: join(v) })} />
          <MultiSelect label="Все метки" options={tagOpts} selected={split(current.tag)} onChange={(v) => apply({ tag: join(v) })} />
          <MultiSelect label="Все агенты" options={agentOpts} selected={split(current.agent)} onChange={(v) => apply({ agent: join(v) })} />
          {!hideOffice && (
            <MultiSelect label="Все офисы" options={officeOpts} selected={split(current.office)} onChange={(v) => apply({ office: join(v) })} />
          )}
          <MultiSelect label="Все гео" options={geoOpts} selected={split(current.geo)} onChange={(v) => apply({ geo: join(v) })} />
          <div className={`filter${current.balance === "deposit" ? " on" : ""}`} onClick={() => apply({ balance: current.balance === "deposit" ? undefined : "deposit" })}>
            С депозитом
          </div>
          <input type="date" value={current.from ?? ""} onChange={(e) => apply({ from: e.target.value || undefined })} style={selStyle} title="Дата с" />
          <input type="date" value={current.to ?? ""} onChange={(e) => apply({ to: e.target.value || undefined })} style={selStyle} title="Дата по" />
          {hasActive && (
            <button className="btn btn-ghost btn-sm" onClick={() => router.push(basePath)}><X size={14} /> Сбросить</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <a className="btn btn-ghost btn-sm" href="/import"><Download size={16} /> Импорт CSV</a>
          <a className="btn btn-ghost btn-sm" href={exportHref}><Upload size={16} /> Экспорт</a>
        </div>
      </div>
    </>
  );
}
