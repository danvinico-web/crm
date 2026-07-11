/** Клиент-безопасные форматтеры (без node-зависимостей). */

/** ISO-код страны → эмодзи-флаг (региональные индикаторы). */
export function codeToFlag(code?: string): string {
  if (!code || code.length !== 2) return "🏳️";
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "🏳️";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const GRADIENTS = [
  "#4f7cff,#6a5cff",
  "#f5a524,#f5455c",
  "#25c281,#1fa86e",
  "#9b6dff,#6a5cff",
  "#4f7cff,#25c281",
  "#f5455c,#9b6dff",
  "#f5a524,#4f7cff",
  "#25c281,#4f7cff",
];

/** Стабильный градиент аватара по строке-сиду. */
export function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `linear-gradient(135deg,${GRADIENTS[h % GRADIENTS.length]})`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const dtf = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateShort(iso?: string): string {
  if (!iso) return "—";
  return dtf.format(new Date(iso)).replace(".", "");
}

const dateOnly = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
export function formatDate(iso?: string): string {
  if (!iso) return "—";
  return dateOnly.format(new Date(iso));
}

/** Денежный формат: $1 200 (пробел-разделитель тысяч). */
export function formatMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ");
}
