import { dbConnect } from "@/lib/db";
import Source from "@/models/Source";
import { apiHandler, requireUser } from "@/lib/rbac";
import { decryptNullable } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/** Список источников. Секрет отдаётся только администратору. */
export async function GET() {
  return apiHandler(async () => {
    const me = await requireUser();
    const isAdmin = me.role === "ADMIN";
    await dbConnect();
    const sources = await Source.find().sort({ createdAt: 1 }).lean();
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    return {
      sources: sources.map((s) => ({
        id: String(s._id),
        name: s.name,
        type: s.type,
        isActive: s.isActive,
        webhookUrl: `${appUrl}/api/intake/${String(s._id)}`,
        secret: isAdmin ? decryptNullable(s.secretEnc) : undefined,
      })),
    };
  });
}
