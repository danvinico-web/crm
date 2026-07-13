import mongoose, { Schema, type Model } from "mongoose";

/** Атомарный счётчик последовательностей (напр. человекочитаемый номер лида). */
export interface ICounter {
  _id: string; // имя последовательности, напр. "leadRef"
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter: Model<ICounter> =
  mongoose.models.Counter || mongoose.model<ICounter>("Counter", CounterSchema);
export default Counter;
