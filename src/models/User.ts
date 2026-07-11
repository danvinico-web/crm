import mongoose, { Schema, type Model, type Types } from "mongoose";
import { ROLES, type Role } from "@/lib/roles";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  createdBy?: Types.ObjectId | null; // админ, создавший пользователя
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: "USER" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export default User;
