import mongoose, { Schema, type Model } from "mongoose";

/** Глобальные настройки приложения (singleton, _id = "app"). */
export interface IAppSettings {
  _id: string;
  loadStatuses: string[]; // какие статусы считаются «в работе» и учитываются в нагрузке
  loadCapacity: number; // сколько лидов «в работе» = 100% нагрузки агента
  updatedAt: Date;
}

/** Значения по умолчанию — используются пока админ не переопределил их. */
export const DEFAULT_LOAD_STATUSES: string[] = ["SENT", "CALLBACK", "NO_ANSWER", "IN_PROGRESS"];
export const DEFAULT_LOAD_CAPACITY = 15;

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    _id: { type: String, default: "app" },
    loadStatuses: { type: [String], default: DEFAULT_LOAD_STATUSES },
    loadCapacity: { type: Number, default: DEFAULT_LOAD_CAPACITY, min: 1 },
  },
  { timestamps: true },
);

const AppSettings: Model<IAppSettings> =
  mongoose.models.AppSettings || mongoose.model<IAppSettings>("AppSettings", AppSettingsSchema);
export default AppSettings;
