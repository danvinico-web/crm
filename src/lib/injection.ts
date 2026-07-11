import type { HydratedDocument } from "mongoose";
import Lead, { type ILead, type ILeadMethods } from "@/models/Lead";
import Integration, { type IIntegration } from "@/models/Integration";
import Delivery from "@/models/Delivery";
import StatusEvent from "@/models/StatusEvent";
import { decrypt } from "@/lib/crypto";
import { sendToCrm, splitName, type CrmConfig, type OutboundLead } from "@/lib/crm/client";
import type { DeliveryStatus } from "@/lib/enums";

export interface SendOutcome {
  leadId: string;
  ok: boolean;
  deliveryStatus: DeliveryStatus;
  externalId?: string;
  error?: string;
}

const METHOD_BY_API: Record<string, string> = {
  REST_JSON: "API POST",
  FORM_URLENCODED: "Form POST",
  XML: "XML POST",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Строит конфиг клиента из документа интеграции (расшифровывает ключ). */
export function integrationToConfig(integration: IIntegration): CrmConfig {
  return {
    apiType: integration.apiType,
    baseUrl: integration.baseUrl,
    sendPath: integration.sendPath,
    statusPath: integration.statusPath,
    authScheme: integration.authScheme,
    authKeyName: integration.authKeyName,
    apiKey: decrypt(integration.apiKeyEnc),
    fieldMappings: integration.fieldMappings,
    sandbox: integration.sandbox,
  };
}

/**
 * Отгружает один лид в офис через его активную интеграцию.
 * Ретраи с backoff; сохраняет Delivery, обновляет лид и историю статусов.
 */
export async function sendLeadToOffice(
  lead: HydratedDocument<ILead, ILeadMethods>,
  integration: IIntegration & { _id: unknown },
): Promise<SendOutcome> {
  const cfg = integrationToConfig(integration);
  const contact = lead.contact();
  const { firstName, lastName } = splitName(contact.fullName);
  const outbound: OutboundLead = {
    fullName: contact.fullName,
    firstName,
    lastName,
    email: contact.email,
    phone: contact.phone,
    geo: lead.geo,
    affiliateTag: lead.affiliateTag,
  };

  const maxAttempts = cfg.sandbox ? 1 : 3;
  const backoff = [0, 400, 1200];
  let result = await sendToCrm(outbound, cfg);
  let attempts = 1;
  while (!result.ok && attempts < maxAttempts) {
    await sleep(backoff[attempts] ?? 1500);
    result = await sendToCrm(outbound, cfg);
    attempts++;
  }

  const deliveryStatus: DeliveryStatus = result.ok
    ? "ACCEPTED"
    : result.httpStatus && result.httpStatus >= 400 && result.httpStatus < 500
      ? "REJECTED"
      : "ERROR";

  await Delivery.create({
    lead: lead._id,
    integration: integration._id,
    office: integration.office,
    status: deliveryStatus,
    method: METHOD_BY_API[cfg.apiType] ?? "API POST",
    requestBody: result.requestBody,
    responseBody: result.responseBody,
    externalId: result.externalId,
    httpStatus: result.httpStatus,
    attempts,
    error: result.error,
    sentAt: new Date(),
  });

  if (result.ok) {
    lead.office = integration.office as ILead["office"];
    lead.externalId = result.externalId;
    lead.sentAt = new Date();
    if (lead.status === "NEW" || lead.status === "DUPLICATE") lead.status = "SENT";
    await lead.save();

    await StatusEvent.create({
      lead: lead._id,
      integration: integration._id,
      rawStatus: "sent",
      status: "SENT",
      source: "SYSTEM",
      note: "Отгружен в офис",
    });
  }

  return {
    leadId: String(lead._id),
    ok: result.ok,
    deliveryStatus,
    externalId: result.externalId,
    error: result.error,
  };
}

/** Находит активную интеграцию офиса. */
export async function activeIntegrationForOffice(officeId: string): Promise<(IIntegration & { _id: unknown }) | null> {
  return Integration.findOne({ office: officeId, isActive: true });
}

/** Отгружает набор лидов в офис. Возвращает сводку. */
export async function sendLeadsToOffice(leadIds: string[], officeId: string) {
  const integration = await activeIntegrationForOffice(officeId);
  if (!integration) {
    return { error: "У офиса нет активной интеграции", results: [] as SendOutcome[] };
  }
  const results: SendOutcome[] = [];
  for (const id of leadIds) {
    const lead = await Lead.findById(id);
    if (!lead) continue;
    results.push(await sendLeadToOffice(lead, integration));
  }
  const sent = results.filter((r) => r.ok).length;
  return { sent, failed: results.length - sent, results };
}
