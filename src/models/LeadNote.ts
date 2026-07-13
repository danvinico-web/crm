import mongoose, { Schema, type Model, type Types } from "mongoose";

/** Комментарий к лиду (из импорта клиента или добавленный агентом/пользователем). */
export interface ILeadNote {
  _id: Types.ObjectId;
  lead: Types.ObjectId;
  text: string;
  author: string; // "Импорт" | имя пользователя | "Источник"
  source: "import" | "user" | "external";
  createdAt: Date;
}

const LeadNoteSchema = new Schema<ILeadNote>({
  lead: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
  text: { type: String, required: true },
  author: { type: String, default: "—" },
  source: { type: String, enum: ["import", "user", "external"], default: "user" },
  createdAt: { type: Date, default: Date.now, index: true },
});

const LeadNote: Model<ILeadNote> =
  mongoose.models.LeadNote || mongoose.model<ILeadNote>("LeadNote", LeadNoteSchema);
export default LeadNote;
