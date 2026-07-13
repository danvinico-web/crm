import { dbConnect } from "@/lib/db";
import { requirePageRole } from "@/lib/rbac";
import { Affiliate, Lead, Payout } from "@/models";
import AffiliatesManager, { type AffiliateRow } from "@/components/AffiliatesManager";

export const dynamic = "force-dynamic";

export default async function AffiliatesPage() {
  await requirePageRole(["ADMIN", "USER"]);
  await dbConnect();

  const [affiliates, stats, paidAgg] = await Promise.all([
    Affiliate.find().sort({ createdAt: 1 }).lean(),
    Lead.aggregate<{ _id: string; leads: number; valid: number; ftd: number }>([
      { $match: { affiliateTag: { $ne: null } } },
      {
        $group: {
          _id: "$affiliateTag",
          leads: { $sum: 1 },
          valid: { $sum: { $cond: [{ $ne: ["$status", "DUPLICATE"] }, 1, 0] } },
          ftd: { $sum: { $cond: [{ $eq: ["$status", "DEPOSIT"] }, 1, 0] } },
        },
      },
    ]),
    Payout.aggregate<{ _id: unknown; paid: number }>([{ $group: { _id: "$affiliate", paid: { $sum: "$amount" } } }]),
  ]);
  const statMap = new Map(stats.map((s) => [s._id, s]));
  const paidMap = new Map(paidAgg.map((p) => [String(p._id), p.paid]));

  const rows: AffiliateRow[] = affiliates.map((a) => {
    const st = statMap.get(a.tag);
    const leads = st?.leads ?? 0;
    const ftd = st?.ftd ?? 0;
    const cpa = a.cpa ?? 0;
    const earned = ftd * cpa;
    const paid = paidMap.get(String(a._id)) ?? 0;
    return {
      id: String(a._id),
      name: a.name,
      tag: a.tag,
      platform: a.platform,
      status: a.status,
      cpa,
      leads,
      valid: st?.valid ?? 0,
      ftd,
      conv: leads ? Math.round((ftd / leads) * 1000) / 10 : 0,
      earned,
      paid,
      awaiting: Math.max(0, earned - paid),
    };
  });

  return <AffiliatesManager rows={rows} />;
}
