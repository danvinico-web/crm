import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Source from "@/models/Source";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";
import { runIntake } from "@/lib/intake";

export const dynamic = "force-dynamic";

const schema = z.object({ sourceId: z.string() });

const NAMES = ["Lukas Meier", "Anna Nowak", "Paolo Costa", "Sofie Larsen", "Marc Dupont", "Nora Vogel"];
const GEOS = ["DE", "PL", "IT", "DK", "FR", "ES", "NL", "AT"];
const AFFS = ["aff_karl", "fb_pro", "g_nord", "nat_str"];

/** Отправляет тестовый лид в пайплайн приёма (для демонстрации из UI). */
export async function POST(req: Request) {
  return apiHandler(async () => {
    await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new HttpError(422, "Не указан источник");
    if (!mongoose.isValidObjectId(parsed.data.sourceId)) throw new HttpError(404, "Источник не найден");

    await dbConnect();
    const source = await Source.findById(parsed.data.sourceId);
    if (!source) throw new HttpError(404, "Источник не найден");

    // Уникальный контакт, чтобы демонстрировать создание (а не дедуп).
    const rnd = Math.floor(Math.random() * 1e6);
    const name = NAMES[rnd % NAMES.length];
    const payload = {
      name,
      email: `test.${rnd}@example.com`,
      phone: `+49${1500000000 + rnd}`,
      geo: GEOS[rnd % GEOS.length],
      aff: AFFS[rnd % AFFS.length],
      extra: { source: "ui-test" },
    };

    const result = await runIntake(source, payload);
    return { ...result, sample: { name: payload.name, email: payload.email, geo: payload.geo, aff: payload.aff } };
  });
}
