/**
 * Простой in-memory rate limiter (fixed window). Хранит счётчики в памяти
 * процесса — достаточно для одного инстанса. Для нескольких инстансов/serverless
 * нужен общий стор (Redis/Upstash) — тогда заменить реализацию, интерфейс тот же.
 *
 * Ничего не логируем и не пишем на диск — только счётчики в оперативке.
 */

interface Bucket {
  count: number;
  resetAt: number; // ms
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** Периодически чистим протухшие корзины, чтобы Map не рос бесконечно. */
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
}

export interface RateResult {
  ok: boolean;
  retryAfter: number; // секунды до сброса окна (0, если ok)
}

/**
 * Разрешает не более `limit` обращений на `key` в окне `windowMs`.
 * Возвращает { ok:false, retryAfter } при превышении.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}
