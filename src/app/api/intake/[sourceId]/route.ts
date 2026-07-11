import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Source from "@/models/Source";
import { decrypt, verifyHmacHex } from "@/lib/crypto";
import { runIntake } from "@/lib/intake";

export const dynamic = "force-dynamic";

/**
 * Универсальный приём лидов.
 *   POST /api/intake/:sourceId
 *   Заголовок: X-Signature: hex hmac_sha256(body, source.secret)
 *   Тело: JSON или application/x-www-form-urlencoded
 */
export async function POST(req: Request, { params }: { params: { sourceId: string } }) {
  const raw = await req.text();

  if (!mongoose.isValidObjectId(params.sourceId)) {
    return NextResponse.json({ error: "Источник не найден" }, { status: 404 });
  }

  await dbConnect();
  const source = await Source.findById(params.sourceId);
  if (!source || !source.isActive) {
    return NextResponse.json({ error: "Источник не найден или отключён" }, { status: 404 });
  }

  // Проверка HMAC по секрету источника.
  const secret = decrypt(source.secretEnc);
  const signature = req.headers.get("x-signature") ?? "";
  if (!verifyHmacHex(raw, signature, secret)) {
    return NextResponse.json({ error: "Неверная подпись (X-Signature)" }, { status: 401 });
  }

  // Разбор тела: JSON или urlencoded.
  let payload: Record<string, unknown>;
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/x-www-form-urlencoded")) {
      payload = Object.fromEntries(new URLSearchParams(raw));
    } else {
      payload = JSON.parse(raw || "{}");
    }
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const result = await runIntake(source, payload);
  const httpStatus = result.outcome === "rejected" ? 422 : 201;
  return NextResponse.json(result, { status: httpStatus });
}
