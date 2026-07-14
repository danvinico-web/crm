import { NextResponse } from "next/server";
import Affiliate from "@/models/Affiliate";
import type { IAffiliate } from "@/models/Affiliate";
import { dbConnect } from "@/lib/db";
import { extractApiKey, apiKeyLookupHash } from "@/lib/apiKey";
import type { Document } from "mongoose";

/** Ошибка публичного API аффилиата: единый JSON `{ ok:false, error }`. */
export class AffiliateApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type AffiliateDoc = Document & IAffiliate;

/**
 * Аутентификация аффилиата по API-ключу (заголовок Bearer или ?api_token=).
 * Бросает AffiliateApiError с корректным HTTP-статусом.
 */
export async function authenticateAffiliate(req: Request, url: URL): Promise<AffiliateDoc> {
  const key = extractApiKey(req, url);
  if (!key) throw new AffiliateApiError(401, "Missing API key (Authorization: Bearer <key>)");

  await dbConnect();
  const aff = (await Affiliate.findOne({ apiKeyHash: apiKeyLookupHash(key) })) as AffiliateDoc | null;
  if (!aff) throw new AffiliateApiError(401, "Invalid API key");
  if (aff.status === "paused") throw new AffiliateApiError(403, "Affiliate is paused");
  return aff;
}

/** Оборачивает обработчик публичного API: ловит AffiliateApiError, отдаёт JSON. */
export function affiliateApiHandler(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((err) => {
    if (err instanceof AffiliateApiError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    // eslint-disable-next-line no-console
    console.error("[affiliate-api] unhandled", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  });
}

/** Разбирает тело запроса: JSON или x-www-form-urlencoded. */
export async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const raw = await req.text();
  if (!raw.trim()) return {};
  const ct = req.headers.get("content-type") ?? "";

  if (ct.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  if (ct.includes("application/json")) {
    // Явный JSON — битое тело должно давать 400, а не «тихо» превращаться в мусор.
    try {
      return JSON.parse(raw);
    } catch {
      throw new AffiliateApiError(400, "Malformed JSON body");
    }
  }
  // Content-Type не указан — пробуем JSON, затем urlencoded (best-effort).
  try {
    return JSON.parse(raw);
  } catch {
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

/**
 * from=YYYY-MM-DD → начало дня; to=YYYY-MM-DD → конец дня, В UTC (createdAt в БД
 * хранится в UTC). Суффикс `Z` фиксирует часовой пояс, иначе строка трактуется
 * в локальном TZ сервера и границы дня «съезжают» на его offset.
 */
export function parseDateBound(value: string | null, end: boolean): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return isNaN(d.getTime()) ? null : d;
}
