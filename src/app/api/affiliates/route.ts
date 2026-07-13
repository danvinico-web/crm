import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Affiliate, AuditLog } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(2, "Название слишком короткое"),
  tag: z.string().trim().min(2, "Метка слишком короткая").regex(/^[a-z0-9_-]+$/i, "Метка: латиница, цифры, - и _"),
  platform: z.string().trim().default(""),
  status: z.enum(["active", "review", "paused"]).default("active"),
  cpa: z.number().min(0).default(0),
});

export async function GET() {
  return apiHandler(async () => {
    await requireUser();
    await dbConnect();
    const affiliates = await Affiliate.find().sort({ createdAt: 1 }).lean();
    return { affiliates: affiliates.map((a) => ({ id: String(a._id), name: a.name, tag: a.tag, platform: a.platform, status: a.status })) };
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireUser();
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    await dbConnect();
    const dup = await Affiliate.findOne({ tag: parsed.data.tag });
    if (dup) throw new HttpError(409, "Аффилиат с такой меткой уже есть");
    const aff = await Affiliate.create(parsed.data);
    await AuditLog.create({ user: me.id, action: "affiliate.create", entity: "Affiliate", entityId: String(aff._id) });
    return { affiliate: { id: String(aff._id), name: aff.name, tag: aff.tag } };
  });
}
