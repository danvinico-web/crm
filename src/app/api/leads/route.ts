import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Lead, StatusEvent, AuditLog, LeadNote } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";
import { decryptNullable } from "@/lib/crypto";
import { leadScopeFilter, withScope } from "@/lib/leadScope";
import { normalizeEmail, normalizePhone, isValidEmail } from "@/lib/normalize";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  fullName: z.string().trim().min(2, "Укажите имя"),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  geo: z.string().trim().max(2).optional(),
  affiliateTag: z.string().trim().optional(),
  comment: z.string().trim().optional(),
  custom: z.record(z.string()).optional(),
});

/** Ручное создание лида (кнопка «Добавить лид»). */
export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireUser();
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    const d = parsed.data;
    const email = normalizeEmail(d.email);
    const phone = normalizePhone(d.phone);
    if (!email && !phone) throw new HttpError(422, "Нужен email или телефон");
    if (email && !isValidEmail(email)) throw new HttpError(422, "Некорректный email");

    await dbConnect();
    const custom = d.custom
      ? Object.fromEntries(Object.entries(d.custom).filter(([, v]) => v != null && v !== ""))
      : undefined;
    const enc = Lead.buildEncrypted({ fullName: d.fullName, email, phone, raw: { manual: true, by: me.id } });
    const lead = await Lead.create({
      ...enc,
      geo: d.geo ? d.geo.toUpperCase() : undefined,
      affiliateTag: d.affiliateTag,
      comment: d.comment,
      custom,
      sourceType: "API",
      status: "NEW",
      consent: { source: "manual", at: new Date() },
    });
    await StatusEvent.create({ lead: lead._id, rawStatus: "new", status: "NEW", source: "MANUAL", note: "Создан вручную" });
    if (d.comment) await LeadNote.create({ lead: lead._id, text: d.comment, author: me.name ?? "Пользователь", source: "user" });
    await AuditLog.create({ user: me.id, action: "lead.create", entity: "Lead", entityId: String(lead._id) });
    return { ok: true, leadId: String(lead._id) };
  });
}

/** Компактный список лидов (id, статус, имя). Поддерживает ?status= и ?limit=. */
export async function GET(req: Request) {
  return apiHandler(async () => {
    const me = await requireUser();
    await dbConnect();
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const limit = Math.min(200, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50);

    const base: Record<string, unknown> = {};
    if (statusParam) base.status = statusParam;
    const filter = withScope(base, await leadScopeFilter(me));

    const docs = await Lead.find(filter).sort({ createdAt: -1 }).limit(limit).select("fullNameEnc status office externalId sentAt").lean();
    return {
      leads: docs.map((l) => ({
        id: String(l._id),
        fullName: decryptNullable(l.fullNameEnc) ?? "—",
        status: l.status,
        office: l.office ? String(l.office) : null,
        externalId: l.externalId,
        sentAt: l.sentAt ?? null,
      })),
    };
  });
}
