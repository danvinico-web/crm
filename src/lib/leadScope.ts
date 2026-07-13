import Agent from "@/models/Agent";
import type { SessionUser } from "@/lib/rbac";

/**
 * Mongo-фильтр видимости лидов по роли:
 * - ADMIN — все лиды ({});
 * - AGENT — только назначенные на его агента;
 * - USER  — лиды агентов, которыми он владеет (куратор).
 */
export async function leadScopeFilter(user: SessionUser): Promise<Record<string, unknown>> {
  if (user.role === "ADMIN") return {};
  if (user.role === "AGENT") {
    const agent = await Agent.findOne({ user: user.id }).select("_id").lean();
    return agent ? { agent: agent._id } : { agent: { $in: [] } };
  }
  // USER — агенты под его кураторством
  const agents = await Agent.find({ owner: user.id }).select("_id").lean();
  return { agent: { $in: agents.map((a) => a._id) } };
}

/** Пересекает пользовательский фильтр со скоупом (скоуп нельзя обойти). */
export function withScope(
  base: Record<string, unknown>,
  scope: Record<string, unknown>,
): Record<string, unknown> {
  return Object.keys(scope).length ? { $and: [base, scope] } : base;
}

export function canSeeAllLeads(user: SessionUser): boolean {
  return user.role === "ADMIN";
}

export function canDistribute(user: SessionUser): boolean {
  return user.role === "ADMIN";
}
