import { NextResponse } from "next/server";
import Affiliate from "@/models/Affiliate";
import type { IAffiliate } from "@/models/Affiliate";
import { dbConnect } from "@/lib/db";
import { extractApiKey, apiKeyLookupHash } from "@/lib/apiKey";
import { rateLimit } from "@/lib/rateLimit";
import type { Document } from "mongoose";

// Лимиты публичного API аффилиата (окно — 1 минута).
const WINDOW_MS = 60_000;
const IP_LIMIT = 300; // на IP (анти-перебор ключей / спам), до аутентификации
const MAX_BODY_BYTES = 64 * 1024; // тело лида крошечное; 64 КБ с запасом

/** Ошибка публичного API аффилиата: единый JSON `{ ok:false, error }`. */
export class AffiliateApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number, // секунды, для заголовка Retry-After (429)
  ) {
    super(message);
  }
}

export type AffiliateDoc = Document & IAffiliate;

/** Клиентский IP из заголовков прокси (x-forwarded-for / x-real-ip). */
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Проверяет rate limit по ключу; бросает 429 с Retry-After при превышении. */
export function enforceRateLimit(key: string, limit: number, windowMs: number = WINDOW_MS): void {
  const r = rateLimit(key, limit, windowMs);
  if (!r.ok) throw new AffiliateApiError(429, "Too many requests", r.retryAfter);
}

/**
 * Аутентификация аффилиата по API-ключу — ТОЛЬКО заголовок `Authorization: Bearer`.
 * Перед проверкой ключа применяет rate limit по IP (защита от перебора).
 * Бросает AffiliateApiError с корректным HTTP-статусом.
 */
export async function authenticateAffiliate(req: Request): Promise<AffiliateDoc> {
  enforceRateLimit(`ip:${clientIp(req)}`, IP_LIMIT);

  const key = extractApiKey(req);
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
      const headers: Record<string, string> = {};
      if (err.status === 429 && err.retryAfter) headers["Retry-After"] = String(err.retryAfter);
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status, headers });
    }
    // Логируем ТОЛЬКО класс ошибки — ни тела запроса, ни PII, ни стека в логи не пишем.
    // eslint-disable-next-line no-console
    console.error("[affiliate-api] request failed:", err instanceof Error ? err.name : "unknown");
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  });
}

/** Читает тело с жёстким лимитом размера (защита от DoS большим телом). */
async function readBodyBounded(req: Request, maxBytes: number): Promise<string> {
  const cl = req.headers.get("content-length");
  if (cl && Number(cl) > maxBytes) throw new AffiliateApiError(413, "Request body too large");

  const stream = req.body;
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > maxBytes) {
        await reader.cancel();
        throw new AffiliateApiError(413, "Request body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Разбирает тело запроса: JSON или x-www-form-urlencoded (с лимитом размера). */
export async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const raw = (await readBodyBounded(req, MAX_BODY_BYTES)).trim();
  if (!raw) return {};
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
