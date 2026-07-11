import { dbConnect } from "@/lib/db";
import { Office, Integration, Delivery, Lead } from "@/models";
import { decryptNullable } from "@/lib/crypto";
import { API_TYPE_LABEL } from "@/lib/enums";
import DistributionTabs, { type OfficeCard, type LogRow } from "@/components/DistributionTabs";

export const dynamic = "force-dynamic";

export default async function DistributionPage() {
  await dbConnect();

  const [offices, integrations] = await Promise.all([
    Office.find().sort({ createdAt: 1 }).lean(),
    Integration.find().lean(),
  ]);
  const integByOffice = new Map(integrations.map((i) => [String(i.office), i]));

  const stats = await Delivery.aggregate<{ _id: unknown; total: number; accepted: number }>([
    { $group: { _id: "$office", total: { $sum: 1 }, accepted: { $sum: { $cond: [{ $eq: ["$status", "ACCEPTED"] }, 1, 0] } } } },
  ]);
  const statMap = new Map(stats.map((s) => [String(s._id), s]));

  const officeCards: OfficeCard[] = offices.map((o) => {
    const integ = integByOffice.get(String(o._id));
    const st = statMap.get(String(o._id));
    const total = st?.total ?? 0;
    const accepted = st?.accepted ?? 0;
    return {
      id: String(o._id),
      name: o.name,
      logoText: o.logoText,
      color: o.color,
      crmName: integ?.name ?? "—",
      apiTypeLabel: integ ? API_TYPE_LABEL[integ.apiType] : "—",
      connState: integ?.connState ?? "idle",
      sandbox: integ?.sandbox ?? false,
      sent: total,
      accepted,
      successPct: total ? Math.round((accepted / total) * 100) : 0,
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
