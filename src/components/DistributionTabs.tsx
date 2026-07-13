"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import type { DeliveryStatus } from "@/lib/enums";
import { DeleteButton } from "@/components/RowActions";
import ConnectorForm from "@/components/ConnectorForm";
import RoutingRules from "@/components/RoutingRules";

export interface OfficeCard {
  id: string;
  integrationId: string | null;
  name: string;
  logoText: string;
  color: string;
  crmName: string;
  apiTypeLabel: string;
  connState: string;
  sandbox: boolean;
  sent: number;
  inWork: number;
  deposits: number;
  churn: number;
  conversion: number;
  accepted: number;
  successPct: number;
}

export interface LogRow {
  time: string;
  leadName: string;
  office: string;
  method: string;
  status: DeliveryStatus;
  httpStatus?: number;
  detail: string;
}

const CONN: Record<string, { cls: string; label: string }> = {
  ok: { cls: "ok", label: "Активна" },
  err: { cls: "err", label: "Ошибка" },
  idle: { cls: "idle", label: "Пауза" },
};

const DELIVERY_BADGE: Record<DeliveryStatus, string> = {
  ACCEPTED: "b-dep",
  SENT: "b-sent",
  PENDING: "b-off",
  RETRYING: "b-work",
  REJECTED: "b-rej",
  ERROR: "b-rej",
};

const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function DistributionTabs({ offices, logs }: { offices: OfficeCard[]; logs: LogRow[] }) {
  const [tab, setTab] = useState<"int" | "rules" | "logs">("int");
  const [form, setForm] = useState<null | { integrationId?: string }>(null);

  return (
    <>
      <div className="tabs">
        <div className={`tab${tab === "int" ? " active" : ""}`} onClick={() => setTab("int")}>Интеграции офисов</div>
        <div className={`tab${tab === "rules" ? " active" : ""}`} onClick={() => setTab("rules")}>Правила роутинга</div>
        <div className={`tab${tab === "logs" ? " active" : ""}`} onClick={() => setTab("logs")}>Логи отправки</div>
      </div>

      {tab === "int" && (
        <>
          <div className="int-grid">
            {offices.map((o) => {
              const conn = CONN[o.connState] ?? CONN.idle;
              return (
                <div className="card int-card" key={o.id}>
                  <div className="int-head">
                    <div className="int-logo" style={{ background: `linear-gradient(135deg,${o.color})` }}>{o.logoText}</div>
                    <div>
                      <div className="nm">{o.name}</div>
                      <div className="ty">{o.crmName} · {o.apiTypeLabel}</div>
                    </div>
                    <div className="int-meta">
                      <span className={`conn ${conn.cls}`}>● {conn.label}</span>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{o.sandbox ? "dry-run" : "боевой"}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
                        {o.integrationId && (
                          <button className="mini" title="Редактировать коннектор" onClick={() => setForm({ integrationId: o.integrationId! })}><Pencil size={14} /></button>
                        )}
                        <DeleteButton endpoint={`/api/offices/${o.id}`} confirmText={`Удалить офис «${o.name}» и его коннектор?`} />
                      </div>
                    </div>
                  </div>
                  <div className="int-body">
                    <div className="m"><div className="v">{o.sent}</div><div className="k">отправлено</div></div>
                    <div className="m"><div className="v" style={{ color: "var(--green)" }}>{o.deposits}</div><div className="k">депозит</div></div>
                    <div className="m"><div className="v" style={{ color: "var(--red)" }}>{o.churn}</div><div className="k">слив</div></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                    <span className="muted" style={{ fontSize: 12 }}>в работе {o.inWork} · конв. {o.conversion}% · доставка {o.successPct}%</span>
                    <Link href={`/distribution/${o.id}`} className="btn btn-soft btn-sm">Отслеживать →</Link>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setForm({})}>
            <Plus size={16} /> Подключить новый офис / CRM
          </button>
        </>
      )}

      {tab === "rules" && <RoutingRules />}

      {tab === "logs" && (
        <div className="card table-card">
          <div className="tbl-scroll">
            <table>
              <thead>
                <tr><th>Время</th><th>Лид</th><th>Офис</th><th>Метод</th><th>Статус</th><th>Ответ</th></tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 28 }}>Отправок пока нет.</td></tr>
                )}
                {logs.map((l, i) => (
                  <tr key={i}>
                    <td className="mono muted">{timeFmt.format(new Date(l.time))}</td>
                    <td>{l.leadName}</td>
                    <td>{l.office}</td>
                    <td><span className="chip src">{l.method}</span></td>
                    <td><span className={`badge ${DELIVERY_BADGE[l.status]}`}>{l.httpStatus ?? l.status}</span></td>
                    <td className="mono muted" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{l.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {form && <ConnectorForm integrationId={form.integrationId} onClose={() => setForm(null)} />}
    </>
  );
}
