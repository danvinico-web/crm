import type { ApiType } from "@/lib/enums";
import type { AuthScheme } from "@/models/Integration";
import type { IFieldMap } from "@/models/Source";

/** Внутренние поля лида, доступные для маппинга в исходящий payload. */
export interface OutboundLead {
  fullName: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  geo?: string;
  affiliateTag?: string;
}

/** Конфиг коннектора (расшифрованный ключ уже внутри). */
export interface CrmConfig {
  apiType: ApiType;
  baseUrl: string;
  sendPath: string;
  statusPath?: string;
  authScheme: AuthScheme;
  authKeyName: string;
  apiKey: string;
  fieldMappings: IFieldMap[];
  sandbox: boolean;
}

export interface SendResult {
  ok: boolean;
  externalId?: string;
  httpStatus?: number;
  requestBody: unknown;
  responseBody: unknown;
  error?: string;
}

export interface FetchStatusResult {
  ok: boolean;
  rawStatus?: string;
  responseBody: unknown;
  error?: string;
}

/** Разбивает полное имя на first/last. */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

/** Собирает payload внешней CRM из внутренних полей лида по маппингу. */
export function buildOutboundPayload(lead: OutboundLead, mappings: IFieldMap[]): Record<string, string> {
  const src: Record<string, string | undefined> = {
    fullName: lead.fullName,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    geo: lead.geo,
    affiliateTag: lead.affiliateTag,
  };
  const out: Record<string, string> = {};
  if (mappings.length === 0) {
    // Без маппинга — отдаём разумный дефолт.
    if (lead.firstName) out.first_name = lead.firstName;
    if (lead.lastName) out.last_name = lead.lastName;
    if (lead.email) out.email = lead.email;
    if (lead.phone) out.phone = lead.phone;
    if (lead.geo) out.country = lead.geo;
    if (lead.affiliateTag) out.aff_sub = lead.affiliateTag;
    return out;
  }
  for (const m of mappings) {
    const v = src[m.internalField];
    if (v != null && v !== "") out[m.externalField] = applyOutTransform(v, m.transform);
  }
  return out;
}

function applyOutTransform(value: string, transform?: string): string {
  if (!transform) return value;
  if (transform === "lower") return value.toLowerCase();
  if (transform === "upper") return value.toUpperCase();
  return value;
}

function toXml(payload: Record<string, string>): string {
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
  const fields = Object.entries(payload)
    .map(([k, v]) => `  <${k}>${esc(v)}</${k}>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<lead>\n${fields}\n</lead>`;
}

/** Ищет внешний ID лида в ответе внешней CRM по типичным ключам. */
export function extractExternalId(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  const candidates = [
    b.lead_id, b.leadId, b.id, b.external_id, b.externalId,
    b.contact_id, b.contactId, b.customer_id, b.customerId,
  ];
  const data = b.data as Record<string, unknown> | undefined;
  if (data) candidates.push(data.id, data.lead_id, data.contact_id, data.customer_id);
  const found = candidates.find((c) => c != null);
  return found != null ? String(found) : undefined;
}

/**
 * Отправляет лид во внешнюю CRM. В sandbox-режиме реальный HTTP не выполняется —
 * ответ симулируется (dry-run), что удобно для демо и тестов.
 */
export async function sendToCrm(lead: OutboundLead, cfg: CrmConfig): Promise<SendResult> {
  const payload = buildOutboundPayload(lead, cfg.fieldMappings);

  if (cfg.sandbox) {
    const externalId = "SBX-" + Math.random().toString(36).slice(2, 10).toUpperCase();
    return {
      ok: true,
      externalId,
      httpStatus: 200,
      requestBody: payload,
      responseBody: { simulated: true, lead_id: externalId, status: "accepted" },
    };
  }

  // Реальный HTTP.
  const url = new URL(cfg.baseUrl.replace(/\/$/, "") + cfg.sendPath);
  const headers: Record<string, string> = {};
  const bodyPayload = { ...payload };

  if (cfg.authScheme === "header") headers[cfg.authKeyName] = cfg.apiKey;
  else if (cfg.authScheme === "query") url.searchParams.set(cfg.authKeyName, cfg.apiKey);
  else if (cfg.authScheme === "body") bodyPayload[cfg.authKeyName] = cfg.apiKey;

  let body: string;
  if (cfg.apiType === "REST_JSON") {
    headers["Content-Type"] = "application/json";
    headers["Accept"] = "application/json";
    body = JSON.stringify(bodyPayload);
  } else if (cfg.apiType === "FORM_URLENCODED") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(bodyPayload).toString();
  } else {
    headers["Content-Type"] = "application/xml";
    body = toXml(bodyPayload);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url.toString(), { method: "POST", headers, body, signal: controller.signal });
    clearTimeout(timer);
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* оставляем как текст (напр. XML) */
    }
    // Некоторые CRM отвечают HTTP 200 с телом { success: false } —
    // считаем такой ответ ошибкой и достаём человекочитаемое сообщение.
    const p = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    const bodyOk = !(p && p.success === false);
    const ok = res.ok && bodyOk;
    let error: string | undefined;
    if (!ok) {
      if (p && typeof p.message === "string") error = p.message;
      else if (p && p.errors) error = JSON.stringify(p.errors);
      else error = `HTTP ${res.status}`;
    }
    return {
      ok,
      externalId: extractExternalId(parsed),
      httpStatus: res.status,
      requestBody: bodyPayload,
      responseBody: parsed,
      error,
    };
  } catch (err) {
    return {
      ok: false,
      requestBody: bodyPayload,
      responseBody: null,
      error: err instanceof Error ? err.message : "Ошибка запроса",
    };
  }
}

/** Получить статус лида из внешней CRM (для поллинга). */
export async function fetchCrmStatus(externalId: string, cfg: CrmConfig): Promise<FetchStatusResult> {
  if (cfg.sandbox) {
    return { ok: true, rawStatus: undefined, responseBody: { simulated: true } };
  }
  if (!cfg.statusPath) return { ok: false, responseBody: null, error: "statusPath не задан" };
  const url = new URL(cfg.baseUrl.replace(/\/$/, "") + cfg.statusPath);
  url.searchParams.set("id", externalId);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cfg.authScheme === "header") headers[cfg.authKeyName] = cfg.apiKey;
  else if (cfg.authScheme === "query") url.searchParams.set(cfg.authKeyName, cfg.apiKey);

  try {
    const res = await fetch(url.toString(), { headers });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* текст */
    }
    const b = (parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}) as Record<string, unknown>;
    const rawStatus = b.status ?? b.state ?? b.lead_status;
    return { ok: res.ok, rawStatus: rawStatus != null ? String(rawStatus) : undefined, responseBody: parsed };
  } catch (err) {
    return { ok: false, responseBody: null, error: err instanceof Error ? err.message : "Ошибка" };
  }
}
