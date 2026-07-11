import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { ArrowLeft, Phone, Mail, MapPin, Tag } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { Lead, Office, Agent, Source, StatusEvent, Delivery } from "@/models";
import { decryptNullable } from "@/lib/crypto";
import { LEAD_STATUS_BADGE, LEAD_STATUS_LABEL, type LeadStatus, type EventSource } from "@/lib/enums";
import { avatarGradient, initials, codeToFlag, formatDate, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const EVENT_SOURCE_LABEL: Record<EventSource, string> = {
  CALLBACK: "callback",
  POLL: "поллинг",
  MANUAL: "вручную",
  SYSTEM: "система",
};

const DELIVERY_BADGE: Record<string, string> = {
  ACCEPTED: "b-dep", SENT: "b-sent", PENDING: "b-off", RETRYING: "b-work", REJECTED: "b-rej", ERROR: "b-rej",
};

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  if (!mongoose.isValidObjectId(params.id)) notFound();
  await dbConnect();

  const lead = await Lead.findById(params.id).lean();
  if (!lead) notFound();

  const [office, agent, source, events, deliveries] = await Promise.all([
    lead.office ? Office.findById(lead.office).lean() : null,
    lead.agent ? Agent.findById(lead.agent).lean() : null,
    lead.source ? Source.findById(lead.source).lean() : null,
    StatusEvent.find({ lead: lead._id }).sort({ createdAt: -1 }).lean(),
    Delivery.find({ lead: lead._id }).sort({ sentAt: -1 }).lean(),
  ]);
  const officeNames = new Map((office ? [office] : []).map((o) => [String(o._id), o.name]));

  const fullName = decryptNullable(lead.fullNameEnc) ?? "—";
  const email = decryptNullable(lead.emailEnc);
  const phone = decryptNullable(lead.phoneEnc);
  const status = lead.status as LeadStatus;

  return (
    <>
      <div className="section-head">
        <Link href="/leads" className="btn btn-ghost btn-sm"><ArrowLeft size={16} /> К лидам</Link>
      </div>

      <div className="grid-2">
        {/* Карточка контакта */}
        <div className="card panel">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <div className="av-sm" style={{ width: 52, height: 52, fontSize: 18, background: avatarGradient(fullName) }}>{initials(fullName)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{fullName}</div>
              <div style={{ marginTop: 4 }}><span className={`badge ${LEAD_STATUS_BADGE[status]}`}>{LEAD_STATUS_LABEL[status]}</span></div>
            </div>
            <div className="bal" style={{ fontSize: 20, color: lead.balance ? "var(--green)" : "var(--text-dim)" }}>
              {lead.balance ? formatMoney(lead.balance) : "$0"}
            </div>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <Field icon={<Mail size={15} />} label="Email" value={email ?? "—"} />
            <Field icon={<Phone size={15} />} label="Телефон" value={phone ?? "—"} />
            <Field icon={<MapPin size={15} />} label="Гео" value={lead.geo ? `${codeToFlag(lead.geo)} ${lead.geo}` : "—"} />
            <Field icon={<Tag size={15} />} label="Метка аффилиата" value={lead.affiliateTag ?? "—"} />
          </div>
          <div className="int-body" style={{ marginTop: 18 }}>
            <div className="m"><div className="v" style={{ fontSize: 14 }}>{office?.name ?? "—"}</div><div className="k">офис</div></div>
            <div className="m"><div className="v" style={{ fontSize: 14 }}>{agent?.name ?? "—"}</div><div className="k">агент</div></div>
            <div className="m"><div className="v" style={{ fontSize: 14 }}>{source?.name ?? "—"}</div><div className="k">источник</div></div>
          </div>
          {lead.externalId && <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>Внешний ID: <span className="mono">{lead.externalId}</span></div>}
          {lead.comment && <div style={{ marginTop: 12, fontSize: 13 }}><span className="muted">Комментарий:</span> {lead.comment}</div>}
        </div>

        {/* Таймлайн статусов */}
        <div className="card panel">
          <div className="panel-head"><h3>История статусов</h3><span className="chip src">{events.length} событий</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {events.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Событий пока нет.</div>}
            {events.map((e, i) => {
              const st = e.status as LeadStatus;
              return (
                <div key={String(e._id)} style={{ display: "flex", gap: 12, paddingBottom: i === events.length - 1 ? 0 : 14, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, marginTop: 4 }} />
                    {i !== events.length - 1 && <div style={{ width: 2, flex: 1, background: "var(--border)", marginTop: 2 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className={`badge ${LEAD_STATUS_BADGE[st]}`}>{LEAD_STATUS_LABEL[st]}</span>
                      <span className="chip src">{EVENT_SOURCE_LABEL[e.source as EventSource]}</span>
                      {e.rawStatus && <span className="muted" style={{ fontSize: 12 }}>«{e.rawStatus}»</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                      {formatDate(e.createdAt.toISOString())} · {new Date(e.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      {e.note ? ` · ${e.note}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* История отгрузок */}
      <div className="card table-card">
        <div className="tbl-toolbar"><b style={{ fontSize: 14 }}>История отгрузок</b><span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>{deliveries.length} доставок</span></div>
        <div className="tbl-scroll">
          <table>
            <thead><tr><th>Время</th><th>Офис</th><th>Метод</th><th>Статус</th><th>Попыток</th><th>Ответ</th></tr></thead>
            <tbody>
              {deliveries.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 24 }}>Отгрузок не было.</td></tr>}
              {deliveries.map((d) => (
                <tr key={String(d._id)}>
                  <td className="mono muted">{formatDate(d.sentAt.toISOString())}</td>
                  <td>{officeNames.get(String(d.office)) ?? office?.name ?? "—"}</td>
                  <td><span className="chip src">{d.method}</span></td>
                  <td><span className={`badge ${DELIVERY_BADGE[d.status] ?? "b-off"}`}>{d.httpStatus ?? d.status}</span></td>
                  <td className="mono">{d.attempts}</td>
                  <td className="mono muted">{d.externalId ? `id: ${d.externalId}` : d.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ color: "var(--text-mute)" }}>{icon}</div>
      <div style={{ width: 130, color: "var(--text-dim)", fontSize: 12.5 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{value}</div>
    </div>
  );
}
