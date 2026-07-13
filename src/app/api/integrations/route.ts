import { z } from "zod";
import crypto from "node:crypto";
import { dbConnect } from "@/lib/db";
import { Integration, Office, AuditLog } from "@/models";
import { apiHandler, requireUser, requireAdmin, HttpError } from "@/lib/rbac";
import { encrypt, decryptNullable } from "@/lib/crypto";
import { API_TYPE_LABEL, API_TYPES, LEAD_STATUSES } from "@/lib/enums";

export const dynamic = "force-dynamic";

/** Список интеграций офисов. callback-секрет отдаётся только администратору. */
export async function GET() {
  return apiHandler(async () => {
    const me = await requireUser();
    const isAdmin = me.role === "ADMIN";
    await dbConnect();
    const [integrations, offices] = await Promise.all([
      Integration.find().sort({ createdAt: 1 }).lean(),
      Office.find().lean(),
    ]);
    const officeName = new Map(offices.map((o) => [String(o._id), o.name]));
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    return {
      integrations: integrations.map((i) => ({
        id: String(i._id),
        name: i.name,
        officeId: String(i.office),
        officeName: officeName.get(String(i.office)) ?? "—",
        apiTypeLabel: API_TYPE_LABEL[i.apiType],
        connState: i.connState,
        sandbox: i.sandbox,
        callbackUrl: `${appUrl}/api/status/${String(i._id)}`,
        callbackSecret: isAdmin ? decryptNullable(i.callbackSecretEnc) : undefined,
      })),
    };
  });
}

const mappingSchema = z.object({ externalField: z.string().min(1), internalField: z.string().min(1), transform: z.string().optional() });
const statusMapSchema = z.object({ externalValue: z.string().min(1), internalValue: z.enum(LEAD_STATUSES) });

const createSchema = z.object({
  office: z.object({
    name: z.string().trim().min(2, "Название офиса слишком короткое"),
    code: z.string().trim().min(2).regex(/^[a-z0-9_-]+$/i, "Код: латиница, цифры, - и _"),
    logoText: z.string().trim().max(3).default("OF"),
    color: z.string().trim().default("#4f7cff,#6a5cff"),
  }),
  name: z.string().trim().min(2, "Название интеграции слишком короткое"),
  apiType: z.enum(API_TYPES),
  baseUrl: z.string().trim().url("Некорректный baseUrl"),
  authScheme: z.enum(["header", "query", "body"]),
  authKeyName: z.string().trim().min(1),
  apiKey: z.string().trim().min(1, "Укажите API-ключ"),
  sendPath: z.string().trim().min(1),
  statusPath: z.string().trim().optional(),
  callbackSecret: z.string().trim().optional(),
  fieldMappings: z.array(mappingSchema).default([]),
  statusMappings: z.array(statusMapSchema).default([]),
  sandbox: z.boolean().default(true),
});

/** Создание нового офиса + коннектора (только админ). */
export async function POST(req: Request) {
  return apiHandler(async () => {
    const admin = await requireAdmin();
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    const d = parsed.data;
    await dbConnect();

    const codeDup = await Office.findOne({ code: d.office.code });
    if (codeDup) throw new HttpError(409, "Офис с таким кодом уже существует");

    const office = await Office.create({
      name: d.office.name,
      code: d.office.code,
      logoText: d.office.logoText,
      color: d.office.color,
      isActive: true,
    });
    const integration = await Integration.create({
      office: office._id,
      name: d.name,
      apiType: d.apiType,
      baseUrl: d.baseUrl,
      authScheme: d.authScheme,
      authKeyName: d.authKeyName,
      apiKeyEnc: encrypt(d.apiKey),
      sendPath: d.sendPath,
      statusPath: d.statusPath,
      callbackSecretEnc: encrypt(d.callbackSecret || crypto.randomBytes(16).toString("hex")),
      fieldMappings: d.fieldMappings,
      statusMappings: d.statusMappings,
      sandbox: d.sandbox,
      isActive: true,
      connState: "ok",
    });

    await AuditLog.create({ user: admin.id, action: "integration.create", entity: "Integration", entityId: String(integration._id), meta: { office: office.name } });
    return { ok: true, officeId: String(office._id), integrationId: String(integration._id) };
  });
}
