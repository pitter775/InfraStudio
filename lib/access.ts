import type { AppUser } from "@/lib/app-user";

export function applyAccessProfile(user: AppUser): AppUser {
  const currentProjectId = user.currentProjectId ?? user.memberships?.[0]?.projetoId ?? null;
  return {
    ...user,
    currentProjectId,
  };
}

export function canAccessAdmin(user: AppUser | null) {
  return Boolean(user?.role === "admin" || user?.memberships?.length);
}

export function canAccessGlobalAdmin(user: AppUser | null) {
  return Boolean(user?.role === "admin");
}

export function canAccessWorkspace(user: AppUser | null) {
  return Boolean(user);
}

export function isAdminUser(user: AppUser | null) {
  if (!user) {
    return false;
  }
  return user.role === "admin" || Boolean(user.memberships?.some((membership) => membership.papel === "admin"));
}

export function isGlobalAdminUser(user: AppUser | null) {
  return Boolean(user?.role === "admin");
}

export function getUserProjectIds(user: AppUser | null) {
  if (!user) {
    return [];
  }

  return user.memberships?.map((item) => item.projetoId).filter(Boolean) as string[] ?? [];
}

export function canManageProject(user: AppUser | null, projetoId: string | null | undefined) {
  if (!user || !projetoId) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  return Boolean(
    user.memberships?.some(
      (membership) => membership.projetoId === projetoId && membership.papel === "admin",
    ),
  );
}

export function canAccessProject(user: AppUser | null, projetoId: string | null | undefined) {
  if (!user || !projetoId) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  return Boolean(user.memberships?.some((membership) => membership.projetoId === projetoId));
}

export function resolveCurrentProjectId(user: AppUser | null) {
  if (!user) {
    return null;
  }

  return user.currentProjectId ?? user.memberships?.[0]?.projetoId ?? null;
}
