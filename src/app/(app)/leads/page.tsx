import { dbConnect } from "@/lib/db";
import { Lead, Office, Agent } from "@/models";
import { leadToView, type OfficeMeta, type LeadLike } from "@/lib/leadView";
import { buildLeadFilter } from "@/lib/leadQuery";
import LeadsTable from "@/components/LeadsTable";
import LeadsFilters, { type LeadFilterState } from "@/components/LeadsFilters";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await dbConnect();

  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v) sp.set(k, v);
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const filter = buildLeadFilter(sp);

  const [total, leadDocs, offices, agents, tagsRaw, geosRaw] = await Promise.all([
    Lead.countDocuments(filter),
    Lead.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Office.find().lean(),
    Agent.find().select("name").sort({ name: 1 }).lean(),
    Lead.distinct("affiliateTag"),
    Lead.distinct("geo"),
  ]);

  const officeMap = new Map<string, OfficeMeta>(offices.map((o) => [String(o._id), { name: o.name, color: o.color }]));
  const agentMap = new Map<string, string>(agents.map((a) => [String(a._id), a.name]));
  const views = leadDocs.map((l) => leadToView(l as unknown as LeadLike, officeMap, agentMap));

  const current: LeadFilterState = {
    q: sp.get("q") || undefined,
    status: sp.get("status") || undefined,
    tag: sp.get("tag") || undefined,
    geo: sp.get("geo") || undefined,
    agent: sp.get("agent") || undefined,
    office: sp.get("office") || undefined,
    balance: sp.get("balance") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
  };

  const exportSp = new URLSearchParams(sp);
  exportSp.delete("page");
  const filterQuery = exportSp.toString();

  return (
    <>
      <LeadsFilters
        current={current}
        tags={(tagsRaw as (string | null)[]).filter(Boolean).sort() as string[]}
        agents={agents.map((a) => ({ id: String(a._id), name: a.name }))}
        offices={offices.map((o) => ({ id: String(o._id), name: o.name }))}
        geos={(geosRaw as (string | null)[]).filter(Boolean).sort() as string[]}
        exportHref={`/api/leads/export${filterQuery ? "?" + filterQuery : ""}`}
      />
      <LeadsTable leads={views} total={total} page={page} pageSize={PAGE_SIZE} query={filterQuery} />
    </>
  );
}
