import { Users, Send, DollarSign, TrendingUp, Check, ArrowUp, ArrowDownToLine, AlertTriangle } from "lucide-react";
import AreaChart from "@/components/AreaChart";
import { dbConnect } from "@/lib/db";
import { Lead, Affiliate, StatusEvent } from "@/models";
import { decryptNullable } from "@/lib/crypto";
import { formatMoney } from "@/lib/format";
import { LEAD_STATUS_LABEL, type LeadStatus, type EventSource } from "@/lib/enums";

export const dynamic = "force-dynamic";
const DAY = 86_400_000;

export default async function DashboardPage() {
  await dbConnect();

  const [total, sent, deposits, depositAgg, dupCount, inWork, byDayRaw, affAgg, affiliates, recentEvents] =
    await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ sentAt: { $ne: null } }),
      Lead.countDocuments({ status: "DEPOSIT" }),
      Lead.aggregate<{ _id: null; sum: number }>([{ $match: { status: "DEPOSIT" } }, { $group: { _id: null, sum: { $sum: "$balance" } } }]),
      Lead.countDocuments({ status: "DUPLICATE" }),
      Lead.countDocuments({ status: { $in: ["CALLBACK", "NO_ANSWER", "IN_PROGRESS", "SENT"] } }),
      Lead.aggregate<{ _id: string; leads: number; deposits: number }>([
        { $match: { createdAt: { $gte: new Date(Date.now() - 14 * DAY) } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            leads: { $sum: 1 },
            deposits: { $sum: { $cond: [{ $eq: ["$status", "DEPOSIT"] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Lead.aggregate<{ _id: string; leads: number; ftd: number; payout: number }>([
        { $match: { affiliateTag: { $ne: null } } },
        { $group: { _id: "$affiliateTag", leads: { $sum: 1 }, ftd: { $sum: { $cond: [{ $eq: ["$status", "DEPOSIT"] }, 1, 0] } }, payout: { $sum: "$balance" } } },
        { $sort: { leads: -1 } },
        { $limit: 4 },
      ]),
      Affiliate.find().lean(),
      StatusEvent.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);

  const depositSum = depositAgg[0]?.sum ?? 0;
  const conversion = sent ? Math.round((deposits / sent) * 1000) / 10 : 0;
  const valid = total - dupCount;

  // Ряды графика за 14 дней (заполняем пропуски нулями).
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - i * DAY).toISOString().slice(0, 10));
  const byDayMap = new Map(byDayRaw.map((d) => [d._id, d]));
  const leadsSeries = days.map((d) => byDayMap.get(d)?.leads ?? 0);
  const depsSeries = days.map((d) => byDayMap.get(d)?.deposits ?? 0);

  const affByTag = new Map(affiliates.map((a) => [a.tag, { name: a.name, cpa: a.cpa ?? 0 }]));
  const topAffiliates = affAgg.map((a) => {
    const info = affByTag.get(a._id);
    return {
      name: info?.name ?? a._id,
      tag: a._id,
      leads: a.leads,
      ftd: a.ftd,
      conv: a.leads ? Math.round((a.ftd / a.leads) * 1000) / 10 : 0,
      payout: a.ftd * (info?.cpa ?? 0), // выплата аффилиату = FTD × CPA
    };
  });

  const leadIds = [...new Set(recentEvents.map((e) => String(e.lead)))];
  const leads = await Lead.find({ _id: { $in: leadIds } }).select("fullNameEnc").lean();
  const leadName = new Map(leads.map((l) => [String(l._id), decryptNullable(l.fullNameEnc) ?? "—"]));

  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  return (
    <>
      <div className="kpi-grid">
        <div className="card kpi">
          <div className="ic i-blue"><Users size={20} /></div>
          <div className="lbl">Всего лидов</div>
          <div className="val">{total.toLocaleString("ru-RU")}</div>
          <div className="delta"><span className="muted" style={{ fontWeight: 500 }}>{valid.toLocaleString("ru-RU")} валидных</span></div>
        </div>
        <div className="card kpi">
          <div className="ic i-purple"><Send size={20} /></div>
          <div className="lbl">Отправлено в офисы</div>
          <div className="val">{sent.toLocaleString("ru-RU")}</div>
          <div className="delta"><span className="muted" style={{ fontWeight: 500 }}>{pct(sent, total)}% от базы</span></div>
        </div>
        <div className="card kpi">
          <div className="ic i-green"><DollarSign size={20} /></div>
          <div className="lbl">Депозиты (FTD)</div>
          <div className="val">{formatMoney(depositSum)}</div>
          <div className="delta up"><ArrowUp size={13} /> {deposits} FTD</div>
        </div>
        <div className="card kpi">
          <div className="ic i-amber"><TrendingUp size={20} /></div>
          <div className="lbl">Конверсия в FTD</div>
          <div className="val">{conversion}%</div>
          <div className="delta"><span className="muted" style={{ fontWeight: 500 }}>FTD / отправлено</span></div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card panel">
          <div className="panel-head">
            <div><h3>Поток лидов и депозиты</h3><div className="muted" style={{ fontSize: 12 }}>Последние 14 дней</div></div>
            <div className="legend">
              <span><i style={{ background: "var(--accent)" }} />Лиды</span>
              <span><i style={{ background: "var(--green)" }} />Депозиты</span>
            </div>
          </div>
          <div className="chart-wrap"><AreaChart leads={leadsSeries} deps={depsSeries} /></div>
        </div>
        <div className="card panel">
          <div className="panel-head"><h3>Воронка</h3><span className="chip src">всё время</span></div>
          <Funnel label="Загружено" value={total} max={total} grad="linear-gradient(90deg,#4f7cff,#6a5cff)" />
          <Funnel label="Валидные" value={valid} max={total} grad="linear-gradient(90deg,#4f7cff,#6a5cff)" />
          <Funnel label="Отправлены" value={sent} max={total} grad="linear-gradient(90deg,#7a6bff,#9b6dff)" />
          <Funnel label="В работе" value={inWork} max={total} grad="linear-gradient(90deg,#f5a524,#f5455c)" />
          <Funnel label="Депозит (FTD)" value={deposits} max={total} grad="linear-gradient(90deg,#25c281,#1fa86e)" />
        </div>
      </div>

      <div className="grid-2">
        <div className="card panel">
          <div className="panel-head"><h3>Топ аффилиатов</h3><a className="btn-soft btn btn-sm" href="/affiliates">Все аффилиаты</a></div>
          <div className="tbl-scroll">
            <table>
              <thead><tr><th>Аффилиат</th><th>Метка</th><th>Лиды</th><th>FTD</th><th>Конв.</th><th>Выплата</th></tr></thead>
              <tbody>
                {topAffiliates.map((a) => (
                  <tr key={a.tag}>
                    <td><b>{a.name}</b></td>
                    <td><span className="chip aff">{a.tag}</span></td>
                    <td className="mono">{a.leads}</td>
                    <td className="mono">{a.ftd}</td>
                    <td><span className={`badge ${a.conv >= 22 ? "b-dep" : a.conv >= 15 ? "b-work" : "b-rej"}`}>{a.conv}%</span></td>
                    <td className="bal">{formatMoney(a.payout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card panel">
          <div className="panel-head"><h3>Последняя активность</h3></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {recentEvents.map((e) => {
              const st = e.status as LeadStatus;
              const src = e.source as EventSource;
              const color = st === "DEPOSIT" ? "green" : st === "WRONG_INFO" || st === "REJECTED" ? "red" : src === "SYSTEM" ? "accent" : "amber";
              return (
                <Activity
                  key={String(e._id)}
                  color={color}
                  text={<><b>{leadName.get(String(e.lead)) ?? "лид"}</b> → {LEAD_STATUS_LABEL[st]}</>}
                  meta={`${src.toLowerCase()} · ${new Date(e.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function Funnel({ label, value, max, grad }: { label: string; value: number; max: number; grad: string }) {
  const width = max ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="funnel-row">
      <div className="fl">{label}</div>
      <div className="funnel-bar"><span style={{ width: `${width}%`, background: grad }}>{value.toLocaleString("ru-RU")}</span></div>
    </div>
  );
}

function Activity({ color, text, meta }: { color: string; text: React.ReactNode; meta: string }) {
  const soft: Record<string, string> = { green: "var(--green-soft)", amber: "var(--amber-soft)", accent: "var(--accent-soft)", red: "var(--red-soft)" };
  const fg: Record<string, string> = { green: "var(--green)", amber: "var(--amber)", accent: "var(--accent)", red: "var(--red)" };
  const icon = color === "green" ? <Check size={15} /> : color === "red" ? <AlertTriangle size={15} /> : color === "accent" ? <ArrowDownToLine size={15} /> : <ArrowUp size={15} />;
  return (
    <div className="rule" style={{ padding: "11px 0" }}>
      <div className="prio" style={{ background: soft[color], color: fg[color] }}>{icon}</div>
      <div className="cond">{text}<div className="muted" style={{ fontSize: 12 }}>{meta}</div></div>
    </div>
  );
}
