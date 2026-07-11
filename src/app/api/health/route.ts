import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { User, Lead, Office, Agent, Source, Affiliate, Delivery, StatusEvent } from "@/models";

export const dynamic = "force-dynamic";

/** Диагностический эндпоинт: проверяет подключение к БД и наличие данных. */
export async function GET() {
  try {
    await dbConnect();
    const [users, leads, offices, agents, sources, affiliates, deliveries, events] = await Promise.all([
      User.countDocuments(),
      Lead.countDocuments(),
      Office.countDocuments(),
      Agent.countDocuments(),
      Source.countDocuments(),
      Affiliate.countDocuments(),
      Delivery.countDocuments(),
      StatusEvent.countDocuments(),
    ]);
    return NextResponse.json({
      ok: true,
      db: process.env.MONGODB_URI ? "external" : "in-memory",
      counts: { users, leads, offices, agents, sources, affiliates, deliveries, events },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
