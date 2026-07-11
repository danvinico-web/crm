import { dbConnect } from "@/lib/db";
import { Affiliate, Lead } from "@/models";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = { active: "b-dep", review: "b-work", paused: "b-off" };
const STATUS_LABEL: Record<string, string> = { active: "Активен", review: "Проверка", paused: "Пауза" };

export default async function AffiliatesPage() {
  await dbConnect();
  const affiliates = await Affiliate.find().sort({ createdAt: 1 }).lean();
  const stats = await Lead.aggregate<{ _id: string; leads: number; valid: number; ftd: number; payout: number }>([
    { $match: { affiliateTag: { $ne: null } } },
    {
      $group: {
        _id: "$affiliateTag",
        leads: { $sum: 1 },
        valid: { $sum: { $cond: [{ $ne: ["$status", "DUPLICATE"] }, 1, 0] } },
        ftd: { $sum: { $cond: [{ $eq: ["$status", "DEPOSIT"] }, 1, 0] } },
        payout: { $sum: "$balance" },
      },
    },
  ]);
  const statMap = new Map(stats.map((s) => [s._id, s]));

  return (
    <>
      <div className="section-head">
        <h2>Аффилиаты · источники трафика</h2>
      </div>

      <div className="card table-card">
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr><th>Аффилиат</th><th>Метка</th><th>Источник</th><th>Лиды</th><th>Валидные</th><th>FTD</th><th>Конверсия</th><th>Выплата</th><th>Статус</th></tr>
            </thead>
            <tbody>
              {affiliates.map((a) => {
                const st = statMap.get(a.tag);
                const leads = st?.leads ?? 0;
                const ftd = st?.ftd ?? 0;
                const conv = leads ? Math.round((ftd / leads) * 1000) / 10 : 0;
                return (
                  <tr key={String(a._id)}>
                    <td><b>{a.name}</b></td>
                    <td><span className="chip aff">{a.tag}</span></td>
                    <td className="muted">{a.platform}</td>
                    <td className="mono">{leads}</td>
                    <td className="mono">{st?.valid ?? 0}</td>
                    <td className="mono">{ftd}</td>
                    <td><span className={`badge ${conv >= 22 ? "b-dep" : conv >= 15 ? "b-work" : "b-rej"}`}>{conv}%</span></td>
                    <td className="bal">{formatMoney(st?.payout ?? 0)}</td>
                    <td><span className={`badge ${STATUS_BADGE[a.status]}`}>{STATUS_LABEL[a.status]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
