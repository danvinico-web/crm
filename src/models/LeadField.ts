import mongoose, { Schema, type Model, type Types } from "mongoose";

/** Определение кастомного поля лида (напр. «Воронка», «Реклама»). */
export interface ILeadField {
  _id: Types.ObjectId;
  key: string; // машинный ключ, напр. "funnel"
  label: string; // подпись, напр. "Воронка"
  order: number;
  createdAt: Date;
}

const LeadFieldSchema = new Schema<ILeadField>({
  key: { type: String, required: true, unique: true, trim: true },
  label: { type: String, required: true, trim: true },
  order: { type: Number, default: 100 },
  createdAt: { type: Date, default: Date.now },
});

const LeadField: Model<ILeadField> =
  mongoose.models.LeadField || mongoose.model<ILeadField>("LeadField", LeadFieldSchema);
export default LeadField;
