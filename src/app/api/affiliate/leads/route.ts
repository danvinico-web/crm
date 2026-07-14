import { NextResponse } from "next/server";
import Lead from "@/models/Lead";
import { decryptNullable } from "@/lib/crypto";
import { ingestAffiliateLead } from "@/lib/intake";
import { getStatusDefs } from "@/lib/statuses";
import { statusMetaMap, statusLabelOf } from "@/lib/enums";
import { maskEmail, maskPhone } from "@/lib/apiKey";
import {
  authenticateAffiliate,
  affiliateApiHandler,
  parseBody,
  parseDateBound,
} from "@/lib/affiliateApi";

export const dynamic = "force-dynamic";

/**
 * Публичный API аффилиата (аутентификация: Authorization: Bearer <key> или ?api_token=).
 *
 *   POST /api/affiliate/leads   — загрузить лид
 *     body (JSON или form): name | first_name+last_name, email, phone, geo|country,
 *                           comment, custom {...}
 *     → 201 { ok:true, lead:{ id, ref, status, outcome } }
 *     → 422 { ok:false, error, errors:[...] } при ошибке валидации
 *
 *   GET  /api/affiliate/leads   — статусы лидов аффилиата
 *     query: from=YYYY-MM-DD, to=YYYY-MM-DD, status=<KEY>, ref=<num>, limit=1..500
 *     → 200 { ok:true, affiliate:{...}, count, leads:[{ id, ref, name, email, phone, geo, status, status_label, created_at }] }
 */

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

export async function POST(req: Request) {
  return affiliateApiHandler(async () => {
    const url = new URL(req.url);
    const aff = await authenticateAffiliate(req, url);
    const payload = await parseBody(req);

    const result = await ingestAffiliateLead({ tag: aff.tag }, payload);

    if (result.outcome === "rejected") {
      return NextResponse.json(
        { ok: false, error: "Validation failed", errors: result.errors ?? [] },
        { status: 422 },
      );
    }

    // Нейтральный ответ: НЕ раскрываем outcome/status и не различаем 201/200.
    // Дедуп в persistLead глобальный (по всем аффилиатам), поэтому разница
    // created/duplicate была бы оракулом существования контакта в чужих лидах.
    // Аффилиат видит статус своих лидов позже через GET (в рамках своей метки).
    return NextResponse.json(
      { ok: true, lead: { id: result.leadId, ref: result.ref } },
      { status: 201 },
    );
  });
}

export async function GET(req: Request) {
  return affiliateApiHandler(async () => {
    const url = new URL(req.url);
    const aff = await authenticateAffiliate(req, url);
    const sp = url.searchParams;

    // Фильтры.
    const query: Record<string, unknown> = { affiliateTag: aff.tag };
    const from = parseDateBound(sp.get("from"), false);
    const to = parseDateBound(sp.get("to"), true);
    if (from || to) {
      query.createdAt = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }
    const status = sp.get("status");
    if (status) query.status = status.trim();
    const ref = sp.get("ref");
    if (ref && /^\d+$/.test(ref)) query.refId = Number(ref);

    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get("limit")) || DEFAULT_LIMIT));

    const [defs, leads] = await Promise.all([
      getStatusDefs(),
      Lead.find(query)
        .select("fullNameEnc emailEnc phoneEnc geo status refId createdAt")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);
    const meta = statusMetaMap(defs);

    return NextResponse.json({
      ok: true,
      affiliate: { id: String(aff._id), name: aff.name, tag: aff.tag },
      count: leads.length,
      leads: leads.map((l) => ({
        id: String(l._id),
        ref: l.refId,
        name: decryptNullable(l.fullNameEnc) ?? "",
        email: maskEmail(decryptNullable(l.emailEnc)) ?? null,
        phone: maskPhone(decryptNullable(l.phoneEnc)) ?? null,
        geo: l.geo ?? null,
        status: l.status,
        status_label: statusLabelOf(l.status, meta),
        created_at: l.createdAt,
      })),
    });
  });
}
