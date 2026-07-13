import { z } from "zod";
import { dbConnect } from "@/lib/db";
import LeadStatusDef from "@/models/LeadStatusDef";
import { AuditLog } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";
import { getStatusDefs } from "@/lib/statuses";
import { STATUS_BADGE_OPTIONS } from "@/lib/enums";

export const dynamic = "force-dynamic";

const BADGES = STATUS_BADGE_OPTIONS.map((b) => b.value) as [string, ...string[]];

const createSchema = z.object({
  label: z.string().trim().min(2, "Слишком короткое название").max(40),
  badge: z.enum(BADGES).default("b-off"),
  isTerminal: z.boolean().default(false),
});

/** Ключ из названия: транслит-безопасный слот на основе времени + случайности убран
 *  ради детерминизма — берём латиницу из label, иначе CUSTOM_<n>. */
function keyFromLabel(label: string, taken: Set<string>): string {
  const base = label
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  let key = base || "STATUS";
  let n = 2;
  while (taken.has(key)) key = `${base || "STATUS"}_${n++}`;
  return key;
}

/** Список статусов (любой авторизованный). */
export async function GET() {
  return apiHandler(async () => {
    await requireUser();
    await dbConnect();
    return { statuses: await getStatusDefs() };
  });
}

/** Создание кастомного статуса. */
export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireUser();
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");

    await dbConnect();
    const existing = await LeadStatusDef.find().select("key order").lean();
    const taken = new Set(existing.map((s) => s.key));
    const key = keyFromLabel(parsed.data.label, taken);
    const order = existing.reduce((m, s) => Math.max(m, s.order), -1) + 1;

    const doc = await LeadStatusDef.create({
      key,
      label: parsed.data.label,
      badge: parsed.data.badge,
      isTerminal: parsed.data.isTerminal,
      order,
      active: true,
      isSystem: false,
    });
    await AuditLog.create({ user: me.id, action: "leadStatus.create", entity: "LeadStatusDef", entityId: key, meta: { label: doc.label } });
    return { ok: true, status: { key: doc.key, label: doc.label, badge: doc.badge, order: doc.order, active: doc.active, isTerminal: doc.isTerminal, isSystem: doc.isSystem } };
  });
}
