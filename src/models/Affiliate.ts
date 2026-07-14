import mongoose, { Schema, type Model, type Types } from "mongoose";

export type AffiliateStatus = "active" | "review" | "paused";

/** Аффилиат — источник трафика. Лиды связываются с ним по метке (tag / sub_id). */
export interface IAffiliate {
  _id: Types.ObjectId;
  name: string;
  tag: string; // метка аффилиата, напр. "aff_karl"
  platform: string; // "Meta Ads", "Google", "Taboola"…
  status: AffiliateStatus;
  cpa: number; // выплата аффилиату за один успешный лид (FTD/депозит), USD
  // API-доступ: приём лидов и получение статусов по внешнему API (см. lib/apiKey).
  apiKeyHash?: string; // blindIndex(ключ) — для поиска аффилиата по предъявленному ключу
  apiKeyEnc?: string; // encrypt(ключ) — для показа админу (reveal)
  apiKeyPrefix?: string; // первые символы ключа для отображения без раскрытия
  apiKeyCreatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AffiliateSchema = new Schema<IAffiliate>(
  {
    name: { type: String, required: true, trim: true },
    tag: { type: String, required: true, unique: true, trim: true },
    platform: { type: String, default: "" },
    status: { type: String, enum: ["active", "review", "paused"], default: "active" },
    cpa: { type: Number, default: 0 },
    apiKeyHash: { type: String, index: true, unique: true, sparse: true },
    apiKeyEnc: { type: String },
    apiKeyPrefix: { type: String },
    apiKeyCreatedAt: { type: Date },
  },
  { timestamps: true },
);

const Affiliate: Model<IAffiliate> =
  mongoose.models.Affiliate || mongoose.model<IAffiliate>("Affiliate", AffiliateSchema);
export default Affiliate;
