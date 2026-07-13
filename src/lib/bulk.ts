import mongoose from "mongoose";
import { buildLeadFilter } from "@/lib/leadQuery";

/**
 * Резолвит целевой набор лидов для массового действия:
 * - либо явный список leadIds,
 * - либо ВСЕ лиды под текущим фильтром (allMatching + filter — строка query-параметров).
 * Возвращает Mongo-фильтр.
 */
export function resolveLeadFilter(body: {
  leadIds?: unknown;
  allMatching?: unknown;
  filter?: unknown;
}): Record<string, unknown> {
  if (body.allMatching === true && typeof body.filter === "string") {
    return buildLeadFilter(new URLSearchParams(body.filter));
  }
  const ids = Array.isArray(body.leadIds)
    ? (body.leadIds as unknown[]).filter((i): i is string => typeof i === "string" && mongoose.isValidObjectId(i))
    : [];
  return { _id: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) } };
}
