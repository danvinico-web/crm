import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Source from "@/models/Source";
import AuditLog from "@/models/AuditLog";
import { apiHandler, requireUser, HttpError } from "@/lib/rbac";
import { runIntake, type IntakeOutcome } from "@/lib/intake";

export const dynamic = "force-dynamic";

const schema = z.object({
  sourceId: z.string(),
  mapping: z.record(z.string()), // { internalField: csvHeader }
  rows: z.array(z.record(z.string())).max(50_000),
});

/** Импорт лидов из распарсенного CSV (только авторизованный пользователь). */
export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");

    const { sourceId, mapping, rows } = parsed.data;
    if (!mongoose.isValidObjectId(sourceId)) throw new HttpError(404, "Источник не найден");

    await dbConnect();
    const source = await Source.findById(sourceId).lean();
    if (!source) throw new HttpError(404, "Источник не найден");

    const sourceLike = { _id: source._id, type: source.type, config: source.config, fieldMappings: [] };
    const tally: Record<IntakeOutcome, number> = { created: 0, duplicate: 0, idempotent: 0, rejected: 0 };
    const errorsSample: string[] = [];

    for (const row of rows) {
      // Собираем payload: ядро по внутренним ключам + comment + custom:<key>.
      const payload: Record<string, unknown> = {};
      const custom: Record<string, string> = {};
      for (const [target, header] of Object.entries(mapping)) {
        if (!header || row[header] == null || row[header] === "") continue;
        if (target.startsWith("custom:")) custom[target.slice(7)] = row[header];
        else payload[target] = row[header];
      }
      if (Object.keys(custom).length) payload.custom = custom;
      const res = await runIntake(sourceLike, payload);
      tally[res.outcome]++;
      if (res.outcome === "rejected" && errorsSample.length < 5 && res.errors) {
        errorsSample.push(res.errors.join("; "));
      }
    }

    await AuditLog.create({
      user: me.id,
      action: "import.csv",
      entity: "Source",
      entityId: sourceId,
      meta: { total: rows.length, ...tally },
    });

    return { total: rows.length, ...tally, errorsSample };
  });
}
