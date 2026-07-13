import { dbConnect } from "@/lib/db";
import { Lead, Office } from "@/models";
import { getSessionUser } from "@/lib/rbac";
import { decryptNullable } from "@/lib/crypto";
import { buildLeadFilter } from "@/lib/leadQuery";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/enums";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Экспорт отфильтрованных лидов в CSV (PII расшифровываются на сервере). */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  await dbConnect();
  const filter = buildLeadFilter(new URL(req.url).searchParams);
  const [leads, offices] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).limit(10000).lean(),
    Office.find().lean(),
  ]);
  const officeName = new Map(offices.map((o) => [String(o._id), o.name]));

  const header = ["Имя", "Email", "Телефон", "Гео", "Метка аффилиата", "Статус", "Баланс", "Офис", "Создан", "Отправлен"];
  const rows = leads.map((l) => [
    decryptNullable(l.fullNameEnc) ?? "",
    decryptNullable(l.emailEnc) ?? "",
    decryptNullable(l.phoneEnc) ?? "",
    l.geo ?? "",
    l.affiliateTag ?? "",
    LEAD_STATUS_LABEL[l.status as LeadStatus],
    l.balance ?? 0,
    l.office ? officeName.get(String(l.office)) ?? "" : "",
    l.createdAt.toISOString().slice(0, 10),
    l.sentAt ? l.sentAt.toISOString().slice(0, 10) : "",
  ]);

  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leadhub-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
