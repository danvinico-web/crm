import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { LeadField, AuditLog } from "@/models";
import { apiHandler, requireUser, requireAdmin, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  label: z.string().trim().min(1, "Укажите название поля"),
  key: z.string().trim().regex(/^[a-z0-9_]+$/i, "Ключ: латиница, цифры, _").optional(),
});

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "field";
}

export async function GET() {
  return apiHandler(async () => {
    await requireUser();
    await dbConnect();
    const fields = await LeadField.find().sort({ order: 1, createdAt: 1 }).lean();
    return { fields: fields.map((f) => ({ id: String(f._id), key: f.key, label: f.label })) };
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireAdmin();
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    await dbConnect();
    const key = parsed.data.key ? slugify(parsed.data.key) : slugify(parsed.data.label);
    const dup = await LeadField.findOne({ key });
    if (dup) throw new HttpError(409, "Поле с таким ключом уже есть");
    const count = await LeadField.estimatedDocumentCount();
    const field = await LeadField.create({ key, label: parsed.data.label, order: count });
    await AuditLog.create({ user: me.id, action: "leadField.create", entity: "LeadField", entityId: String(field._id) });
    return { field: { id: String(field._id), key: field.key, label: field.label } };
  });
}
