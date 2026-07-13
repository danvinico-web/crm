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
  },
  { timestamps: true },
);

const Affiliate: Model<IAffiliate> =
  mongoose.models.Affiliate || mongoose.model<IAffiliate>("Affiliate", AffiliateSchema);
export default Affiliate;
