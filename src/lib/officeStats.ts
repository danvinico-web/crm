import Lead from "@/models/Lead";
import Delivery from "@/models/Delivery";

const ACTIVE = ["SENT", "CALLBACK", "NO_ANSWER", "IN_PROGRESS"];
const CHURN = ["WRONG_INFO", "NOT_INTERESTED", "REJECTED"];

/** Сводка по офису для отслеживания распределённых лидов. */
export interface OfficeSummary {
  sent: number; // лидов у офиса (lead.office = X)
  inWork: number; // в работе (активные статусы)
  deposits: number; // закрылось (депозит/FTD)
  churn: number; // слив (wrong info / не интересно / отклонён)
  conversion: number; // deposits / sent, %
  accepted: number; // принято офисом (delivery ACCEPTED)
  rejected: number; // отклонено/ошибка доставки
  deliveries: number; // всего попыток доставки
  successPct: number; // accepted / deliveries, %
}

const EMPTY: OfficeSummary = { sent: 0, inWork: 0, deposits: 0, churn: 0, conversion: 0, accepted: 0, rejected: 0, deliveries: 0, successPct: 0 };

/** Карта officeId → сводка. Считает по текущему статусу лидов и по доставкам. */
export async function officeSummaryMap(): Promise<Map<string, OfficeSummary>> {
  const [leadAgg, delAgg] = await Promise.all([
    Lead.aggregate<{ _id: unknown; sent: number; inWork: number; deposits: number; churn: number }>([
      { $match: { office: { $ne: null } } },
      {
        $group: {
          _id: "$office",
          sent: { $sum: 1 },
          inWork: { $sum: { $cond: [{ $in: ["$status", ACTIVE] }, 1, 0] } },
          deposits: { $sum: { $cond: [{ $eq: ["$status", "DEPOSIT"] }, 1, 0] } },
          churn: { $sum: { $cond: [{ $in: ["$status", CHURN] }, 1, 0] } },
        },
      },
    ]),
    Delivery.aggregate<{ _id: unknown; deliveries: number; accepted: number; rejected: number }>([
      {
        $group: {
          _id: "$office",
          deliveries: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ["$status", "ACCEPTED"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $in: ["$status", ["REJECTED", "ERROR"]] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const delMap = new Map(delAgg.map((d) => [String(d._id), d]));
  const out = new Map<string, OfficeSummary>();

  for (const l of leadAgg) {
    const id = String(l._id);
    const del = delMap.get(id);
    out.set(id, {
      sent: l.sent,
      inWork: l.inWork,
      deposits: l.deposits,
      churn: l.churn,
      conversion: l.sent ? Math.round((l.deposits / l.sent) * 1000) / 10 : 0,
      accepted: del?.accepted ?? 0,
      rejected: del?.rejected ?? 0,
      deliveries: del?.deliveries ?? 0,
      successPct: del?.deliveries ? Math.round((del.accepted / del.deliveries) * 100) : 0,
    });
  }
  // Офисы с доставками, но без «текущих» лидов (например, все переназначены).
  for (const [id, del] of delMap) {
    if (out.has(id)) continue;
    out.set(id, { ...EMPTY, accepted: del.accepted, rejected: del.rejected, deliveries: del.deliveries, successPct: del.deliveries ? Math.round((del.accepted / del.deliveries) * 100) : 0 });
  }
  return out;
}

export function emptyOfficeSummary(): OfficeSummary {
  return { ...EMPTY };
}
