import "server-only";

import type { AppUser } from "@/lib/app-user";
import { canAccessProject } from "@/lib/access";
import { getProjetoById } from "@/lib/projetos";

export async function getDemoProjectAccessState(user: AppUser | null, projetoId: string | null | undefined) {
  const normalizedProjectId = projetoId?.trim() || null;
  if (!normalizedProjectId) {
    return {
      projeto: null,
      canAccess: false,
      isDemo: false,
      expired: false,
      ownedByCurrentUser: false,
      code: "PROJECT_REQUIRED" as const,
    };
  }

  const projeto = await getProjetoById(normalizedProjectId);
  if (!projeto) {
    return {
      projeto: null,
      canAccess: false,
      isDemo: false,
      expired: false,
      ownedByCurrentUser: false,
      code: "PROJECT_NOT_FOUND" as const,
    };
  }

  const ownedByCurrentUser =
    Boolean(user?.id) &&
    (projeto.demoOwnerUserId === user?.id || projeto.ownerUserId === user?.id || canAccessProject(user, projeto.id));
  const canAccess = canAccessProject(user, projeto.id) || (projeto.isDemo && ownedByCurrentUser);
  const expired = projeto.isDemo && projeto.demoExpired;

  return {
    projeto,
    canAccess,
    isDemo: projeto.isDemo,
    expired,
    ownedByCurrentUser,
    code: !canAccess ? "PROJECT_FORBIDDEN" : expired ? "DEMO_EXPIRED" : "OK",
  };
}

export async function isDemoProjectReadRestricted(_userEmail: string | null | undefined, projetoId: string | null | undefined, user?: AppUser | null) {
  const access = await getDemoProjectAccessState(user ?? null, projetoId);
  return Boolean(access.isDemo && (!access.canAccess || access.expired));
}

export async function canDemoUserEditProject(_userEmail: string | null | undefined, projetoId: string | null | undefined, user?: AppUser | null) {
  const access = await getDemoProjectAccessState(user ?? null, projetoId);
  return Boolean(access.isDemo && access.canAccess && !access.expired && access.ownedByCurrentUser);
}

export async function isDemoProjectMutationBlocked(
  _userEmail: string | null | undefined,
  projetoId: string | null | undefined,
  method: string = "POST",
  user?: AppUser | null,
) {
  const normalizedMethod = method.trim().toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD" || normalizedMethod === "OPTIONS") {
    return false;
  }

  const access = await getDemoProjectAccessState(user ?? null, projetoId);
  return Boolean(access.isDemo && (!access.canAccess || access.expired));
}
