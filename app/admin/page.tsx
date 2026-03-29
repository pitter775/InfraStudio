import { redirect } from "next/navigation";
import { canAccessWorkspace, isAdminUser } from "@/lib/access";
import { getSessionUser } from "@/lib/session";

export default async function AdminIndexPage() {
  const user = await getSessionUser();
  if (!canAccessWorkspace(user)) {
    redirect("/");
  }

  redirect(!isAdminUser(user) ? "/admin/projetos" : "/admin/dashboard");
}
