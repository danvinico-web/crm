import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <>
      <div className="section-head">
        <h2>Отчёты и аналитика</h2>
      </div>
      <AnalyticsDashboard />
    </>
  );
}
