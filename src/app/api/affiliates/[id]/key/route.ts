import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Affiliate, AuditLog } from "@/models";
import { apiHandler, requireRoles, HttpError } from "@/lib/rbac";
import { generateAffiliateApiKey, revealApiKey } from "@/lib/apiKey";

export const dynamic = "force-dynamic";

/**
 * GET  /api/affiliates/:id/key  — показать текущий ключ (только ADMIN).
 *   Бэкофилл только если ключа ни разу не выдавали. Если ключ есть, но не
 *   расшифровывается (сменился ENCRYPTION_KEY) — НЕ трогаем его (он всё ещё
 *   валиден для аутентификации по apiKeyHash), а просим перевыпустить.
 * POST /api/affiliates/:id/key  — ротация: выдать новый ключ (только ADMIN),
 *   старый инвалидируется.
 */

function applyKey(aff: { apiKeyHash?: string; apiKeyEnc?: string; apiKeyPrefix?: string; apiKeyCreatedAt?: Date }, gen: ReturnType<typeof generateAffiliateApiKey>) {
  aff.apiKeyHash = gen.apiKeyHash;
  aff.apiKeyEnc = gen.apiKeyEnc;
  aff.apiKeyPrefix = gen.apiKeyPrefix;
  aff.apiKeyCreatedAt = gen.apiKeyCreatedAt;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireRoles(["ADMIN"]);
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Аффилиат не найден");
    await dbConnect();
    const aff = await Affiliate.findById(params.id);
    if (!aff) throw new HttpError(404, "Аффилиат не найден");

    // Ключ ещё ни разу не выдавали — выдаём сейчас (бэкофилл старых записей).
    if (!aff.apiKeyHash && !aff.apiKeyEnc) {
      const gen = generateAffiliateApiKey();
      applyKey(aff, gen);
      await aff.save();
      await AuditLog.create({ user: me.id, action: "affiliate.key.issue", entity: "Affiliate", entityId: params.id });
      return { apiKey: gen.key, apiKeyPrefix: aff.apiKeyPrefix, createdAt: aff.apiKeyCreatedAt };
    }

    const key = revealApiKey(aff.apiKeyEnc);
    if (!key) {
      // Ключ есть (аутентифицируется по apiKeyHash), но не расшифровывается.
      // НЕ перезаписываем его молча — это сломало бы живую интеграцию. Просим ротацию.
      throw new HttpError(409, "Ключ не удаётся расшифровать (возможно, сменился ENCRYPTION_KEY). Перевыпустите ключ.");
    }
    return { apiKey: key, apiKeyPrefix: aff.apiKeyPrefix, createdAt: aff.apiKeyCreatedAt };
  });
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return apiHandler(async () => {
    const me = await requireRoles(["ADMIN"]);
    if (!mongoose.isValidObjectId(params.id)) throw new HttpError(404, "Аффилиат не найден");
    await dbConnect();
    const aff = await Affiliate.findById(params.id);
    if (!aff) throw new HttpError(404, "Аффилиат не найден");

    const gen = generateAffiliateApiKey();
    applyKey(aff, gen);
    await aff.save();
    await AuditLog.create({ user: me.id, action: "affiliate.key.rotate", entity: "Affiliate", entityId: params.id });
    return { apiKey: gen.key, apiKeyPrefix: gen.apiKeyPrefix, createdAt: gen.apiKeyCreatedAt };
  });
}
