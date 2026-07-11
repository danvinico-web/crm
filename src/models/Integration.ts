import mongoose, { Schema, type Model, type Types } from "mongoose";
import { API_TYPES, type ApiType, LEAD_STATUSES, type LeadStatus } from "@/lib/enums";
import type { IFieldMap } from "@/models/Source";

export type AuthScheme = "header" | "query" | "body";
export type ConnState = "ok" | "err" | "idle";

export interface IStatusMap {
  externalValue: string; // "wrong info", "callback", ...
  internalValue: LeadStatus;
}

/** Коннектор к внешней CRM офиса (по API-ключу). Ключ и секрет — шифрованы at rest. */
export interface IIntegration {
  _id: Types.ObjectId;
  office: Types.ObjectId;
  name: string;
  apiType: ApiType;
  baseUrl: string;
  authScheme: AuthScheme;
  authKeyName: string; // "Authorization" | "api_key"
  apiKeyEnc: string; // ШИФРОВАННО
  sendPath: string; // "/api/leads"
  statusPath?: string; // endpoint получения статуса (для поллинга)
  callbackSecretEnc: string; // HMAC-секрет входящих callback (ШИФРОВАННО)
  fieldMappings: IFieldMap[]; // лид → поля их API
  statusMappings: IStatusMap[]; // внешние статусы → внутренние
  isActive: boolean;
  sandbox: boolean; // dry-run: не делать реальный HTTP, симулировать ответ
  connState: ConnState;
  createdAt: Date;
  updatedAt: Date;
}

const FieldMapSchema = new Schema<IFieldMap>(
  {
    externalField: { type: String, required: true },
    internalField: { type: String, required: true },
    transform: { type: String },
  },
  { _id: false },
);

const StatusMapSchema = new Schema<IStatusMap>(
  {
    externalValue: { type: String, required: true },
    internalValue: { type: String, enum: LEAD_STATUSES, required: true },
  },
  { _id: false },
);

const IntegrationSchema = new Schema<IIntegration>(
  {
    office: { type: Schema.Types.ObjectId, ref: "Office", required: true, index: true },
    name: { type: String, required: true, trim: true },
    apiType: { type: String, enum: API_TYPES, default: "REST_JSON" },
    baseUrl: { type: String, required: true },
    authScheme: { type: String, enum: ["header", "query", "body"], default: "header" },
    authKeyName: { type: String, default: "Authorization" },
    apiKeyEnc: { type: String, required: true },
    sendPath: { type: String, default: "/" },
    statusPath: { type: String },
    callbackSecretEnc: { type: String, required: true },
    fieldMappings: { type: [FieldMapSchema], default: [] },
    statusMappings: { type: [StatusMapSchema], default: [] },
    isActive: { type: Boolean, default: true },
    sandbox: { type: Boolean, default: false },
    connState: { type: String, enum: ["ok", "err", "idle"], default: "idle" },
  },
  { timestamps: true },
);

const Integration: Model<IIntegration> =
  mongoose.models.Integration || mongoose.model<IIntegration>("Integration", IntegrationSchema);
export default Integration;
