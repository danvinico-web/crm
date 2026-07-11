import { decryptNullable } from "@/lib/crypto";
import type { LeadStatus } from "@/lib/enums";

/** Сериализуемое представление лида для UI (PII расшифрованы на сервере). */
export interface LeadView {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  geo?: string;
  affiliateTag?: string;
  balance: number;
  comment?: string;
  status: LeadStatus;
  office?: string;
  officeColor?: string;
  agent?: string;
  createdAt: string;
  sentAt?: string;
}

export interface LeadLike {
  _id: unknown;
  fullNameEnc: string;
  emailEnc?: string;
  phoneEnc?: string;
  geo?: string;
  affiliateTag?: string;
  balance?: number;
  comment?: string;
  status: LeadStatus;
  office?: unknown;
  agent?: unknown;
  createdAt: Date;
  sentAt?: Date | null;
}

export interface OfficeMeta {
  name: string;
  color: string;
}

export function leadToView(
  l: LeadLike,
  offices: Map<string, OfficeMeta>,
  agents: Map<string, string>,
): LeadView {
  const officeId = l.office ? String(l.office) : undefined;
  const agentId = l.agent ? String(l.agent) : undefined;
  return {
    id: String(l._id),
    fullName: decryptNullable(l.fullNameEnc) ?? "—",
    email: decryptNullable(l.emailEnc),
    phone: decryptNullable(l.phoneEnc),
    geo: l.geo,
    affiliateTag: l.affiliateTag,
    balance: l.balance ?? 0,
    comment: l.comment,
    status: l.status,
    office: officeId ? offices.get(officeId)?.name : undefined,
    officeColor: officeId ? offices.get(officeId)?.color : undefined,
    agent: agentId ? agents.get(agentId) : undefined,
    createdAt: l.createdAt.toISOString(),
    sentAt: l.sentAt ? l.sentAt.toISOString() : undefined,
  };
}
