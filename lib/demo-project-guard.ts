import "server-only";

import { isDemoUser } from "@/lib/demo-user";
import { getProjetoById } from "@/lib/projetos";

export async function canDemoUserEditProject(userEmail: string | null | undefined, projetoId: string | null | undefined) {
  const normalizedProjectId = projetoId?.trim() || null;
  if (!normalizedProjectId || !isDemoUser(userEmail)) {
    return false;
  }

  const projeto = await getProjetoById(normalizedProjectId);
  return projeto?.isDemo === true;
}

export async function isDemoProjectMutationBlocked(
  userEmail: string | null | undefined,
  projetoId: string | null | undefined,
  method: string = "POST",
) {
  const normalizedMethod = method.trim().toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD" || normalizedMethod === "OPTIONS") {
    return false;
  }

  const normalizedProjectId = projetoId?.trim() || null;
  if (!normalizedProjectId || !isDemoUser(userEmail)) {
    return false;
  }

  return await canDemoUserEditProject(userEmail, normalizedProjectId);
}
