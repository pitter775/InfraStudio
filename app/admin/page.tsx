import { redirect } from "next/navigation";
import { canAccessGlobalAdmin, canAccessWorkspace } from "@/lib/access";
import { getSessionUser } from "@/lib/session";

export default async function AdminIndexPage() {
  const user = await getSessionUser();
  if (!canAccessWorkspace(user)) {
    redirect("/");
  }

  redirect(canAccessGlobalAdmin(user) ? "/admin/dashboard" : "/admin/projetos");
}
