import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Integration from "@/models/Integration";
import Lead from "@/models/Lead";
import { decrypt, verifyHmacHex } from "@/lib/crypto";
import { applyStatusUpdate } from "@/lib/statusSync";

export const dynamic = "force-dynamic";

/**
 * Входящий callback смены статуса от внешней CRM.
 *   POST /api/status/:integrationId
 *   Заголовок: X-Signature: hex hmac_sha256(body, integration.callbackSecret)
 *   Тело: { "lead_id": "...", "status": "wrong info", "changed_at": "..." }
 */
export async function POST(req: Request, { params }: { params: { integrationId: string } }) {
  const raw = await req.text();

  if (!mongoose.isValidObjectId(params.integrationId)) {
    return NextResponse.json({ error: "Интеграция не найдена" }, { status: 404 });
  }
  await dbConnect();
  const integration = await Integration.findById(params.integrationId);
  if (!integration) {
    return NextResponse.json({ error: "Интеграция не найдена" }, { status: 404 });
  }

  const secret = decrypt(integration.callbackSecretEnc);
  const signature = req.headers.get("x-signature") ?? "";
  if (!verifyHmacHex(raw, signature, secret)) {
    return NextResponse.json({ error: "Неверная подпись (X-Signature)" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json({ error: "Некорректное тело" }, { status: 400 });
  }

  const externalId = String(payload.lead_id ?? payload.leadId ?? payload.external_id ?? "");
  const rawStatus = String(payload.status ?? payload.state ?? "");
  if (!externalId || !rawStatus) {
    return NextResponse.json({ error: "Нужны lead_id и status" }, { status: 422 });
  }

  const lead = await Lead.findOne({ externalId, office: integration.office });
  if (!lead) {
    return NextResponse.json({ error: "Лид с таким external_id не найден" }, { status: 404 });
  }

  const result = await applyStatusUpdate(lead, integration, rawStatus, "CALLBACK");
  return NextResponse.json({ ok: true, ...result });
}
