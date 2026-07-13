import { z } from "zod";
import { dbConnect } from "@/lib/db";
import LeadStatusDef from "@/models/LeadStatusDef";
import { Lead, AuditLog } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";
import { STATUS_BADGE_OPTIONS } from "@/lib/enums";

export const dynamic = "force-dynamic";

const BADGES = STATUS_BADGE_OPTIONS.map((b) => b.value) as [string, ...string[]];

const patchSchema = z.object({
  label: z.string().trim().min(2).max(40).optional(),
  badge: z.enum(BADGES).optional(),
  isTerminal: z.boolean().optional(),
  active: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

/** Обновление статуса (переименование, цвет, порядок, вкл/выкл). */
export async function PATCH(req: Request, { params }: { params: { key: string } }) {
  return apiHandler(async () => {
    const me = await requireUser();
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");

    await dbConnect();
    const doc = await LeadStatusDef.findOne({ key: params.key });
    if (!doc) throw new HttpError(404, "Статус не найден");

    // Встроенный статус нельзя деактивировать полностью только если это единственный
    // способ скрыть — разрешаем скрывать, но не менять ключ. Ключ вообще не редактируется.
    if (parsed.data.label !== undefined) doc.label = parsed.data.label;
    if (parsed.data.badge !== undefined) doc.badge = parsed.data.badge;
    if (parsed.data.isTerminal !== undefined) doc.isTerminal = parsed.data.isTerminal;
    if (parsed.data.active !== undefined) doc.active = parsed.data.active;
    if (parsed.data.order !== undefined) doc.order = parsed.data.order;
    await doc.save();

    await AuditLog.create({ user: me.id, action: "leadStatus.update", entity: "LeadStatusDef", entityId: doc.key, meta: parsed.data });
    return { ok: true };
  });
}

/** Удаление статуса. Встроенные удалять нельзя; используемые — тоже (сначала скрыть/переназначить). */
export async function DELETE(req: Request, { params }: { params: { key: string } }) {
  return apiHandler(async () => {
    const me = await requireUser();
    await dbConnect();
    const doc = await LeadStatusDef.findOne({ key: params.key });
    if (!doc) throw new HttpError(404, "Статус не найден");
    if (doc.isSystem) throw new HttpError(400, "Встроенный статус нельзя удалить — можно скрыть или переименовать");

    const used = await Lead.countDocuments({ status: params.key });
    if (used > 0) throw new HttpError(409, `Статус используется ${used} лид(ами) — сначала переназначьте их или скройте статус`);

    await doc.deleteOne();
    await AuditLog.create({ user: me.id, action: "leadStatus.delete", entity: "LeadStatusDef", entityId: doc.key, meta: { label: doc.label } });
    return { ok: true };
  });
}
