import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Integration, Office, AuditLog } from "@/models";
import { apiHandler, requireAdmin, HttpError } from "@/lib/rbac";
import { encrypt } from "@/lib/crypto";
import { API_TYPES, LEAD_STATUSES } from "@/lib/enums";

export const dynamic = "force-dynamic";

/** Конфиг интеграции для формы редактирования (без открытого ключа). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    await requireAdmin();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Интеграция не найдена");
    await dbConnect();
    const i = await Integration.findById(params.id).lean();
    if (!i) throw new HttpError(404, "Интеграция не найдена");
    const office = await Office.findById(i.office).lean();
    return {
      integration: {
        id: String(i._id),
        name: i.name,
        office: office ? { id: String(office._id), name: office.name, code: office.code, logoText: office.logoText, color: office.color } : null,
        apiType: i.apiType,
        baseUrl: i.baseUrl,
        authScheme: i.authScheme,
        authKeyName: i.authKeyName,
        sendPath: i.sendPath,
        statusPath: i.statusPath ?? "",
        fieldMappings: i.fieldMappings,
        statusMappings: i.statusMappings,
        sandbox: i.sandbox,
        isActive: i.isActive,
        hasKey: true,
      },
    };
  });
}

const mappingSchema = z.object({ externalField: z.string().min(1), internalField: z.string().min(1), transform: z.string().optional() });
const statusMapSchema = z.object({ externalValue: z.string().min(1), internalValue: z.enum(LEAD_STATUSES) });

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  apiType: z.enum(API_TYPES).optional(),
  baseUrl: z.string().trim().url().optional(),
  authScheme: z.enum(["header", "query", "body"]).optional(),
  authKeyName: z.string().trim().min(1).optional(),
  apiKey: z.string().trim().optional(), // пусто = не менять
  sendPath: z.string().trim().min(1).optional(),
  statusPath: z.string().trim().optional(),
  callbackSecret: z.string().trim().optional(),
  fieldMappings: z.array(mappingSchema).optional(),
  statusMappings: z.array(statusMapSchema).optional(),
  sandbox: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireAdmin();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Интеграция не найдена");
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Неверные данные");
    await dbConnect();
    const i = await Integration.findById(params.id);
    if (!i) throw new HttpError(404, "Интеграция не найдена");

    const d = parsed.data;
    for (const k of ["name", "apiType", "baseUrl", "authScheme", "authKeyName", "sendPath", "statusPath", "fieldMappings", "statusMappings", "sandbox", "isActive"] as const) {
      if (d[k] !== undefined) (i as unknown as Record<string, unknown>)[k] = d[k];
    }
    if (d.apiKey) i.apiKeyEnc = encrypt(d.apiKey);
    if (d.callbackSecret) i.callbackSecretEnc = encrypt(d.callbackSecret);
    await i.save();
    await AuditLog.create({ user: me.id, action: "integration.update", entity: "Integration", entityId: params.id });
    return { ok: true };
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireAdmin();
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Интеграция не найдена");
    await dbConnect();
    const i = await Integration.findByIdAndDelete(params.id);
    if (!i) throw new HttpError(404, "Интеграция не найдена");
    await AuditLog.create({ user: me.id, action: "integration.delete", entity: "Integration", entityId: params.id });
    return { ok: true };
  });
}
