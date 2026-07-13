import type { HydratedDocument } from "mongoose";
import RoutingRule, { type IRoutingConditions } from "@/models/RoutingRule";
import Lead, { type ILead, type ILeadMethods } from "@/models/Lead";
import { activeIntegrationForOffice, sendLeadToOffice } from "@/lib/injection";

/** Проверяет, подходит ли лид под условия правила. */
export function ruleMatches(cond: IRoutingConditions, lead: { affiliateTag?: string; geo?: string; balance?: number }): boolean {
  if (cond.affiliateTags.length > 0 && (!lead.affiliateTag || !cond.affiliateTags.includes(lead.affiliateTag))) return false;
  if (cond.geos.length > 0 && (!lead.geo || !cond.geos.includes(lead.geo.toUpperCase()))) return false;
  if (cond.balanceZero && (lead.balance ?? 0) !== 0) return false;
  return true;
}

/**
 * Авто-роутинг нового лида по включённым правилам (по приоритету).
 * Первое совпадение → отгрузка в офис правила. Возвращает officeId или null.
 */
export async function autoRoute(lead: HydratedDocument<ILead, ILeadMethods>): Promise<string | null> {
  const rules = await RoutingRule.find({ enabled: true }).sort({ priority: 1 }).lean();
  for (const rule of rules) {
    if (ruleMatches(rule.conditions, { affiliateTag: lead.affiliateTag, geo: lead.geo, balance: lead.balance })) {
      const integration = await activeIntegrationForOffice(String(rule.office));
      if (!integration) continue;
      await sendLeadToOffice(lead, integration);
      return String(rule.office);
    }
  }
  return null;
}

/** Обёртка: подгружает лид по id и роутит. */
export async function autoRouteById(leadId: string): Promise<string | null> {
  const lead = await Lead.findById(leadId);
  if (!lead) return null;
  return autoRoute(lead);
}
