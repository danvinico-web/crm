import Counter from "@/models/Counter";

/** База для человекочитаемых номеров лидов — первый номер = 100000 (6 знаков). */
const LEAD_REF_BASE = 100_000;

/**
 * Возвращает следующий уникальный 6-значный номер лида. Атомарно инкрементит
 * счётчик в БД, поэтому безопасно при параллельном приёме лидов.
 */
export async function nextLeadRef(): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    "leadRef",
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean();
  return LEAD_REF_BASE + ((doc?.seq ?? 1) - 1);
}
