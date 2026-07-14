import crypto from "node:crypto";
import { encrypt, decrypt, blindIndex } from "@/lib/crypto";

/**
 * API-ключи аффилиатов для приёма лидов по внешнему API.
 *
 * Формат ключа: `lh_ak_<48 hex>` (lh_ak = LeadHub Affiliate Key).
 * Храним три производные (сам ключ в БД не лежит открытым):
 *   - apiKeyHash — blindIndex(HMAC) для O(1)-поиска аффилиата по ключу;
 *   - apiKeyEnc  — encrypt() для показа ключа админу позже (reveal);
 *   - apiKeyPrefix — первые символы для отображения без раскрытия секрета.
 */

export const AFFILIATE_KEY_PREFIX = "lh_ak_";
const PREFIX_DISPLAY_LEN = AFFILIATE_KEY_PREFIX.length + 6; // "lh_ak_" + 6 симв.

export interface GeneratedApiKey {
  key: string; // открытый ключ — показывается один раз (и по reveal)
  apiKeyHash: string;
  apiKeyEnc: string;
  apiKeyPrefix: string;
  apiKeyCreatedAt: Date;
}

/** Генерирует новый API-ключ аффилиата и все производные для хранения. */
export function generateAffiliateApiKey(): GeneratedApiKey {
  const key = AFFILIATE_KEY_PREFIX + crypto.randomBytes(24).toString("hex");
  return {
    key,
    apiKeyHash: blindIndex(key),
    apiKeyEnc: encrypt(key),
    apiKeyPrefix: key.slice(0, PREFIX_DISPLAY_LEN),
    apiKeyCreatedAt: new Date(),
  };
}

/** Хэш для поиска аффилиата по предъявленному ключу (та же нормализация, что и при генерации). */
export function apiKeyLookupHash(key: string): string {
  return blindIndex(key.trim());
}

/** Достаёт ключ из запроса: заголовок `Authorization: Bearer <key>` или `?api_token=<key>`. */
export function extractApiKey(req: Request, url: URL): string {
  const auth = req.headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  const q = url.searchParams.get("api_token");
  return q ? q.trim() : "";
}

/** Расшифровывает сохранённый ключ (для reveal админом). undefined, если нет/битый. */
export function revealApiKey(apiKeyEnc?: string | null): string | undefined {
  if (!apiKeyEnc) return undefined;
  try {
    return decrypt(apiKeyEnc);
  } catch {
    return undefined;
  }
}

/** Маскирует email для отдачи во внешнее API: `jo***@example.com`. */
export function maskEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const user = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(2, user.length - 2))}@${domain}`;
}

/** Маскирует телефон: показываем код и последние 2 цифры, серединку прячем. */
export function maskPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const p = phone.trim();
  if (p.length <= 5) return "***";
  return `${p.slice(0, 3)}${"*".repeat(Math.max(2, p.length - 5))}${p.slice(-2)}`;
}
