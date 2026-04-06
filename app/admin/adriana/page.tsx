import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import AdrianaPageClient from "./page-client";

export default async function AdrianaPage() {
  const user = await getSessionUser();

  if (user?.email?.trim().toLowerCase() !== "dry@infrastudio") {
    redirect("/admin");
  }

  return <AdrianaPageClient />;
}
