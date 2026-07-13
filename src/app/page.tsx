import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/rbac";

export default async function Home() {
  const me = await getSessionUser();
  redirect(me?.role === "ADMIN" ? "/dashboard" : "/leads");
}
