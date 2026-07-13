import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import { requirePageRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requirePageRole(["ADMIN"]);
  return (
    <>
      <div className="section-head">
        <h2>Отчёты и аналитика</h2>
      </div>
      <AnalyticsDashboard />
    </>
  );
}
