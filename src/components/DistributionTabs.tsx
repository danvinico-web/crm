"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { DeliveryStatus } from "@/lib/enums";

export interface OfficeCard {
  id: string;
  name: string;
  logoText: string;
  color: string;
  crmName: string;
  apiTypeLabel: string;
  connState: string;
  sandbox: boolean;
  sent: number;
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

const RULES = [
  { prio: 1, cond: <>Если <b>метка = aff_karl</b> и <b>гео = DE, AT</b> <span className="arrow">→</span> <b>Office Alpha</b>, кап 200/день</>, on: true },
  { prio: 2, cond: <>Если <b>гео = PL, CZ</b> и <b>баланс = 0</b> <span className="arrow">→</span> <b>Office Beta</b>, round-robin</>, on: true },
  { prio: 3, cond: <>Если <b>метка = fb_pro</b> <span className="arrow">→</span> <b>Office Delta</b>, приоритет по цене</>, on: true },
  { prio: 4, cond: <>Fallback: всё остальное <span className="arrow">→</span> <b>Office Gamma</b>, вторичная доставка</>, on: false },
];

export default function DistributionTabs({ offices, logs }: { offices: OfficeCard[]; logs: LogRow[] }) {
  const [tab, setTab] = useState<"int" | "rules" | "logs">("int");
  const [rules, setRules] = useState(RULES);

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
                    </div>
                  </div>
                  <div className="int-body">
                    <div className="m"><div className="v">{o.sent}</div><div className="k">отправлено</div></div>
                    <div className="m"><div className="v">{o.accepted}</div><div className="k">принято</div></div>
                    <div className="m"><div className="v" style={{ color: o.successPct >= 85 ? "var(--green)" : "var(--red)" }}>{o.successPct}%</div><div className="k">success</div></div>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => alert("Форма подключения офиса — в фазе настроек.")}>
            <Plus size={16} /> Подключить новый офис / CRM
          </button>
        </>
      )}

      {tab === "rules" && (
        <>
          <div className="card">
            <div className="tbl-toolbar">
              <b style={{ fontSize: 14 }}>Правила распределения (filter sets)</b>
              <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => alert("Редактор правил — в фазе настроек.")}>
                <Plus size={16} /> Новое правило
              </button>
            </div>
            {rules.map((r, i) => (
              <div className="rule" key={r.prio}>
                <div className="prio">{r.prio}</div>
                <div className="cond">{r.cond}</div>
                <button
                  className={`switch${r.on ? "" : " off"}`}
                  aria-label="Вкл/выкл правило"
                  onClick={() => setRules((rs) => rs.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
                />
              </div>
            ))}
          </div>
          <div className="card panel" style={{ marginTop: 16 }}>
            <div className="panel-head"><h3>Postback от офисов</h3><span className="conn ok">● Приём включён</span></div>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Офисы возвращают события <b style={{ color: "var(--text)" }}>FTD / депозит / статус</b> на ваш callback-endpoint. Баланс и статус лида обновляются автоматически (см. фазу «Статусы»).
            </p>
            <div className="map-col" style={{ marginTop: 12, fontFamily: "monospace", fontSize: 12 }}>
              <span>POST&nbsp; /api/status/{"{integrationId}"}</span><span className="chip src">JSON</span>
            </div>
          </div>
        </>
      )}

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
    </>
  );
}
