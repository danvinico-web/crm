import mongoose, { Schema, type Model, type Types } from "mongoose";
import { EVENT_SOURCES, type EventSource, LEAD_STATUSES, type LeadStatus } from "@/lib/enums";

/** Событие изменения статуса лида (история + источник real-time апдейтов). */
export interface IStatusEvent {
  _id: Types.ObjectId;
  lead: Types.ObjectId;
  integration?: Types.ObjectId | null;
  rawStatus: string; // как прислала внешняя CRM
  status: LeadStatus; // нормализованный
  source: EventSource;
  note?: string;
  payload?: unknown;
  createdAt: Date;
}

const StatusEventSchema = new Schema<IStatusEvent>({
  lead: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
  integration: { type: Schema.Types.ObjectId, ref: "Integration", default: null },
  rawStatus: { type: String, default: "" },
  status: { type: String, enum: LEAD_STATUSES, required: true },
  source: { type: String, enum: EVENT_SOURCES, default: "CALLBACK" },
  note: { type: String },
  payload: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true },
});

const StatusEvent: Model<IStatusEvent> =
  mongoose.models.StatusEvent || mongoose.model<IStatusEvent>("StatusEvent", StatusEventSchema);
export default StatusEvent;
