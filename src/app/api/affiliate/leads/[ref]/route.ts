import { NextResponse } from "next/server";
import Lead from "@/models/Lead";
import { decryptNullable } from "@/lib/crypto";
import { getStatusDefs } from "@/lib/statuses";
import { statusMetaMap, statusLabelOf } from "@/lib/enums";
import { maskEmail, maskPhone } from "@/lib/apiKey";
import { authenticateAffiliate, affiliateApiHandler, enforceRateLimit, AffiliateApiError } from "@/lib/affiliateApi";

export const dynamic = "force-dynamic";

/**
 * GET /api/affiliate/leads/:ref — статус одного лида аффилиата по его номеру (refId).
 * Аутентификация — ТОЛЬКО Authorization: Bearer <key> (ключ в query не принимается).
 */
export async function GET(req: Request, { params }: { params: { ref: string } }) {
  return affiliateApiHandler(async () => {
    const aff = await authenticateAffiliate(req);
    enforceRateLimit(`ref:${aff._id}`, 300);

    if (!/^\d+$/.test(params.ref)) throw new AffiliateApiError(404, "Lead not found");

    const [defs, lead] = await Promise.all([
      getStatusDefs(),
      Lead.findOne({ refId: Number(params.ref), affiliateTag: aff.tag })
        .select("fullNameEnc emailEnc phoneEnc geo status refId createdAt updatedAt")
        .lean(),
    ]);
    if (!lead) throw new AffiliateApiError(404, "Lead not found");
    const meta = statusMetaMap(defs);

    return NextResponse.json({
      ok: true,
      lead: {
        id: String(lead._id),
        ref: lead.refId,
        name: decryptNullable(lead.fullNameEnc) ?? "",
        email: maskEmail(decryptNullable(lead.emailEnc)) ?? null,
        phone: maskPhone(decryptNullable(lead.phoneEnc)) ?? null,
        geo: lead.geo ?? null,
        status: lead.status,
        status_label: statusLabelOf(lead.status, meta),
        created_at: lead.createdAt,
        updated_at: lead.updatedAt,
      },
    });
  });
}
