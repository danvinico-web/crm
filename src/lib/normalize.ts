/**
 * Нормализация контактных данных лида.
 * Телефон → упрощённый E.164 (+ и цифры), email → trim + lowercase.
 * Используется на приёме, для дедупа и для «слепых индексов».
 */

export function normalizeEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const e = email.trim().toLowerCase();
  return e || undefined;
}

/**
 * Приводит телефон к формату E.164-подобному: сохраняет ведущий «+», убирает
 * всё, кроме цифр. Ведущие «00» трактуются как международный префикс «+».
 * Это прагматичная нормализация без справочника стран (достаточно для дедупа).
 */
export function normalizePhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  let p = phone.trim();
  const hadPlus = p.startsWith("+");
  const digits = p.replace(/\D/g, "");
  if (!digits) return undefined;
  if (hadPlus) return "+" + digits;
  if (digits.startsWith("00")) return "+" + digits.slice(2);
  return "+" + digits;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
