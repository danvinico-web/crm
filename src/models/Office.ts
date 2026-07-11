import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * Office — получатель лидов (в спецификации «бренд»). В интерфейсе используется
 * слово «офис», как в макете. К офису привязаны коннекторы (Integration).
 */
export interface IOffice {
  _id: Types.ObjectId;
  name: string;
  code: string;
  logoText: string; // 2–3 буквы для плитки
  color: string; // градиент, напр. "#4f7cff,#6a5cff"
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OfficeSchema = new Schema<IOffice>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    logoText: { type: String, default: "OF" },
    color: { type: String, default: "#4f7cff,#6a5cff" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Office: Model<IOffice> = mongoose.models.Office || mongoose.model<IOffice>("Office", OfficeSchema);
export default Office;
