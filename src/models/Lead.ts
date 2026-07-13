import mongoose, { Schema, type Model, type Types } from "mongoose";
import { LEAD_STATUSES, type LeadStatus, type SourceType } from "@/lib/enums";
import { encrypt, decryptNullable, encryptNullable, blindIndex, blindIndexNullable } from "@/lib/crypto";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";

/** Слепые индексы токенов имени — для поиска по имени без расшифровки (точное слово). */
export function nameTokens(fullName: string): string[] {
  const tokens = [...new Set((fullName || "").toLowerCase().split(/\s+/).filter((t) => t.length >= 2))];
  return tokens.map((t) => blindIndex(t));
}

export interface ILeadConsent {
  source?: string; // из какого источника пришло согласие
  at?: Date;
}

export interface ILead {
  _id: Types.ObjectId;
  // PII — шифруется at rest
  fullNameEnc: string;
  emailEnc?: string;
  phoneEnc?: string;
  rawEnc?: string; // исходный payload источника (JSON, шифрованно)
  // Слепые индексы для поиска/дедупа без расшифровки
  emailHash?: string;
  phoneHash?: string;
  nameTokensHash?: string[]; // токены имени (поиск по имени)
  // Операционные (незашифрованные — нужны для фильтров/аналитики)
  geo?: string;
  affiliateTag?: string;
  balance: number;
  comment?: string;
  custom?: Record<string, string>; // кастомные поля клиента (воронка, реклама и т.п.)
  // Связи
  source?: Types.ObjectId | null;
  sourceType?: SourceType;
  office?: Types.ObjectId | null;
  agent?: Types.ObjectId | null;
  // Состояние
  status: LeadStatus;
  externalId?: string;
  sentAt?: Date | null;
  consent?: ILeadConsent;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeadContact {
  fullName: string;
  email?: string;
  phone?: string;
}

export interface ILeadInput {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  raw?: unknown;
}

export interface ILeadMethods {
  /** Расшифрованные контактные данные. */
  contact(): ILeadContact;
  /** Расшифрованный исходный payload. */
  rawPayload(): unknown;
}

export interface ILeadModel extends Model<ILead, object, ILeadMethods> {
  /** Собирает зашифрованные поля + слепые индексы из открытых данных. */
  buildEncrypted(input: ILeadInput): Partial<ILead>;
}

const ConsentSchema = new Schema<ILeadConsent>(
  { source: String, at: Date },
  { _id: false },
);

const LeadSchema = new Schema<ILead, ILeadModel, ILeadMethods>(
  {
    fullNameEnc: { type: String, required: true },
    emailEnc: { type: String },
    phoneEnc: { type: String },
    rawEnc: { type: String },
    emailHash: { type: String, index: true, sparse: true },
    phoneHash: { type: String, index: true, sparse: true },
    nameTokensHash: { type: [String], index: true, default: [] },
    geo: { type: String, index: true },
    affiliateTag: { type: String, index: true },
    balance: { type: Number, default: 0 },
    comment: { type: String },
    custom: { type: Schema.Types.Mixed, default: {} },
    source: { type: Schema.Types.ObjectId, ref: "Source", default: null },
    sourceType: { type: String },
    office: { type: Schema.Types.ObjectId, ref: "Office", default: null, index: true },
    agent: { type: Schema.Types.ObjectId, ref: "Agent", default: null, index: true },
    status: { type: String, enum: LEAD_STATUSES, default: "NEW", index: true },
    externalId: { type: String, index: true },
    sentAt: { type: Date, default: null, index: true },
    consent: { type: ConsentSchema },
  },
  { timestamps: true },
);

LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ office: 1, sentAt: 1 });

LeadSchema.methods.contact = function (this: ILead): ILeadContact {
  return {
    fullName: decryptNullable(this.fullNameEnc) ?? "",
    email: decryptNullable(this.emailEnc),
    phone: decryptNullable(this.phoneEnc),
  };
};

LeadSchema.methods.rawPayload = function (this: ILead): unknown {
  const raw = decryptNullable(this.rawEnc);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

LeadSchema.statics.buildEncrypted = function (input: ILeadInput): Partial<ILead> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  return {
    fullNameEnc: encrypt(input.fullName ?? ""),
    emailEnc: encryptNullable(email),
    phoneEnc: encryptNullable(phone),
    emailHash: blindIndexNullable(email),
    phoneHash: blindIndexNullable(phone),
    nameTokensHash: nameTokens(input.fullName ?? ""),
    rawEnc: input.raw !== undefined ? encryptNullable(JSON.stringify(input.raw)) : undefined,
  };
};

const Lead: ILeadModel =
  (mongoose.models.Lead as ILeadModel) || mongoose.model<ILead, ILeadModel>("Lead", LeadSchema);
export default Lead;
