import mongoose, { Schema, type Model, type Types } from "mongoose";

/** Журнал действий (кто, что, над чем). */
export interface IAuditLog {
  _id: Types.ObjectId;
  user?: Types.ObjectId | null;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  user: { type: Schema.Types.ObjectId, ref: "User", default: null },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String },
  meta: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true },
});

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
export default AuditLog;
