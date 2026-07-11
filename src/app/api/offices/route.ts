import { dbConnect } from "@/lib/db";
import { Office, Integration } from "@/models";
import { apiHandler, requireUser } from "@/lib/rbac";
import { API_TYPE_LABEL } from "@/lib/enums";

export const dynamic = "force-dynamic";

export interface OfficeLite {
  id: string;
  name: string;
  logoText: string;
  color: string;
  connState: string;
  apiTypeLabel?: string;
  hasIntegration: boolean;
}

/** Список офисов + признак наличия активной интеграции (для модалки отгрузки). */
export async function GET() {
  return apiHandler(async () => {
    await requireUser();
    await dbConnect();
    const [offices, integrations] = await Promise.all([
      Office.find().sort({ createdAt: 1 }).lean(),
      Integration.find({ isActive: true }).lean(),
    ]);
    const byOffice = new Map(integrations.map((i) => [String(i.office), i]));
    const list: OfficeLite[] = offices.map((o) => {
      const integ = byOffice.get(String(o._id));
      return {
        id: String(o._id),
        name: o.name,
        logoText: o.logoText,
        color: o.color,
        connState: o.isActive ? "ok" : "idle",
        apiTypeLabel: integ ? API_TYPE_LABEL[integ.apiType] : undefined,
        hasIntegration: !!integ,
      };
    });
    return { offices: list };
  });
}
