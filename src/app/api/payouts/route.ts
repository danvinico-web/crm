import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Payout, Affiliate, AuditLog } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  affiliateId: z.string(),
  amount: z.number().positive("Сумма должна быть больше 0"),
  note: z.string().trim().optional(),
});

/** Список выплат (опционально по аффилиату). */
export async function GET(req: Request) {
  return apiHandler(async () => {
    await requireUser();
    await dbConnect();
    const affiliateId = new URL(req.url).searchParams.get("affiliateId");
    const filter: Record<string, unknown> = {};
    if (affiliateId && mongoose.isValidObjectId(affiliateId)) filter.affiliate = affiliateId;
    const payouts = await Payout.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return {
      payouts: payouts.map((p) => ({
        id: String(p._id),
        affiliateId: String(p.affiliate),
        amount: p.amount,
        note: p.note ?? "",
        createdAt: p.createdAt,
      })),
    };
  });
}

/** Записать выплату аффилиату. */
export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireUser();
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    if (!mongoose.isValidObjectId(parsed.data.affiliateId)) throw new HttpError(404, "Аффилиат не найден");
    await dbConnect();
    const aff = await Affiliate.findById(parsed.data.affiliateId);
    if (!aff) throw new HttpError(404, "Аффилиат не найден");

    const payout = await Payout.create({
      affiliate: aff._id,
      amount: parsed.data.amount,
      note: parsed.data.note,
      createdBy: me.id,
    });
    await AuditLog.create({ user: me.id, action: "payout.create", entity: "Affiliate", entityId: String(aff._id), meta: { amount: parsed.data.amount } });
    return { ok: true, id: String(payout._id) };
  });
}
