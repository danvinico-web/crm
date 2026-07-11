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
    source: source._id,
    sourceType: source.type as SourceType,
    status: isDuplicate ? "DUPLICATE" : "NEW",
    consent: { source: "intake", at: new Date() },
  });

  await StatusEvent.create({
    lead: lead._id,
    rawStatus: isDuplicate ? "duplicate" : "new",
    status: isDuplicate ? "DUPLICATE" : "NEW",
    source: "SYSTEM",
    note: isDuplicate ? "Дубль по email/телефону в окне дедупа" : "Принят из источника",
  });

  return { outcome: isDuplicate ? "duplicate" : "created", leadId: String(lead._id) };
}
