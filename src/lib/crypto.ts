import crypto from "node:crypto";

/**
 * Шифрование данных at rest (AES-256-GCM) + «слепые индексы» (HMAC-SHA256).
 *
 * - encrypt/decrypt — для секретов (API-ключи офисов, секреты вебхуков) и PII
 *   лидов (имя/email/телефон). Формат: `v1:base64(iv[12] | tag[16] | ciphertext)`.
 * - blindIndex — детерминированный HMAC от нормализованного значения. Позволяет
 *   искать и дедуплицировать зашифрованные email/телефон, не расшифровывая их.
 *
 * Ключи берутся из env: ENCRYPTION_KEY и BLIND_INDEX_KEY (по 32 байта в base64).
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = "v1:";

function readKey(name: "ENCRYPTION_KEY" | "BLIND_INDEX_KEY"): Buffer {
  const raw = process.env[name];
  if (!raw) {
    throw new Error(
      `${name} не задан. Заполни .env.local (см. .env.example): ${name}=$(openssl rand -base64 32)`,
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`${name} должен декодироваться из base64 ровно в 32 байта (сейчас ${key.length}).`);
  }
  return key;
}

// Ленивая инициализация — чтобы отсутствие env не падало на этапе импорта модуля.
let _encKey: Buffer | null = null;
let _biKey: Buffer | null = null;
const encKey = () => (_encKey ??= readKey("ENCRYPTION_KEY"));
const biKey = () => (_biKey ??= readKey("BLIND_INDEX_KEY"));

/** Зашифровать строку. Возвращает самоописывающийся токен `v1:...`. */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, encKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Расшифровать токен, созданный encrypt(). Бросает, если данные подделаны. */
export function decrypt(token: string): string {
  if (!token.startsWith(PREFIX)) {
    throw new Error("Неизвестный формат шифртекста (ожидался префикс v1:).");
  }
  const buf = Buffer.from(token.slice(PREFIX.length), "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function encryptNullable(value?: string | null): string | undefined {
  if (value == null || value === "") return undefined;
  return encrypt(value);
}

export function decryptNullable(token?: string | null): string | undefined {
  if (!token) return undefined;
  try {
    return decrypt(token);
  } catch {
    return undefined;
  }
}

/** Признак «строка уже зашифрована нашим форматом». */
export function isEncrypted(value?: string | null): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** HMAC-SHA256 подпись тела (hex). Для исходящих/тестовых вебхуков. */
export function hmacHex(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/** Проверка входящей HMAC-подписи вебхука (constant-time). */
export function verifyHmacHex(body: string, signature: string, secret: string): boolean {
  if (!signature) return false;
  const expected = hmacHex(body, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Слепой индекс для поиска/дедупа по зашифрованному значению. */
export function blindIndex(value: string): string {
  const norm = value.trim().toLowerCase();
  return crypto.createHmac("sha256", biKey()).update(norm).digest("hex");
}

export function blindIndexNullable(value?: string | null): string | undefined {
  if (value == null || value === "") return undefined;
  return blindIndex(value);
}
