import { z } from "zod";
import { dbConnect } from "@/lib/db";
import AppSettings from "@/models/AppSettings";
import { AuditLog } from "@/models";
import { apiHandler, requireAdmin, HttpError } from "@/lib/rbac";
import { getLoadConfig } from "@/lib/settings";
import { getStatusKeys } from "@/lib/statuses";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  loadStatuses: z.array(z.string()).min(1, "Выберите хотя бы один статус"),
  loadCapacity: z.number().int().min(1, "Ёмкость должна быть ≥ 1").max(1000),
});

/** Текущие настройки (только админ). */
export async function GET() {
  return apiHandler(async () => {
    await requireAdmin();
    await dbConnect();
    return getLoadConfig();
  });
}

/** Обновление настроек расчёта нагрузки (только админ). */
export async function PATCH(req: Request) {
  return apiHandler(async () => {
    const admin = await requireAdmin();
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");

    await dbConnect();
    const keys = await getStatusKeys();
    const loadStatuses = parsed.data.loadStatuses.filter((s) => keys.has(s));
    if (loadStatuses.length === 0) throw new HttpError(422, "Выберите хотя бы один существующий статус");
    await AppSettings.findByIdAndUpdate(
      "app",
      { loadStatuses, loadCapacity: parsed.data.loadCapacity },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await AuditLog.create({ user: admin.id, action: "settings.update", entity: "AppSettings", entityId: "app", meta: { loadStatuses, loadCapacity: parsed.data.loadCapacity } });

    return { ok: true, loadStatuses, loadCapacity: parsed.data.loadCapacity };
  });
}
