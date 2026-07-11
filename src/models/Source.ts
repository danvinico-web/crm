import mongoose, { Schema, type Model, type Types } from "mongoose";
import { SOURCE_TYPES, type SourceType } from "@/lib/enums";

export interface IFieldMap {
  externalField: string; // колонка файла / ключ входящего payload
  internalField: string; // поле нашего Lead
  transform?: string; // "phone_e164" | "lower" | ...
}

export interface ISource {
  _id: Types.ObjectId;
  name: string;
  type: SourceType;
  secretEnc: string; // HMAC-секрет для входящих вебхуков (зашифрован at rest)
  config: Record<string, unknown>; // sheetId, range, formId, url и т.п.
  fieldMappings: IFieldMap[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FieldMapSchema = new Schema<IFieldMap>(
  {
    externalField: { type: String, required: true },
    internalField: { type: String, required: true },
    transform: { type: String },
  },
  { _id: false },
);

const SourceSchema = new Schema<ISource>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: SOURCE_TYPES, required: true },
    secretEnc: { type: String, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
    fieldMappings: { type: [FieldMapSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Source: Model<ISource> = mongoose.models.Source || mongoose.model<ISource>("Source", SourceSchema);
export default Source;
