import mongoose from "mongoose";
import { blindIndex } from "@/lib/crypto";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { LEAD_STATUSES } from "@/lib/enums";

/**
 * Строит Mongo-фильтр лидов из query-параметров. Используется списком лидов
 * и экспортом, чтобы фильтрация была единообразной.
 * Параметры: q, status, tag, agent, geo, balance(=deposit), from, to.
 */
export function buildLeadFilter(sp: URLSearchParams): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  const status = sp.get("status");
  if (status && (LEAD_STATUSES as readonly string[]).includes(status)) filter.status = status;

  const tag = sp.get("tag");
  if (tag) filter.affiliateTag = tag;

  const geo = sp.get("geo");
  if (geo) filter.geo = geo.toUpperCase();

  const agent = sp.get("agent");
  if (agent === "none") filter.agent = null;
  else if (agent && mongoose.isValidObjectId(agent)) filter.agent = new mongoose.Types.ObjectId(agent);

  const office = sp.get("office");
  if (office === "none") filter.office = null;
  else if (office && mongoose.isValidObjectId(office)) filter.office = new mongoose.Types.ObjectId(office);

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
