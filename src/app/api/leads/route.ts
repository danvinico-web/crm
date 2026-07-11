import { dbConnect } from "@/lib/db";
import { Lead } from "@/models";
import { apiHandler, requireUser } from "@/lib/rbac";
import { decryptNullable } from "@/lib/crypto";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/enums";

export const dynamic = "force-dynamic";

/** Компактный список лидов (id, статус, имя). Поддерживает ?status= и ?limit=. */
export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireUser();
    await dbConnect();
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const limit = Math.min(200, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50);

    const filter: Record<string, unknown> = {};
    if (statusParam && (LEAD_STATUSES as readonly string[]).includes(statusParam)) {
      filter.status = statusParam as LeadStatus;
    }

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
