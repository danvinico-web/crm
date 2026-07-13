import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { LeadNote, Lead } from "@/models";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const createSchema = z.object({ text: z.string().trim().min(1, "Пустой комментарий") });

/** Комментарии лида (хронологически: старые сверху). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireUser();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Лид не найден");
    await dbConnect();
    const notes = await LeadNote.find({ lead: params.id }).sort({ createdAt: 1 }).lean();
    return {
      notes: notes.map((n) => ({ id: String(n._id), text: n.text, author: n.author, source: n.source, createdAt: n.createdAt })),
    };
  });
}

/** Добавить комментарий к лиду. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireUser();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Лид не найден");
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    await dbConnect();
    const lead = await Lead.findById(params.id).select("_id");
    if (!lead) throw new HttpError(404, "Лид не найден");
    const note = await LeadNote.create({ lead: lead._id, text: parsed.data.text, author: me.name ?? "Пользователь", source: "user" });
    return { note: { id: String(note._id), text: note.text, author: note.author, source: note.source, createdAt: note.createdAt } };
  });
}
