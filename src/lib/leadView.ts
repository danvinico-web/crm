import { decryptNullable } from "@/lib/crypto";

/** Сериализуемое представление лида для UI (PII расшифрованы на сервере). */
export interface LeadView {
  id: string;
  refId?: number;
  fullName: string;
  email?: string;
  phone?: string;
  geo?: string;
  affiliateTag?: string;
  balance: number;
  balanceRaw?: string;
  comment?: string;
  status: string;
  office?: string;
  officeColor?: string;
  agent?: string;
  custom?: Record<string, string>;
  createdAt: string;
  sentAt?: string;
}

export interface LeadLike {
  _id: unknown;
  refId?: number;
  fullNameEnc: string;
  emailEnc?: string;
  phoneEnc?: string;
  geo?: string;
  affiliateTag?: string;
  balance?: number;
  balanceRaw?: string;
  comment?: string;
  status: string;
  office?: unknown;
  agent?: unknown;
  custom?: Record<string, string>;
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
    refId: l.refId,
    fullName: decryptNullable(l.fullNameEnc) ?? "—",
    email: decryptNullable(l.emailEnc),
    phone: decryptNullable(l.phoneEnc),
    geo: l.geo,
    affiliateTag: l.affiliateTag,
    balance: l.balance ?? 0,
    balanceRaw: l.balanceRaw,
    comment: l.comment,
    status: l.status,
    office: officeId ? offices.get(officeId)?.name : undefined,
    officeColor: officeId ? offices.get(officeId)?.color : undefined,
    agent: agentId ? agents.get(agentId) : undefined,
    custom: (l.custom as Record<string, string>) ?? undefined,
    createdAt: l.createdAt.toISOString(),
    sentAt: l.sentAt ? l.sentAt.toISOString() : undefined,
  };
}
