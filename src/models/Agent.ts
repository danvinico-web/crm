import mongoose, { Schema, type Model, type Types } from "mongoose";

/** Агент — член команды, обрабатывает лиды. Доменная сущность, не аккаунт входа. */
export interface IAgent {
  _id: Types.ObjectId;
  name: string;
  title: string; // «Team Lead», «Retention», «Sales agent»
  team?: Types.ObjectId | null;
  owner: Types.ObjectId; // пользователь-владелец
  isOnline: boolean;
  color: string; // градиент для аватара, напр. "#4f7cff,#6a5cff"
  capacity: number; // сколько лидов агент может вести (ёмкость) — база для «нагрузки»
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    name: { type: String, required: true, trim: true },
    title: { type: String, default: "Sales agent" },
    team: { type: Schema.Types.ObjectId, ref: "Team", default: null, index: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    isOnline: { type: Boolean, default: false },
    color: { type: String, default: "#4f7cff,#6a5cff" },
    capacity: { type: Number, default: 12 },
  },
  { timestamps: true },
);

const Agent: Model<IAgent> = mongoose.models.Agent || mongoose.model<IAgent>("Agent", AgentSchema);
export default Agent;
