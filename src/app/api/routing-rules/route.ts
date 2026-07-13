import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { RoutingRule, Office, AuditLog } from "@/models";
import { apiHandler, requireUser, requireAdmin, HttpError } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const conditionsSchema = z.object({
  affiliateTags: z.array(z.string()).default([]),
  geos: z.array(z.string()).default([]),
  balanceZero: z.boolean().default(false),
});
const createSchema = z.object({
  name: z.string().trim().min(2, "Название слишком короткое"),
  officeId: z.string(),
  priority: z.number().int().default(100),
  enabled: z.boolean().default(false),
  conditions: conditionsSchema,
});

export async function GET() {
  return apiHandler(async () => {
    await requireUser();
    await dbConnect();
    const [rules, offices] = await Promise.all([
      RoutingRule.find().sort({ priority: 1 }).lean(),
      Office.find().lean(),
    ]);
    const officeName = new Map(offices.map((o) => [String(o._id), o.name]));
    return {
      rules: rules.map((r) => ({
        id: String(r._id),
        name: r.name,
        priority: r.priority,
        enabled: r.enabled,
        officeId: String(r.office),
        officeName: officeName.get(String(r.office)) ?? "—",
        conditions: r.conditions,
      })),
      offices: offices.map((o) => ({ id: String(o._id), name: o.name })),
    };
  });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const me = await requireAdmin();
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    await dbConnect();
    const rule = await RoutingRule.create({
      name: parsed.data.name,
      office: parsed.data.officeId,
      priority: parsed.data.priority,
      enabled: parsed.data.enabled,
      conditions: {
        affiliateTags: parsed.data.conditions.affiliateTags,
        geos: parsed.data.conditions.geos.map((g) => g.toUpperCase()),
        balanceZero: parsed.data.conditions.balanceZero,
      },
    });
    await AuditLog.create({ user: me.id, action: "rule.create", entity: "RoutingRule", entityId: String(rule._id) });
    return { ok: true, id: String(rule._id) };
  });
}
