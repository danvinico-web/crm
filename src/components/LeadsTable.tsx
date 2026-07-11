"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Send, MoreHorizontal, UserPlus, CheckCheck, Radio } from "lucide-react";
import type { LeadView } from "@/lib/leadView";
import { LEAD_STATUS_BADGE, LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/enums";
import { avatarGradient, initials, codeToFlag, formatDateShort, formatMoney } from "@/lib/format";
import SendModal from "@/components/SendModal";

type Props = {
  leads: LeadView[];
  total: number;
  page: number;
  pageSize: number;
};

function pluralLeads(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "лид";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "лида";
  return "лидов";
}

export default function LeadsTable({ leads, total, page, pageSize }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendIds, setSendIds] = useState<string[] | null>(null);
  const [overrides, setOverrides] = useState<Record<string, LeadStatus>>({});
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [live, setLive] = useState(false);

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

  const allOn = leads.length > 0 && selected.size === leads.length;

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === leads.length ? new Set() : new Set(leads.map((l) => l.id))));
  }

  const notReady = () => alert("Назначение агента и смена статуса появятся в следующих фазах.");
  const openSend = (ids: string[]) => {
    if (ids.length > 0) setSendIds(ids);
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="card table-card">
      <div className={`bulkbar${selected.size > 0 ? " show" : ""}`}>
        <span className="cnt">
          {selected.size} {pluralLeads(selected.size)} выбрано
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => openSend([...selected])}>
          <Send size={16} /> Отправить в офис
        </button>
        <button className="btn btn-soft btn-sm" onClick={notReady}>
          <UserPlus size={16} /> Назначить агента
        </button>
        <button className="btn btn-soft btn-sm" onClick={notReady}>
          <CheckCheck size={16} /> Сменить статус
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
                  <span className={`chk${selected.has(l.id) ? " on" : ""}`} onClick={() => toggleRow(l.id)} />
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
                    <div className="mini" onClick={() => openSend([l.id])} title="Отправить в офис"><Send size={15} /></div>
                    <div className="mini" title="Ещё"><MoreHorizontal size={15} /></div>
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
          <a className="pg" href={`/leads?page=${Math.max(1, page - 1)}`}>‹</a>
          {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
            <a key={p} className={`pg${p === page ? " on" : ""}`} href={`/leads?page=${p}`}>
              {p}
            </a>
          ))}
          {pages > 5 && <span className="pg">…</span>}
          <a className="pg" href={`/leads?page=${Math.min(pages, page + 1)}`}>›</a>
        </div>
      </div>

      {sendIds && <SendModal leadIds={sendIds} onClose={() => setSendIds(null)} />}
    </div>
  );
}
