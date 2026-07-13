import AppSettings, { DEFAULT_LOAD_STATUSES, DEFAULT_LOAD_CAPACITY } from "@/models/AppSettings";

export interface LoadConfig {
  loadStatuses: string[];
  loadCapacity: number;
}

/** Читает глобальные настройки (создаёт дефолтные при первом обращении). */
export async function getLoadConfig(): Promise<LoadConfig> {
  const doc = await AppSettings.findById("app").lean();
  const loadStatuses = (doc?.loadStatuses ?? []).filter(Boolean);
  return {
    loadStatuses: loadStatuses.length ? loadStatuses : DEFAULT_LOAD_STATUSES,
    loadCapacity: doc?.loadCapacity && doc.loadCapacity > 0 ? doc.loadCapacity : DEFAULT_LOAD_CAPACITY,
  };
}
