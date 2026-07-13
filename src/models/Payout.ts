import mongoose, { Schema, type Model, type Types } from "mongoose";

/** Выплата аффилиату (факт перечисления денег). Начислено/к выплате считаются, не хранятся. */
export interface IPayout {
  _id: Types.ObjectId;
  affiliate: Types.ObjectId;
  amount: number;
  note?: string;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
}

const PayoutSchema = new Schema<IPayout>({
  affiliate: { type: Schema.Types.ObjectId, ref: "Affiliate", required: true, index: true },
  amount: { type: Number, required: true },
  note: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  createdAt: { type: Date, default: Date.now, index: true },
});

const Payout: Model<IPayout> = mongoose.models.Payout || mongoose.model<IPayout>("Payout", PayoutSchema);
export default Payout;
