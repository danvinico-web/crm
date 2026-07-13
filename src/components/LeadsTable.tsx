"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, MoreHorizontal, UserPlus, CheckCheck, Radio, Trash2, X } from "lucide-react";
import type { LeadView } from "@/lib/leadView";
import { LEAD_STATUS_BADGE, LEAD_STATUS_LABEL, LEAD_STATUSES, type LeadStatus } from "@/lib/enums";
import { avatarGradient, initials, codeToFlag, formatDateShort, formatMoney } from "@/lib/format";
import SendModal from "@/components/SendModal";

type Props = {
  leads: LeadView[];
  total: number;
  page: number;
  pageSize: number;
  query?: string;
  basePath?: string;
};

function pluralLeads(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "лид";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "лида";
  return "лидов";
}

export default function LeadsTable({ leads, total, page, pageSize, query = "", basePath = "/leads" }: Props) {
  const router = useRouter();
  const qPrefix = query ? query + "&" : "";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [sendSel, setSendSel] = useState<{ body: Record<string, unknown>; count: number } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, LeadStatus>>({});
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [live, setLive] = useState(false);
  const [action, setAction] = useState<null | "status" | "assign">(null);
  const [agents, setAgents] = useState<{ id: string; name: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);

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
  /** Тело запроса для массового действия: либо список id, либо весь фильтр. */
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

  const openSend = () => {
    if (selectionActive) setSendSel({ body: actionBody(), count: selectionCount });
  };
  const openSendOne = (id: string) => setSendSel({ body: { leadIds: [id] }, count: 1 });

  async function openAssign() {
    if (!selectionActive) return;
    if (agents.length === 0) {
      const d = await fetch("/api/agents").then((r) => r.json()).catch(() => ({ agents: [] }));
      setAgents(d.agents ?? []);
    }
    setAction("assign");
  }

  async function bulkStatus(status: LeadStatus) {
    setBusy(true);
    await fetch("/api/leads/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...actionBody(), status }) });
    setBusy(false);
    setAction(null);
    clearSelection();
    router.refresh();
  }

  async function bulkAssign(agentId: string | null) {
    setBusy(true);
    await fetch("/api/leads/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...actionBody(), agentId }) });
    setBusy(false);
    setAction(null);
    clearSelection();
    router.refresh();
  }

  async function bulkDelete() {
    if (!selectionActive) return;
    if (!window.confirm(`Удалить ${selectionCount} лид(ов)? Действие необратимо.`)) return;
    setBusy(true);
    await fetch("/api/leads/bulk-delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(actionBody()) });
    setBusy(false);
    clearSelection();
    router.refresh();
  }

  async function deleteOne(id: string) {
    if (!window.confirm("Удалить этот лид?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="card table-card">
      <div className={`bulkbar${selectionActive ? " show" : ""}`} style={{ flexWrap: "wrap" }}>
        <span className="cnt">
          {selectionCount.toLocaleString("ru-RU")} {pluralLeads(selectionCount)} выбрано
        </span>
        {allOn && !selectAllMatching && total > leads.length && (
          <button className="btn btn-soft btn-sm" onClick={() => setSelectAllMatching(true)}>
            Выбрать все {total.toLocaleString("ru-RU")} по фильтру
          </button>
        )}
        {selectAllMatching && (
          <button className="btn btn-ghost btn-sm" onClick={clearSelection}><X size={14} /> Сбросить</button>
        )}
        <button className="btn btn-primary btn-sm" onClick={openSend}>
          <Send size={16} /> Отправить в офис
        </button>
        <button className="btn btn-soft btn-sm" onClick={openAssign}>
          <UserPlus size={16} /> Назначить агента
        </button>
        <button className="btn btn-soft btn-sm" onClick={() => setAction("status")}>
          <CheckCheck size={16} /> Сменить статус
        </button>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", color: "var(--red)" }} onClick={bulkDelete} disabled={busy}>
          <Trash2 size={16} /> Удалить
        </button>
      </div>

      <div className="tbl-scroll">
        <table>
          <thead>
            <tr>
              <th style={{ width: 20 }}>
                <span className={`chk${allOn ? " on" : ""}`} onClick={toggleAll} />
              </th>
              <th>Лид</th>
              <th>Телефон</th>
              <th>Гео</th>
              <th>Метка аффилиата</th>
              <th>Дата</th>
              <th>Баланс</th>
              <th>Статус</th>
              <th>Агент</th>
              <th>Комментарий</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const status = overrides[l.id] ?? l.status;
              const flashed = !!flash[l.id];
              return (
              <tr key={l.id} style={{ transition: "background .8s", background: flashed ? "var(--accent-soft)" : undefined }}>
                <td>
                  <span className={`chk${selectAllMatching || selected.has(l.id) ? " on" : ""}`} onClick={() => toggleRow(l.id)} />
                </td>
                <td>
                  <div className="cust">
                    <div className="av-sm" style={{ background: avatarGradient(l.fullName) }}>
                      {initials(l.fullName)}
                    </div>
                    <div>
                      <Link href={`/leads/${l.id}`} className="nm" style={{ cursor: "pointer" }}>{l.fullName}</Link>
                      <div className="em">{l.email ?? "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="mono muted">{l.phone ?? "—"}</td>
                <td>{l.geo ? `${codeToFlag(l.geo)} ${l.geo}` : "—"}</td>
                <td>{l.affiliateTag ? <span className="chip aff">{l.affiliateTag}</span> : "—"}</td>
                <td className="mono muted">{formatDateShort(l.sentAt ?? l.createdAt)}</td>
                <td className="bal" style={{ color: l.balance > 0 ? "var(--green)" : "var(--text-dim)" }}>
                  {l.balance > 0 ? formatMoney(l.balance) : "$0"}
                </td>
                <td>
                  <span className={`badge ${LEAD_STATUS_BADGE[status]}`}>{LEAD_STATUS_LABEL[status]}</span>
                </td>
                <td>{l.agent ?? "—"}</td>
                <td className="note" title={l.comment ?? ""}>{l.comment ?? "—"}</td>
                <td>
                  <div className="row-act">
                    <div className="mini" onClick={() => openSendOne(l.id)} title="Отправить в офис"><Send size={15} /></div>
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
            <a key={p} className={`pg${p === page ? " on" : ""}`} href={`${basePath}?${qPrefix}page=${p}`}>
              {p}
            </a>
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
              {LEAD_STATUSES.map((s) => (
                <button key={s} className={`badge ${LEAD_STATUS_BADGE[s]}`} style={{ border: "none", cursor: "pointer", padding: "10px 12px", justifyContent: "center" }} disabled={busy} onClick={() => bulkStatus(s)}>
                  {LEAD_STATUS_LABEL[s]}
                </button>
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
