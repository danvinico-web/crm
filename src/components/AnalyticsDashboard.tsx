"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Send, DollarSign, TrendingUp, CheckCheck, Download } from "lucide-react";
import AreaChart from "@/components/AreaChart";
import type { OfficeLite } from "@/app/api/offices/route";
import { LEAD_STATUS_BADGE, LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/enums";

interface OfficeRow {
  officeId: string;
  name: string;
  color: string;
  sent: number;
  accepted: number;
  rejected: number;
  deposits: number;
  conversion: number;
}
interface Analytics {
  summary: { sent: number; accepted: number; deposits: number; conversion: number };
  byOffice: OfficeRow[];
  byDay: { date: string; sent: number; deposits: number }[];
  statusDist: Record<string, number>;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "7 дней", days: 7 },
  { label: "30 дней", days: 30 },
  { label: "90 дней", days: 90 },
];

export default function AnalyticsDashboard() {
  const [offices, setOffices] = useState<OfficeLite[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [to, setTo] = useState(isoDate(new Date()));
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 30 * 86_400_000)));
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/offices")
      .then((r) => r.json())
      .then((d) => setOffices(d.offices ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (selected.size) params.set("officeIds", [...selected].join(","));
    const res = await fetch(`/api/analytics?${params.toString()}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [from, to, selected]);

  useEffect(() => {
    load();
  }, [load]);

  function applyPreset(days: number) {
    setFrom(isoDate(new Date(Date.now() - days * 86_400_000)));
    setTo(isoDate(new Date()));
  }
  function toggleOffice(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const statusRows = useMemo(() => {
    if (!data) return [];
    return (Object.entries(data.statusDist) as [LeadStatus, number][])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [data]);
  const statusMax = Math.max(1, ...statusRows.map(([, n]) => n));
  const officeMax = Math.max(1, ...(data?.byOffice.map((o) => o.sent) ?? [1]));

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Офис", "Отправлено", "Принято", "Отклонено", "Депозиты", "Конверсия %"],
      ...data.byOffice.map((o) => [o.name, o.sent, o.accepted, o.rejected, o.deposits, o.conversion]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leadhub-analytics-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Тулбар: период + офисы */}
      <div className="card panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {PRESETS.map((p) => (
              <div key={p.days} className="tab" onClick={() => applyPreset(p.days)}>{p.label}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 11px", color: "var(--text)", fontSize: 13 }} />
            <span className="muted">—</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)}
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 11px", color: "var(--text)", fontSize: 13 }} />
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={exportCsv} disabled={!data}>
            <Download size={16} /> Экспорт CSV
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {offices.map((o) => (
            <div key={o.id} className={`filter${selected.has(o.id) ? " on" : ""}`} onClick={() => toggleOffice(o.id)}>
              {o.name}
            </div>
          ))}
          {selected.size > 0 && (
            <div className="filter" onClick={() => setSelected(new Set())}>Сбросить</div>
          )}
        </div>
      </div>

      {/* KPI за период */}
      <div className="kpi-grid">
        <Kpi icon={<Send size={20} />} cls="i-purple" label="Отправлено в офисы" value={data?.summary.sent ?? 0} />
        <Kpi icon={<CheckCheck size={20} />} cls="i-blue" label="Принято офисами" value={data?.summary.accepted ?? 0} />
        <Kpi icon={<DollarSign size={20} />} cls="i-green" label="Депозиты (FTD)" value={data?.summary.deposits ?? 0} />
        <Kpi icon={<TrendingUp size={20} />} cls="i-amber" label="Конверсия в FTD" value={`${data?.summary.conversion ?? 0}%`} />
      </div>

      <div className="grid-2">
        <div className="card panel">
          <div className="panel-head">
            <div><h3>Динамика по дням</h3><div className="muted" style={{ fontSize: 12 }}>Отгрузки и депозиты за период</div></div>
            <div className="legend">
              <span><i style={{ background: "var(--accent)" }} />Отправлено</span>
              <span><i style={{ background: "var(--green)" }} />Депозиты</span>
            </div>
          </div>
          <div className="chart-wrap">
            {data && data.byDay.length > 0 ? (
              <AreaChart leads={data.byDay.map((d) => d.sent)} deps={data.byDay.map((d) => d.deposits)} />
            ) : (
              <div className="muted" style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
                {loading ? "Загрузка…" : "Нет данных за период"}
              </div>
            )}
          </div>
        </div>

        <div className="card panel">
          <div className="panel-head"><h3>Распределение статусов</h3></div>
          {statusRows.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Нет отгруженных лидов за период.</div>}
          {statusRows.map(([status, n]) => (
            <div className="funnel-row" key={status}>
              <div className="fl">{LEAD_STATUS_LABEL[status]}</div>
              <div className="funnel-bar">
                <span className={`badge ${LEAD_STATUS_BADGE[status]}`} style={{ width: `${Math.max(8, (n / statusMax) * 100)}%`, background: "var(--surface-3)", borderRadius: 7, color: "var(--text)" }}>{n}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Сравнение офисов */}
      <div className="card table-card">
        <div className="tbl-toolbar">
          <b style={{ fontSize: 14 }}>Сравнение офисов за период</b>
          <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>
            {selected.size ? `${selected.size} офис(ов) в фильтре` : "все офисы"}
          </span>
        </div>
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr><th>Офис</th><th>Отправлено</th><th>Принято</th><th>Отклонено</th><th>Депозиты</th><th>Конверсия</th><th style={{ width: 160 }}>Объём</th></tr>
            </thead>
            <tbody>
              {(data?.byOffice ?? []).length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 28 }}>{loading ? "Загрузка…" : "Нет отгрузок за период"}</td></tr>
              )}
              {data?.byOffice.map((o) => (
                <tr key={o.officeId}>
                  <td><b>{o.name}</b></td>
                  <td className="mono">{o.sent}</td>
                  <td className="mono">{o.accepted}</td>
                  <td className="mono">{o.rejected}</td>
                  <td className="mono">{o.deposits}</td>
                  <td><span className={`badge ${o.conversion >= 20 ? "b-dep" : o.conversion >= 12 ? "b-work" : "b-rej"}`}>{o.conversion}%</span></td>
                  <td>
                    <div className="load" style={{ width: 140 }}>
                      <span style={{ width: `${(o.sent / officeMax) * 100}%`, background: `linear-gradient(90deg,${o.color})` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Kpi({ icon, cls, label, value }: { icon: React.ReactNode; cls: string; label: string; value: string | number }) {
  return (
    <div className="card kpi">
      <div className={`ic ${cls}`}>{icon}</div>
      <div className="lbl">{label}</div>
      <div className="val">{typeof value === "number" ? value.toLocaleString("ru-RU") : value}</div>
    </div>
  );
}
