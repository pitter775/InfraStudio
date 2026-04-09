import "server-only";

import { isDemoUser } from "@/lib/demo-user";
import { getProjetoById } from "@/lib/projetos";
import { getUsuarioByEmail } from "@/lib/usuarios";

export async function isDemoProjectReadRestricted(userEmail: string | null | undefined, projetoId: string | null | undefined) {
  const normalizedProjectId = projetoId?.trim() || null;
  if (!normalizedProjectId || !isDemoUser(userEmail)) {
    return false;
  }

  const normalizedEmail = String(userEmail || "").trim().toLowerCase();
  const [projeto, usuario] = await Promise.all([
    getProjetoById(normalizedProjectId),
    getUsuarioByEmail(normalizedEmail),
  ]);

  if (!projeto?.isDemo || !usuario) {
    return false;
  }

  if (projeto.ownerUserId === usuario.id) {
    return true;
  }

  return Boolean(usuario.memberships?.some((membership) => membership.projetoId === normalizedProjectId));
}

export async function canDemoUserEditProject(userEmail: string | null | undefined, projetoId: string | null | undefined) {
  return await isDemoProjectReadRestricted(userEmail, projetoId);
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
