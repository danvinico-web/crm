import mongoose, { Schema, type Model, type Types } from "mongoose";

/** Редактируемое определение статуса лида (хранится в БД, сеется из enum). */
export interface ILeadStatusDef {
  _id: Types.ObjectId;
  key: string; // стабильный идентификатор (NEW, CALLBACK, HOT…)
  label: string; // отображаемое название (редактируется)
  badge: string; // класс цвета бейджа
  order: number;
  active: boolean;
  isTerminal: boolean;
  isSystem: boolean; // встроенные нельзя удалять
  createdAt: Date;
  updatedAt: Date;
}

const LeadStatusDefSchema = new Schema<ILeadStatusDef>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    badge: { type: String, default: "b-off" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    isTerminal: { type: Boolean, default: false },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const LeadStatusDef: Model<ILeadStatusDef> =
  mongoose.models.LeadStatusDef || mongoose.model<ILeadStatusDef>("LeadStatusDef", LeadStatusDefSchema);
export default LeadStatusDef;
