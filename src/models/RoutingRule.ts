import mongoose, { Schema, type Model, type Types } from "mongoose";

/** Условия правила распределения (пустой массив/флаг = нет ограничения). */
export interface IRoutingConditions {
  affiliateTags: string[];
  geos: string[];
  balanceZero: boolean;
}

/** Правило авто-роутинга: если новый лид подходит под условия — отправить в офис. */
export interface IRoutingRule {
  _id: Types.ObjectId;
  name: string;
  priority: number;
  enabled: boolean;
  office: Types.ObjectId;
  conditions: IRoutingConditions;
  createdAt: Date;
  updatedAt: Date;
}

const RoutingRuleSchema = new Schema<IRoutingRule>(
  {
    name: { type: String, required: true, trim: true },
    priority: { type: Number, default: 100, index: true },
    enabled: { type: Boolean, default: false },
    office: { type: Schema.Types.ObjectId, ref: "Office", required: true },
    conditions: {
      affiliateTags: { type: [String], default: [] },
      geos: { type: [String], default: [] },
      balanceZero: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

const RoutingRule: Model<IRoutingRule> =
  mongoose.models.RoutingRule || mongoose.model<IRoutingRule>("RoutingRule", RoutingRuleSchema);
export default RoutingRule;
