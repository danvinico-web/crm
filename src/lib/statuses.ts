import LeadStatusDef from "@/models/LeadStatusDef";
import { DEFAULT_STATUS_DEFS, type StatusDef } from "@/lib/enums";

/**
 * Возвращает все определения статусов (отсортированы по order). Если коллекция
 * пуста — засевает дефолтными значениями из enum. Результат сериализуем (для
 * передачи в клиентские компоненты).
 */
export async function getStatusDefs(): Promise<StatusDef[]> {
  const count = await LeadStatusDef.estimatedDocumentCount();
  if (count === 0) {
    await LeadStatusDef.insertMany(DEFAULT_STATUS_DEFS).catch(() => {
      /* гонка при первом обращении — не критично */
    });
  }
  const docs = await LeadStatusDef.find().sort({ order: 1 }).lean();
  return docs.map((d) => ({
    key: d.key,
    label: d.label,
    badge: d.badge,
    order: d.order,
    active: d.active,
    isTerminal: d.isTerminal,
    isSystem: d.isSystem,
  }));
}

/** Только активные статусы — для фильтров и пикеров. */
export async function getActiveStatusDefs(): Promise<StatusDef[]> {
  return (await getStatusDefs()).filter((s) => s.active);
}

/** Набор валидных ключей статусов (для валидации входных данных). */
export async function getStatusKeys(): Promise<Set<string>> {
  return new Set((await getStatusDefs()).map((s) => s.key));
}
