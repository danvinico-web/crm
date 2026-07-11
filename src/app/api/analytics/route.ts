import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Lead, Delivery, Office } from "@/models";
import { apiHandler, requireUser } from "@/lib/rbac";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/enums";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

function parseDate(s: string | null, fallback: Date, endOfDay = false): Date {
  if (!s) return fallback;
  const d = new Date(s);
  if (isNaN(d.getTime())) return fallback;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Аналитика за период (по дате отгрузки Lead.sentAt).
 *   GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&officeIds=a,b
 */
export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireUser();
    await dbConnect();

    const url = new URL(req.url);
    const to = parseDate(url.searchParams.get("to"), new Date(), true);
    const from = parseDate(url.searchParams.get("from"), new Date(Date.now() - 30 * DAY));
    const officeIds = (url.searchParams.get("officeIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && mongoose.isValidObjectId(s))
      .map((s) => new mongoose.Types.ObjectId(s));

    const officeMatch = officeIds.length ? { office: { $in: officeIds } } : {};
    const sentMatch = { sentAt: { $gte: from, $lte: to }, office: { $ne: null }, ...officeMatch };

    const [byOfficeLeads, byDelivery, byDay, statusDistRaw, offices] = await Promise.all([
      Lead.aggregate([
        { $match: sentMatch },
        { $group: { _id: "$office", sent: { $sum: 1 }, deposits: { $sum: { $cond: [{ $eq: ["$status", "DEPOSIT"] }, 1, 0] } } } },
      ]),
      Delivery.aggregate([
        { $match: { sentAt: { $gte: from, $lte: to }, ...officeMatch } },
        {
          $group: {
            _id: "$office",
            total: { $sum: 1 },
            accepted: { $sum: { $cond: [{ $eq: ["$status", "ACCEPTED"] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $in: ["$status", ["REJECTED", "ERROR"]] }, 1, 0] } },
          },
        },
      ]),
      Lead.aggregate([
        { $match: sentMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$sentAt" } },
            sent: { $sum: 1 },
            deposits: { $sum: { $cond: [{ $eq: ["$status", "DEPOSIT"] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Lead.aggregate([{ $match: sentMatch }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
      Office.find().lean(),
    ]);

    const officeMap = new Map(offices.map((o) => [String(o._id), o]));
    const delMap = new Map(byDelivery.map((d) => [String(d._id), d]));

    const byOffice = byOfficeLeads
      .map((o) => {
        const office = officeMap.get(String(o._id));
        const del = delMap.get(String(o._id));
        return {
          officeId: String(o._id),
          name: office?.name ?? "—",
          color: office?.color ?? "#4f7cff,#6a5cff",
          sent: o.sent,
          accepted: del?.accepted ?? 0,
          rejected: del?.rejected ?? 0,
          deposits: o.deposits,
          conversion: o.sent ? Math.round((o.deposits / o.sent) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.sent - a.sent);

    const totals = byOffice.reduce(
      (acc, o) => {
        acc.sent += o.sent;
        acc.accepted += o.accepted;
        acc.deposits += o.deposits;
        return acc;
      },
      { sent: 0, accepted: 0, deposits: 0 },
    );

    const statusDist: Record<string, number> = {};
    for (const s of LEAD_STATUSES) statusDist[s] = 0;
    for (const row of statusDistRaw) statusDist[row._id as LeadStatus] = row.n;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        sent: totals.sent,
        accepted: totals.accepted,
        deposits: totals.deposits,
        conversion: totals.sent ? Math.round((totals.deposits / totals.sent) * 1000) / 10 : 0,
      },
      byOffice,
      byDay: byDay.map((d) => ({ date: d._id as string, sent: d.sent, deposits: d.deposits })),
      statusDist,
    };
  });
}
