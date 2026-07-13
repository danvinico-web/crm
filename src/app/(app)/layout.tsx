import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Lead, Agent, Office } from "@/models";
import { leadScopeFilter } from "@/lib/leadScope";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  await dbConnect();
  const scope = await leadScopeFilter({ id: session.user.id, role: session.user.role, name: session.user.name, email: session.user.email });
  const [leadsCount, agentsCount, officesCount] = await Promise.all([
    Lead.countDocuments(scope),
    Agent.countDocuments(),
    Office.countDocuments(),
  ]);

  const badges: Record<string, string> = {
    "/leads": leadsCount.toLocaleString("ru-RU"),
    "/agents": String(agentsCount),
    "/distribution": String(officesCount),
  };

  return (
    <div className="app">
      <Sidebar userName={session.user.name ?? "Пользователь"} userRole={session.user.role} badges={badges} />
      <div className="main">
        <Topbar />
        <div className="content view-fade">{children}</div>
      </div>
    </div>
  );
}
