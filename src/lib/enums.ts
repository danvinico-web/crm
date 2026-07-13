/** Перечисления домена LeadHub + маппинги на подписи и классы бейджей из дизайна. */

// Внутренние нормализованные статусы лида (внешние статусы CRM маппятся сюда).
export const LEAD_STATUSES = [
  "NEW",
  "SENT",
  "CALLBACK",
  "NO_ANSWER",
  "WRONG_INFO",
  "NOT_INTERESTED",
  "IN_PROGRESS",
  "DEPOSIT",
  "DUPLICATE",
  "REJECTED",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "Новый",
  SENT: "Отправлен",
  CALLBACK: "Перезвон",
  NO_ANSWER: "Нет ответа",
  WRONG_INFO: "Неверные данные",
  NOT_INTERESTED: "Отказ",
  IN_PROGRESS: "В работе",
  DEPOSIT: "Депозит",
  DUPLICATE: "Дубль",
  REJECTED: "Отклонён",
};

// Класс бейджа из globals.css (b-new/b-work/b-sent/b-dep/b-rej/b-off).
export const LEAD_STATUS_BADGE: Record<LeadStatus, string> = {
  NEW: "b-new",
  SENT: "b-sent",
  CALLBACK: "b-work",
  NO_ANSWER: "b-work",
  WRONG_INFO: "b-rej",
  NOT_INTERESTED: "b-off",
  IN_PROGRESS: "b-work",
  DEPOSIT: "b-dep",
  DUPLICATE: "b-rej",
  REJECTED: "b-off",
};

/** Статусы, при которых лид «активен» и его стоит опрашивать/дораспределять. */
export const ACTIVE_LEAD_STATUSES: LeadStatus[] = [
  "NEW",
  "SENT",
  "CALLBACK",
  "NO_ANSWER",
  "IN_PROGRESS",
];

/** Терминальные статусы — дальнейший поллинг не нужен. */
export const TERMINAL_LEAD_STATUSES: LeadStatus[] = [
  "WRONG_INFO",
  "NOT_INTERESTED",
  "DEPOSIT",
  "DUPLICATE",
  "REJECTED",
];

export const DELIVERY_STATUSES = [
  "PENDING",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "ERROR",
  "RETRYING",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const SOURCE_TYPES = [
  "GOOGLE_SHEET",
  "GOOGLE_FORM",
  "QUIZ",
  "WEBHOOK",
  "CSV",
  "API",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  GOOGLE_SHEET: "Google Таблица",
  GOOGLE_FORM: "Google Форма",
  QUIZ: "Квиз / опросник",
  WEBHOOK: "Webhook",
  CSV: "CSV-загрузка",
  API: "API",
};

export const API_TYPES = ["REST_JSON", "FORM_URLENCODED", "XML"] as const;
export type ApiType = (typeof API_TYPES)[number];

export const API_TYPE_LABEL: Record<ApiType, string> = {
  REST_JSON: "REST API (JSON)",
  FORM_URLENCODED: "Form (urlencoded)",
  XML: "HTTP POST (XML)",
};

export const EVENT_SOURCES = ["CALLBACK", "POLL", "MANUAL", "SYSTEM"] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

/**
 * Определение статуса лида — клиентобезопасный тип. Статусы теперь редактируемы
 * и хранятся в БД (LeadStatusDef); enum выше остаётся дефолтным набором и фолбэком.
 */
export interface StatusDef {
  key: string;
  label: string;
  badge: string; // класс бейджа (b-new/b-work/b-sent/b-dep/b-rej/b-off)
  order: number;
  active: boolean; // выключенные не показываются в фильтрах/пикерах, но остаются на старых лидах
  isTerminal: boolean; // терминальные не опрашиваются дальше
  isSystem: boolean; // встроенные нельзя удалять (только переименовать/скрыть)
}

/** Дефолтные определения статусов из enum — сид БД и клиентский фолбэк. */
export const DEFAULT_STATUS_DEFS: StatusDef[] = LEAD_STATUSES.map((k, i) => ({
  key: k,
  label: LEAD_STATUS_LABEL[k],
  badge: LEAD_STATUS_BADGE[k],
  order: i,
  active: true,
  isTerminal: TERMINAL_LEAD_STATUSES.includes(k),
  isSystem: true,
}));

/** Доступные классы бейджей для выбора цвета кастомного статуса. */
export const STATUS_BADGE_OPTIONS: { value: string; label: string }[] = [
  { value: "b-new", label: "Синий" },
  { value: "b-sent", label: "Фиолетовый" },
  { value: "b-work", label: "Оранжевый" },
  { value: "b-dep", label: "Зелёный" },
  { value: "b-rej", label: "Красный" },
  { value: "b-off", label: "Серый" },
];

/** Подпись статуса из карты определений с фолбэком на дефолт/ключ. */
export function statusLabelOf(key: string, meta?: Record<string, StatusDef>): string {
  return meta?.[key]?.label ?? LEAD_STATUS_LABEL[key as LeadStatus] ?? key;
}

/** Класс бейджа статуса из карты определений с фолбэком. */
export function statusBadgeOf(key: string, meta?: Record<string, StatusDef>): string {
  return meta?.[key]?.badge ?? LEAD_STATUS_BADGE[key as LeadStatus] ?? "b-off";
}

/** Строит карту key→StatusDef, дополняя дефолтами (для устойчивого рендера). */
export function statusMetaMap(defs: StatusDef[] | undefined): Record<string, StatusDef> {
  const map: Record<string, StatusDef> = {};
  for (const d of DEFAULT_STATUS_DEFS) map[d.key] = d;
  for (const d of defs ?? []) map[d.key] = d;
  return map;
}
