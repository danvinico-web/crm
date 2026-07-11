import mongoose, { Schema, type Model, type Types } from "mongoose";
import { DELIVERY_STATUSES, type DeliveryStatus } from "@/lib/enums";

/** Факт отгрузки лида в офис/интеграцию + запрос/ответ. */
export interface IDelivery {
  _id: Types.ObjectId;
  lead: Types.ObjectId;
  integration: Types.ObjectId;
  office: Types.ObjectId;
  status: DeliveryStatus;
  method: string; // "API POST" | "Webhook" | "XML POST" | "dedup"…
  requestBody?: unknown;
  responseBody?: unknown;
  externalId?: string;
  httpStatus?: number;
  attempts: number;
  error?: string;
  sentAt: Date;
}

const DeliverySchema = new Schema<IDelivery>({
  lead: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
  integration: { type: Schema.Types.ObjectId, ref: "Integration", required: true },
  office: { type: Schema.Types.ObjectId, ref: "Office", required: true, index: true },
  status: { type: String, enum: DELIVERY_STATUSES, default: "PENDING", index: true },
  method: { type: String, default: "API POST" },
  requestBody: { type: Schema.Types.Mixed },
  responseBody: { type: Schema.Types.Mixed },
  externalId: { type: String },
  httpStatus: { type: Number },
  attempts: { type: Number, default: 0 },
  error: { type: String },
  sentAt: { type: Date, default: Date.now, index: true },
});

const Delivery: Model<IDelivery> =
  mongoose.models.Delivery || mongoose.model<IDelivery>("Delivery", DeliverySchema);
export default Delivery;
