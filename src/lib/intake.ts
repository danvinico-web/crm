import Lead from "@/models/Lead";
import StatusEvent from "@/models/StatusEvent";
import type { ISource, IFieldMap } from "@/models/Source";
import type { Types } from "mongoose";
import { normalizeEmail, normalizePhone, isValidEmail } from "@/lib/normalize";
import { blindIndex } from "@/lib/crypto";
import type { SourceType } from "@/lib/enums";

/** Открытые (расшифрованные) внутренние поля лида после маппинга/нормализации. */
export interface MappedLead {
  fullName: string;
  email?: string;
  phone?: string;
  geo?: string;
  affiliateTag?: string;
}

export type IntakeOutcome = "created" | "duplicate" | "idempotent" | "rejected";

export interface IntakeResult {
  outcome: IntakeOutcome;
  leadId?: string;
  reason?: string;
  errors?: string[];
}

const DEFAULT_DEDUP_DAYS = 30;
const DAY = 86_400_000;

// Синонимы входных ключей, если у источника не задан явный маппинг.
const DEFAULT_KEYS: Record<keyof MappedLead, string[]> = {
  fullName: ["fullName", "full_name", "name", "имя", "fio"],
  email: ["email", "e-mail", "mail", "почта"],
  phone: ["phone", "phone_e164", "tel", "telephone", "телефон"],
  geo: ["geo", "country", "гео", "страна"],
  affiliateTag: ["affiliateTag", "aff", "aff_id", "aff_sub", "sub_id", "publisher", "метка"],
};

function applyTransform(value: string, transform?: string): string {
  if (!transform) return value;
  if (transform === "lower") return value.toLowerCase();
  if (transform === "phone_e164") return normalizePhone(value) ?? value;
  return value;
}

/** Приводит произвольный payload к внутренним полям лида по маппингу источника. */
export function mapPayload(payload: Record<string, unknown>, mappings: IFieldMap[]): MappedLead {
  const out: Record<string, string> = {};

  if (mappings && mappings.length > 0) {
    for (const m of mappings) {
      const raw = payload[m.externalField];
      if (raw == null || raw === "") continue;
      out[m.internalField] = applyTransform(String(raw), m.transform);
    }
  } else {
    // Маппинг не задан — пробуем распознать поля по синонимам.
    for (const [internal, keys] of Object.entries(DEFAULT_KEYS)) {
      for (const k of keys) {
        const v = payload[k];
        if (v != null && v !== "") {
          out[internal] = String(v);
          break;
        }
      }
    }
  }

  return {
    fullName: (out.fullName ?? "").trim(),
    email: normalizeEmail(out.email),
    phone: normalizePhone(out.phone),
    geo: out.geo ? out.geo.trim().toUpperCase().slice(0, 2) : undefined,
    affiliateTag: out.affiliateTag?.trim(),
  };
}

/** Проверка обязательных полей. */
export function validateMapped(m: MappedLead): string[] {
  const errors: string[] = [];
  if (!m.fullName) errors.push("Отсутствует имя (fullName)");
  if (!m.email && !m.phone) errors.push("Нужен хотя бы email или телефон");
  if (m.email && !isValidEmail(m.email)) errors.push("Некорректный email");
  return errors;
}

/** Приводит кастомные поля к Record<string,string>, отбрасывая пустые. */
function sanitizeCustom(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null || v === "") continue;
    out[k] = String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Полный пайплайн приёма одного лида: маппинг → нормализация → валидация →
 * идемпотентность → дедуп → создание. Используется вебхуком и CSV-импортом.
 */
export async function runIntake(
  source: Pick<ISource, "type" | "fieldMappings" | "config"> & { _id: Types.ObjectId },
  payload: Record<string, unknown>,
): Promise<IntakeResult> {
  const mapped = mapPayload(payload, source.fieldMappings);
  const errors = validateMapped(mapped);
  if (errors.length > 0) {
    return { outcome: "rejected", errors };
  }

  const emailHash = mapped.email ? blindIndex(mapped.email) : undefined;
  const phoneHash = mapped.phone ? blindIndex(mapped.phone) : undefined;
  const hashOr: Record<string, string>[] = [];
  if (emailHash) hashOr.push({ emailHash });
  if (phoneHash) hashOr.push({ phoneHash });

  // 1) Идемпотентность: тот же источник + тот же контакт в пределах суток.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  if (hashOr.length > 0) {
    const same = await Lead.findOne({
      source: source._id,
      createdAt: { $gte: startOfDay },
      $or: hashOr,
    })
      .select("_id")
      .lean();
    if (same) {
      return { outcome: "idempotent", leadId: String(same._id) };
    }
  }

  // 2) Дедуп: совпадение по контакту в окне (по любому источнику).
  const dedupDays = Number((source.config as Record<string, unknown>)?.dedupDays) || DEFAULT_DEDUP_DAYS;
  let isDuplicate = false;
  if (hashOr.length > 0) {
    const dup = await Lead.findOne({
      createdAt: { $gte: new Date(Date.now() - dedupDays * DAY) },
      $or: hashOr,
    })
      .select("_id")
      .lean();
    if (dup) isDuplicate = true;
  }

  // Комментарий, баланс и кастомные поля из payload (напр. при импорте базы клиента).
  const comment = typeof payload.comment === "string" ? payload.comment.trim() : undefined;
  // Баланс/капитал импортируется «как есть» (может быть диапазоном: «$1000-10,000»).
  const balanceRawVal = payload.balance;
  const balanceRaw =
    balanceRawVal != null && String(balanceRawVal).trim() !== "" ? String(balanceRawVal).trim() : undefined;
  const custom = sanitizeCustom(payload.custom);

  // 3) Создание.
  const enc = Lead.buildEncrypted({
    fullName: mapped.fullName,
    email: mapped.email,
    phone: mapped.phone,
    raw: payload,
  });
  const lead = await Lead.create({
    ...enc,
    geo: mapped.geo,
    affiliateTag: mapped.affiliateTag,
    comment: comment || undefined,
    balanceRaw,
    custom,
    source: source._id,
    sourceType: source.type as SourceType,
    status: isDuplicate ? "DUPLICATE" : "NEW",
    consent: { source: "intake", at: new Date() },
  });

  // Импортированный комментарий сохраняем и в ленту комментариев лида.
  if (comment) {
    const { default: LeadNote } = await import("@/models/LeadNote");
    await LeadNote.create({ lead: lead._id, text: comment, author: "Импорт", source: "import" });
  }

  await StatusEvent.create({
    lead: lead._id,
    rawStatus: isDuplicate ? "duplicate" : "new",
    status: isDuplicate ? "DUPLICATE" : "NEW",
    source: "SYSTEM",
    note: isDuplicate ? "Дубль по email/телефону в окне дедупа" : "Принят из источника",
  });

  // Авто-роутинг: если есть включённые правила — отгрузить сразу.
  if (!isDuplicate) {
    try {
      const { autoRoute } = await import("@/lib/routing");
      await autoRoute(lead);
    } catch {
      /* авто-роутинг не критичен для приёма */
    }
  }

  return { outcome: isDuplicate ? "duplicate" : "created", leadId: String(lead._id) };
}
