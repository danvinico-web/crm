import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { ArrowLeft, Send, DollarSign, Flame, TrendingUp } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { Office, Integration, Lead, Agent } from "@/models";
import { officeSummaryMap, emptyOfficeSummary } from "@/lib/officeStats";
import { leadToView, type OfficeMeta, type LeadLike } from "@/lib/leadView";
import { buildLeadFilter } from "@/lib/leadQuery";
import { API_TYPE_LABEL, LEAD_STATUSES, LEAD_STATUS_LABEL, LEAD_STATUS_BADGE, type LeadStatus } from "@/lib/enums";
import AreaChart from "@/components/AreaChart";
import LeadsTable from "@/components/LeadsTable";
import LeadsFilters, { type LeadFilterState } from "@/components/LeadsFilters";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
const DAY = 86_400_000;

export default async function OfficeDetailPage({
  params,
  searchParams,
}: {
  params: { officeId: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (!mongoose.isValidObjectId(params.officeId)) notFound();
  await dbConnect();

  const office = await Office.findById(params.officeId).lean();
  if (!office) notFound();
  const officeId = String(office._id);
  const page = Math.max(1, parseInt(typeof searchParams.page === "string" ? searchParams.page : "1", 10) || 1);
  const officeOnly = { office: new mongoose.Types.ObjectId(officeId) };

  // Фильтры из URL + принудительно этот офис (таблица лидов фильтруется как в «Лидах»).
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v) sp.set(k, v);
  sp.delete("page");
  sp.set("office", officeId);
  const tableFilter = buildLeadFilter(sp);

  const [integration, summaryMap, statusDistRaw, byDayRaw, total, leadDocs, agents, tagsRaw, geosRaw] = await Promise.all([
    Integration.findOne({ office: office._id }).lean(),
    officeSummaryMap(),
    Lead.aggregate<{ _id: string; n: number }>([{ $match: officeOnly }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Lead.aggregate<{ _id: string; sent: number; deposits: number }>([
      { $match: { ...officeOnly, sentAt: { $gte: new Date(Date.now() - 14 * DAY) } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$sentAt" } }, sent: { $sum: 1 }, deposits: { $sum: { $cond: [{ $eq: ["$status", "DEPOSIT"] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
    ]),
    Lead.countDocuments(tableFilter),
    Lead.find(tableFilter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Agent.find().select("name").lean(),
    Lead.distinct("affiliateTag", officeOnly),
    Lead.distinct("geo", officeOnly),
  ]);

  const s = summaryMap.get(officeId) ?? emptyOfficeSummary();
  const officeMap = new Map<string, OfficeMeta>([[officeId, { name: office.name, color: office.color }]]);
  const agentMap = new Map<string, string>(agents.map((a) => [String(a._id), a.name]));
  const views = leadDocs.map((l) => leadToView(l as unknown as LeadLike, officeMap, agentMap));

  const current: LeadFilterState = {
    q: sp.get("q") || undefined,
    status: sp.get("status") || undefined,
    tag: sp.get("tag") || undefined,
    geo: sp.get("geo") || undefined,
    agent: sp.get("agent") || undefined,
    balance: sp.get("balance") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
  };
  const filterQuery = sp.toString(); // включает office=<id> → для пагинации и «выбрать все»

  const dist: Record<string, number> = {};
  for (const st of LEAD_STATUSES) dist[st] = 0;
  for (const row of statusDistRaw) dist[row._id as LeadStatus] = row.n;
  const distRows = (Object.entries(dist) as [LeadStatus, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const distMax = Math.max(1, ...distRows.map(([, n]) => n));

  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - i * DAY).toISOString().slice(0, 10));
  const byDayMap = new Map(byDayRaw.map((d) => [d._id, d]));
  const sentSeries = days.map((d) => byDayMap.get(d)?.sent ?? 0);
  const depSeries = days.map((d) => byDayMap.get(d)?.deposits ?? 0);

  const conn = integration?.connState === "ok" ? { c: "ok", t: "Активна" } : integration?.connState === "err" ? { c: "err", t: "Ошибка" } : { c: "idle", t: "Пауза" };

  return (
    <>
      <div className="section-head">
        <Link href="/distribution" className="btn btn-ghost btn-sm"><ArrowLeft size={16} /> К офисам</Link>
        <Link href={`/leads?office=${officeId}`} className="btn btn-soft btn-sm">Работать с этими лидами →</Link>
      </div>

      {/* Шапка офиса */}
      <div className="card panel" style={{ marginBottom: 16 }}>
        <div className="int-head" style={{ marginBottom: 0 }}>
          <div className="int-logo" style={{ background: `linear-gradient(135deg,${office.color})` }}>{office.logoText}</div>
          <div>
            <div className="nm" style={{ fontSize: 17 }}>{office.name}</div>
            <div className="ty">{integration ? `${integration.name} · ${API_TYPE_LABEL[integration.apiType]}` : "нет коннектора"}</div>
          </div>
          <div className="int-meta">
            <span className={`conn ${conn.c}`}>● {conn.t}</span>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{integration?.sandbox ? "dry-run" : "боевой"}</div>
          </div>
        </div>
      </div>

      {/* KPI распределения */}
      <div className="kpi-grid">
        <div className="card kpi"><div className="ic i-blue"><Send size={20} /></div><div className="lbl">Отправлено лидов</div><div className="val">{s.sent}</div><div className="delta"><span className="muted" style={{ fontWeight: 500 }}>в работе {s.inWork}</span></div></div>
        <div className="card kpi"><div className="ic i-green"><DollarSign size={20} /></div><div className="lbl">Закрылось (депозит)</div><div className="val">{s.deposits}</div><div className="delta up">▲ FTD</div></div>
        <div className="card kpi"><div className="ic i-amber"><Flame size={20} /></div><div className="lbl">Слив</div><div className="val" style={{ color: s.churn ? "var(--red)" : undefined }}>{s.churn}</div><div className="delta"><span className="muted" style={{ fontWeight: 500 }}>wrong / отказ / reject</span></div></div>
        <div className="card kpi"><div className="ic i-purple"><TrendingUp size={20} /></div><div className="lbl">Конверсия</div><div className="val">{s.conversion}%</div><div className="delta"><span className="muted" style={{ fontWeight: 500 }}>доставка {s.successPct}%</span></div></div>
      </div>

      <div className="grid-2">
        <div className="card panel">
          <div className="panel-head">
            <div><h3>Динамика по дням</h3><div className="muted" style={{ fontSize: 12 }}>Отправлено и депозиты · 14 дней</div></div>
            <div className="legend"><span><i style={{ background: "var(--accent)" }} />Отправлено</span><span><i style={{ background: "var(--green)" }} />Депозиты</span></div>
          </div>
          <div className="chart-wrap"><AreaChart leads={sentSeries} deps={depSeries} /></div>
        </div>
        <div className="card panel">
          <div className="panel-head"><h3>Статусы лидов в офисе</h3><span className="chip src">{s.sent}</span></div>
          {distRows.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Лидов в этом офисе нет.</div>}
          {distRows.map(([st, n]) => (
            <div className="funnel-row" key={st}>
              <div className="fl">{LEAD_STATUS_LABEL[st]}</div>
              <div className="funnel-bar">
                <span className={`badge ${LEAD_STATUS_BADGE[st]}`} style={{ width: `${Math.max(8, (n / distMax) * 100)}%`, background: "var(--surface-3)", borderRadius: 7, color: "var(--text)" }}>{n}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-title">Лиды, отправленные в {office.name} · live-статусы</div>
      <LeadsFilters
        current={current}
        tags={(tagsRaw as (string | null)[]).filter(Boolean).sort() as string[]}
        agents={agents.map((a) => ({ id: String(a._id), name: a.name }))}
        offices={[]}
        geos={(geosRaw as (string | null)[]).filter(Boolean).sort() as string[]}
        exportHref={`/api/leads/export?${filterQuery}`}
        basePath={`/distribution/${officeId}`}
        hideOffice
      />
      <LeadsTable leads={views} total={total} page={page} pageSize={PAGE_SIZE} query={filterQuery} basePath={`/distribution/${officeId}`} />
    </>
  );
}
