"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Send, MoreHorizontal, UserPlus, CheckCheck, Radio, Trash2, X } from "lucide-react";
import type { LeadView } from "@/lib/leadView";
import { statusLabelOf, statusBadgeOf, statusMetaMap, type StatusDef } from "@/lib/enums";
import { avatarGradient, initials, codeToFlag, formatDateShort, formatMoney } from "@/lib/format";
import SendModal from "@/components/SendModal";
import ColumnSettings, { type ColumnConfig } from "@/components/ColumnSettings";

type Props = {
  leads: LeadView[];
  total: number;
  page: number;
  pageSize: number;
  query?: string;
  basePath?: string;
  statuses: StatusDef[];
  customFields?: { key: string; label: string }[];
  canSend?: boolean;
};

interface Column {
  key: string;
  label: string;
  required?: boolean;
  tdClass?: string;
  cell: (l: LeadView) => ReactNode;
}

function pluralLeads(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "лид";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "лида";
  return "лидов";
}

export default function LeadsTable({ leads, total, page, pageSize, query = "", basePath = "/leads", statuses, customFields = [], canSend = true }: Props) {
  const router = useRouter();
  const statusMeta = statusMetaMap(statuses);
  const pickable = statuses.filter((s) => s.active);
  const qPrefix = query ? query + "&" : "";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [sendSel, setSendSel] = useState<{ body: Record<string, unknown>; count: number } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [live, setLive] = useState(false);
  const [action, setAction] = useState<null | "status" | "assign">(null);
  const [agents, setAgents] = useState<{ id: string; name: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [columnCfg, setColumnCfg] = useState<ColumnConfig>({ order: [], hidden: [], labels: {} });

  const storageKey = `leadhub:leadColumns:${basePath}`;
  const customKeys = customFields.map((f) => `custom:${f.key}`);

  // Загрузка сохранённой конфигурации колонок (кастомные поля по умолчанию скрыты).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setColumnCfg(JSON.parse(raw));
      else setColumnCfg({ order: [], hidden: customKeys, labels: {} });
    } catch {
      /* приватный режим — игнор */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function updateColumns(c: ColumnConfig) {
    setColumnCfg(c);
    try { localStorage.setItem(storageKey, JSON.stringify(c)); } catch { /* игнор */ }
  }

  // Real-time: подписка на SSE-канал изменений статусов.
  useEffect(() => {
    const es = new EventSource("/api/events/stream");
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (msg) => {
      try {
        const e = JSON.parse(msg.data);
        if (e.type === "lead.status.changed") {
          setOverrides((o) => ({ ...o, [e.leadId]: e.status }));
          setFlash((f) => ({ ...f, [e.leadId]: Date.now() }));
          setTimeout(() => setFlash((f) => {
            const next = { ...f };
            delete next[e.leadId];
            return next;
          }), 1600);
        }
      } catch {
        /* игнор */
      }
    };
    return () => es.close();
  }, []);

  const selectionCount = selectAllMatching ? total : selected.size;
  const selectionActive = selectAllMatching || selected.size > 0;
  const allOn = selectAllMatching || (leads.length > 0 && selected.size === leads.length);

  function clearSelection() {
    setSelected(new Set());
    setSelectAllMatching(false);
  }
  function actionBody(): Record<string, unknown> {
    return selectAllMatching ? { allMatching: true, filter: query } : { leadIds: [...selected] };
  }
  function toggleRow(id: string) {
    setSelectAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelectAllMatching(false);
    setSelected((prev) => (prev.size === leads.length ? new Set() : new Set(leads.map((l) => l.id))));
  }

  const openSend = () => { if (selectionActive) setSendSel({ body: actionBody(), count: selectionCount }); };
  const openSendOne = (id: string) => setSendSel({ body: { leadIds: [id] }, count: 1 });

  async function openAssign() {
    if (!selectionActive) return;
    if (agents.length === 0) {
      const d = await fetch("/api/agents").then((r) => r.json()).catch(() => ({ agents: [] }));
      setAgents(d.agents ?? []);
    }
    setAction("assign");
  }
  async function bulkStatus(status: string) {
    setBusy(true);
    await fetch("/api/leads/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...actionBody(), status }) });
    setBusy(false); setAction(null); clearSelection(); router.refresh();
  }
  async function bulkAssign(agentId: string | null) {
    setBusy(true);
    await fetch("/api/leads/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...actionBody(), agentId }) });
    setBusy(false); setAction(null); clearSelection(); router.refresh();
  }
  async function bulkDelete() {
    if (!selectionActive) return;
    if (!window.confirm(`Удалить ${selectionCount} лид(ов)? Действие необратимо.`)) return;
    setBusy(true);
    await fetch("/api/leads/bulk-delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(actionBody()) });
    setBusy(false); clearSelection(); router.refresh();
  }
  async function deleteOne(id: string) {
    if (!window.confirm("Удалить этот лид?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    router.refresh();
  }

  // Определения колонок (встроенные + кастомные поля клиента).
  const allColumns: Column[] = [
    { key: "refId", label: "№", cell: (l) => <Link href={`/leads/${l.id}`} className="mono muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }} title="Открыть карточку лида">{l.refId ? `#${l.refId}` : "—"}</Link> },
    { key: "lead", label: "Лид", required: true, cell: (l) => (
      <div className="cust">
        <div className="av-sm" style={{ background: avatarGradient(l.fullName) }}>{initials(l.fullName)}</div>
        <div>
          <Link href={`/leads/${l.id}`} className="nm" style={{ cursor: "pointer" }}>{l.fullName}</Link>
          <div className="em">{l.email ?? "—"}</div>
        </div>
      </div>
    ) },
    { key: "phone", label: "Телефон", tdClass: "mono muted", cell: (l) => l.phone ?? "—" },
    { key: "geo", label: "Гео", cell: (l) => (l.geo ? `${codeToFlag(l.geo)} ${l.geo}` : "—") },
    { key: "tag", label: "Метка аффилиата", cell: (l) => (l.affiliateTag ? <span className="chip aff">{l.affiliateTag}</span> : "—") },
    { key: "date", label: "Дата", tdClass: "mono muted", cell: (l) => formatDateShort(l.sentAt ?? l.createdAt) },
    { key: "balance", label: "Баланс", cell: (l) =>
      l.balance > 0
        ? <span className="bal" style={{ color: "var(--green)" }}>{formatMoney(l.balance)}</span>
        : l.balanceRaw
          ? <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{l.balanceRaw}</span>
          : <span className="bal" style={{ color: "var(--text-dim)" }}>$0</span>
    },
    { key: "status", label: "Статус", cell: (l) => {
      const st = overrides[l.id] ?? l.status;
      return <span className={`badge ${statusBadgeOf(st, statusMeta)}`}>{statusLabelOf(st, statusMeta)}</span>;
    } },
    { key: "agent", label: "Агент", cell: (l) => l.agent ?? "—" },
    { key: "comment", label: "Комментарий", tdClass: "note", cell: (l) => l.comment ?? "—" },
    ...customFields.map((f) => ({ key: `custom:${f.key}`, label: f.label, tdClass: "muted", cell: (l: LeadView) => l.custom?.[f.key] || "—" })),
  ];

  // Эффективный порядок: сохранённый + новые колонки в хвост.
  const byKey = new Map(allColumns.map((c) => [c.key, c]));
  const orderedKeys = [
    ...columnCfg.order.filter((k) => byKey.has(k)),
    ...allColumns.filter((c) => !columnCfg.order.includes(c.key)).map((c) => c.key),
  ];
  const orderedCols = orderedKeys.map((k) => byKey.get(k)!);
  const hiddenSet = new Set(columnCfg.hidden);
  const visibleCols = orderedCols.filter((c) => c.required || !hiddenSet.has(c.key));
  const labelOf = (c: Column) => columnCfg.labels[c.key] ?? c.label;

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="card table-card">
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
        <ColumnSettings columns={orderedCols.map((c) => ({ key: c.key, label: c.label, required: c.required }))} config={columnCfg} onChange={updateColumns} />
      </div>

      <div className={`bulkbar${selectionActive ? " show" : ""}`} style={{ flexWrap: "wrap" }}>
        <span className="cnt">{selectionCount.toLocaleString("ru-RU")} {pluralLeads(selectionCount)} выбрано</span>
        {allOn && !selectAllMatching && total > leads.length && (
          <button className="btn btn-soft btn-sm" onClick={() => setSelectAllMatching(true)}>Выбрать все {total.toLocaleString("ru-RU")} по фильтру</button>
        )}
        {selectAllMatching && <button className="btn btn-ghost btn-sm" onClick={clearSelection}><X size={14} /> Сбросить</button>}
        {canSend && <button className="btn btn-primary btn-sm" onClick={openSend}><Send size={16} /> Отправить в офис</button>}
        <button className="btn btn-soft btn-sm" onClick={openAssign}><UserPlus size={16} /> Назначить агента</button>
        <button className="btn btn-soft btn-sm" onClick={() => setAction("status")}><CheckCheck size={16} /> Сменить статус</button>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", color: "var(--red)" }} onClick={bulkDelete} disabled={busy}><Trash2 size={16} /> Удалить</button>
      </div>

      <div className="tbl-scroll">
        <table>
          <thead>
            <tr>
              <th style={{ width: 20 }}><span className={`chk${allOn ? " on" : ""}`} onClick={toggleAll} /></th>
              {visibleCols.map((c) => <th key={c.key}>{labelOf(c)}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const flashed = !!flash[l.id];
              return (
                <tr key={l.id} style={{ transition: "background .8s", background: flashed ? "var(--accent-soft)" : undefined }}>
                  <td><span className={`chk${selectAllMatching || selected.has(l.id) ? " on" : ""}`} onClick={() => toggleRow(l.id)} /></td>
                  {visibleCols.map((c) => (
                    <td key={c.key} className={c.tdClass} title={c.key === "comment" ? (l.comment ?? "") : undefined}>{c.cell(l)}</td>
                  ))}
                  <td>
                    <div className="row-act">
                      {canSend && <div className="mini" onClick={() => openSendOne(l.id)} title="Отправить в офис"><Send size={15} /></div>}
                      <Link href={`/leads/${l.id}`} className="mini" title="Открыть"><MoreHorizontal size={15} /></Link>
                      <div className="mini" onClick={() => deleteOne(l.id)} title="Удалить" style={{ color: "var(--red)" }}><Trash2 size={15} /></div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="tbl-foot">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          Показано {from}–{to} из {total.toLocaleString("ru-RU")} лидов
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: live ? "var(--green)" : "var(--text-mute)", fontWeight: 600 }}>
            <Radio size={13} /> {live ? "live" : "офлайн"}
          </span>
        </span>
        <div className="pager">
          <a className="pg" href={`${basePath}?${qPrefix}page=${Math.max(1, page - 1)}`}>‹</a>
          {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
            <a key={p} className={`pg${p === page ? " on" : ""}`} href={`${basePath}?${qPrefix}page=${p}`}>{p}</a>
          ))}
          {pages > 5 && <span className="pg">…</span>}
          <a className="pg" href={`${basePath}?${qPrefix}page=${Math.min(pages, page + 1)}`}>›</a>
        </div>
      </div>

      {sendSel && <SendModal selection={sendSel} onClose={() => setSendSel(null)} />}

      {action === "status" && (
        <div className="overlay show" onClick={(e) => e.target === e.currentTarget && setAction(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-head"><h3>Сменить статус · {selected.size}</h3><div className="mini" onClick={() => setAction(null)}><X size={16} /></div></div>
            <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {pickable.map((s) => (
                <button key={s.key} className={`badge ${s.badge}`} style={{ border: "none", cursor: "pointer", padding: "10px 12px", justifyContent: "center" }} disabled={busy} onClick={() => bulkStatus(s.key)}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {action === "assign" && (
        <div className="overlay show" onClick={(e) => e.target === e.currentTarget && setAction(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-head"><h3>Назначить агента · {selected.size}</h3><div className="mini" onClick={() => setAction(null)}><X size={16} /></div></div>
            <div className="modal-body">
              {agents.map((a) => (
                <div key={a.id} className="office-opt" onClick={() => bulkAssign(a.id)}>
                  <div className="lg" style={{ background: "linear-gradient(135deg,#4f7cff,#6a5cff)" }}>{initials(a.name)}</div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{a.name}</div><div className="muted" style={{ fontSize: 12 }}>{a.title}</div></div>
                </div>
              ))}
              {agents.length === 0 && <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Агентов нет.</div>}
              <div className="office-opt" onClick={() => bulkAssign(null)}><div style={{ flex: 1 }} className="muted">Снять назначение</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
