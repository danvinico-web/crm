import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface ITeam {
  _id: Types.ObjectId;
  name: string;
  code: string;
  owner: Types.ObjectId; // пользователь (USER), создавший команду
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

TeamSchema.index({ owner: 1, code: 1 }, { unique: true });

const Team: Model<ITeam> = mongoose.models.Team || mongoose.model<ITeam>("Team", TeamSchema);
export default Team;
