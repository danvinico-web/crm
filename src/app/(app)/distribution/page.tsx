import { dbConnect } from "@/lib/db";
import { requirePageRole } from "@/lib/rbac";
import { Office, Integration, Delivery, Lead } from "@/models";
import { decryptNullable } from "@/lib/crypto";
import { API_TYPE_LABEL } from "@/lib/enums";
import { officeSummaryMap, emptyOfficeSummary } from "@/lib/officeStats";
import DistributionTabs, { type OfficeCard, type LogRow } from "@/components/DistributionTabs";

export const dynamic = "force-dynamic";

export default async function DistributionPage() {
  await requirePageRole(["ADMIN"]);
  await dbConnect();

  const [offices, integrations, summary] = await Promise.all([
    Office.find().sort({ createdAt: 1 }).lean(),
    Integration.find().lean(),
    officeSummaryMap(),
  ]);
  const integByOffice = new Map(integrations.map((i) => [String(i.office), i]));

  const officeCards: OfficeCard[] = offices.map((o) => {
    const integ = integByOffice.get(String(o._id));
    const s = summary.get(String(o._id)) ?? emptyOfficeSummary();
    return {
      id: String(o._id),
      integrationId: integ ? String(integ._id) : null,
      name: o.name,
      logoText: o.logoText,
      color: o.color,
      crmName: integ?.name ?? "—",
      apiTypeLabel: integ ? API_TYPE_LABEL[integ.apiType] : "—",
      connState: integ?.connState ?? "idle",
      sandbox: integ?.sandbox ?? false,
      sent: s.sent,
      inWork: s.inWork,
      deposits: s.deposits,
      churn: s.churn,
      conversion: s.conversion,
      accepted: s.accepted,
      successPct: s.successPct,
    };
  });

  // Логи отправки — последние доставки с именем лида и офиса.
  const recent = await Delivery.find().sort({ sentAt: -1 }).limit(14).lean();
  const leadIds = [...new Set(recent.map((d) => String(d.lead)))];
  const leads = await Lead.find({ _id: { $in: leadIds } }).select("fullNameEnc").lean();
  const leadName = new Map(leads.map((l) => [String(l._id), decryptNullable(l.fullNameEnc) ?? "—"]));
  const officeName = new Map(offices.map((o) => [String(o._id), o.name]));

  const logs: LogRow[] = recent.map((d) => ({
    time: d.sentAt.toISOString(),
    leadName: leadName.get(String(d.lead)) ?? "—",
    office: officeName.get(String(d.office)) ?? "—",
    method: d.method,
    status: d.status,
    httpStatus: d.httpStatus,
    detail: d.externalId ? `lead_id: ${d.externalId}` : d.error ?? "—",
  }));

  return <DistributionTabs offices={officeCards} logs={logs} />;
}
