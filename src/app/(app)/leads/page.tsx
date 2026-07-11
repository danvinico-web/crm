import { Filter, Share2, Calendar, DollarSign, User, MapPin, Download, Upload } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { Lead, Office, Agent } from "@/models";
import { leadToView, type OfficeMeta, type LeadLike } from "@/lib/leadView";
import LeadsTable from "@/components/LeadsTable";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function LeadsPage({ searchParams }: { searchParams: { page?: string } }) {
  await dbConnect();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const total = await Lead.countDocuments();
  const [leadDocs, offices, agents] = await Promise.all([
    Lead.find().sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Office.find().lean(),
    Agent.find().lean(),
  ]);

  const officeMap = new Map<string, OfficeMeta>(
    offices.map((o) => [String(o._id), { name: o.name, color: o.color }]),
  );
  const agentMap = new Map<string, string>(agents.map((a) => [String(a._id), a.name]));

  const views = leadDocs.map((l) => leadToView(l as unknown as LeadLike, officeMap, agentMap));

  return (
    <>
      <div className="section-head">
        <div className="filter-row" style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <div className="filter on"><Filter size={14} /> Все статусы</div>
          <div className="filter"><Share2 size={14} /> Метка аффилиата</div>
          <div className="filter"><Calendar size={14} /> Дата</div>
          <div className="filter"><DollarSign size={14} /> Баланс</div>
          <div className="filter"><User size={14} /> Агент</div>
          <div className="filter"><MapPin size={14} /> Гео</div>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <a className="btn btn-ghost btn-sm" href="/import"><Download size={16} /> Импорт CSV</a>
          <button className="btn btn-ghost btn-sm"><Upload size={16} /> Экспорт</button>
        </div>
      </div>

      <LeadsTable leads={views} total={total} page={page} pageSize={PAGE_SIZE} />
    </>
  );
}
