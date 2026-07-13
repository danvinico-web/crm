import mongoose from "mongoose";
import { blindIndex } from "@/lib/crypto";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";

/** Разбивает мульти-значение фильтра ("NEW,CALLBACK") на непустые части. */
function multi(sp: URLSearchParams, key: string): string[] {
  const raw = sp.get(key);
  if (!raw) return [];
  return [...new Set(raw.split(",").map((v) => v.trim()).filter(Boolean))];
}

/** Условие равенства/принадлежности: одно значение → eq, несколько → $in. */
function eqOrIn<T>(values: T[]): T | { $in: T[] } | undefined {
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : { $in: values };
}

/**
 * Строит Mongo-фильтр лидов из query-параметров. Используется списком лидов
 * и экспортом, чтобы фильтрация была единообразной. Категориальные фильтры
 * (status/tag/geo/agent/office) поддерживают мультивыбор через запятую.
 * Параметры: q, status, tag, agent, geo, balance(=deposit), from, to.
 */
export function buildLeadFilter(sp: URLSearchParams): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  const statuses = multi(sp, "status");
  const statusCond = eqOrIn(statuses);
  if (statusCond !== undefined) filter.status = statusCond;

  const tagCond = eqOrIn(multi(sp, "tag"));
  if (tagCond !== undefined) filter.affiliateTag = tagCond;

  const geoCond = eqOrIn(multi(sp, "geo").map((g) => g.toUpperCase()));
  if (geoCond !== undefined) filter.geo = geoCond;

  // Агенты/офисы: "none" → null (без назначения), иначе ObjectId.
  const agentVals = multi(sp, "agent")
    .map((a) => (a === "none" ? null : mongoose.isValidObjectId(a) ? new mongoose.Types.ObjectId(a) : undefined))
    .filter((v) => v !== undefined) as (mongoose.Types.ObjectId | null)[];
  const agentCond = eqOrIn(agentVals);
  if (agentCond !== undefined) filter.agent = agentCond;

  const officeVals = multi(sp, "office")
    .map((o) => (o === "none" ? null : mongoose.isValidObjectId(o) ? new mongoose.Types.ObjectId(o) : undefined))
    .filter((v) => v !== undefined) as (mongoose.Types.ObjectId | null)[];
  const officeCond = eqOrIn(officeVals);
  if (officeCond !== undefined) filter.office = officeCond;

  if (sp.get("balance") === "deposit") filter.balance = { $gt: 0 };

  const from = sp.get("from");
  const to = sp.get("to");
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) { const d = new Date(from); if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); range.$gte = d; } }
    if (to) { const d = new Date(to); if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); range.$lte = d; } }
    if (Object.keys(range).length) filter.createdAt = range;
  }

  const q = sp.get("q")?.trim();
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const or: Record<string, unknown>[] = [
      { affiliateTag: { $regex: escaped, $options: "i" } },
      { externalId: { $regex: escaped, $options: "i" } },
      { geo: { $regex: `^${escaped}$`, $options: "i" } },
    ];
    // Поиск по 6-значному номеру лида (точное совпадение) — быстрый трекинг.
    if (/^\d{1,6}$/.test(q)) or.push({ refId: Number(q) });
    // Поиск по имени — по слепым индексам токенов (точное слово, напр. «Carlos»).
    const tokens = [...new Set(q.toLowerCase().split(/\s+/).filter((t) => t.length >= 2))];
    if (tokens.length) or.push({ nameTokensHash: { $in: tokens.map((t) => blindIndex(t)) } });
    // Поиск по зашифрованным email/телефону — через слепые индексы (точное совпадение).
    if (q.includes("@")) { const e = normalizeEmail(q); if (e) or.push({ emailHash: blindIndex(e) }); }
    if (/\d{5,}/.test(q)) { const p = normalizePhone(q); if (p) or.push({ phoneHash: blindIndex(p) }); }
    filter.$or = or;
  }

  return filter;
}
