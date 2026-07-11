import { dbConnect } from "@/lib/db";
import { Integration, Office } from "@/models";
import { apiHandler, requireUser } from "@/lib/rbac";
import { decryptNullable } from "@/lib/crypto";
import { API_TYPE_LABEL } from "@/lib/enums";

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
