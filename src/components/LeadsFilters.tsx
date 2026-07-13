"use client";

import { useRouter } from "next/navigation";
import { Download, Upload, X } from "lucide-react";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/enums";

export interface LeadFilterState {
  q?: string;
  status?: string;
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

export default function LeadsFilters({ current, tags, agents, offices, geos, exportHref, basePath = "/leads", hideOffice = false }: Props) {
  const router = useRouter();

  function apply(patch: Partial<LeadFilterState>) {
    const next: LeadFilterState = { ...current, ...patch };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
    const qs = sp.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  const hasActive = !!(current.status || current.tag || current.geo || current.agent || current.office || current.balance || current.from || current.to || current.q);

  return (
    <div className="section-head">
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
        {current.q && (
          <div className="filter on">
            Поиск: {current.q}
            <X size={13} style={{ cursor: "pointer" }} onClick={() => apply({ q: undefined })} />
          </div>
        )}
        <select style={{ ...selStyle, ...(current.status ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}) }} value={current.status ?? ""} onChange={(e) => apply({ status: e.target.value || undefined })}>
          <option value="">Все статусы</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
        </select>
        <select style={{ ...selStyle, ...(current.tag ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}) }} value={current.tag ?? ""} onChange={(e) => apply({ tag: e.target.value || undefined })}>
          <option value="">Все метки</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={{ ...selStyle, ...(current.agent ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}) }} value={current.agent ?? ""} onChange={(e) => apply({ agent: e.target.value || undefined })}>
          <option value="">Все агенты</option>
          <option value="none">Без агента</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {!hideOffice && (
          <select style={{ ...selStyle, ...(current.office ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}) }} value={current.office ?? ""} onChange={(e) => apply({ office: e.target.value || undefined })}>
            <option value="">Все офисы</option>
            <option value="none">Без офиса</option>
            {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <select style={{ ...selStyle, ...(current.geo ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}) }} value={current.geo ?? ""} onChange={(e) => apply({ geo: e.target.value || undefined })}>
          <option value="">Все гео</option>
          {geos.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
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
  );
}
