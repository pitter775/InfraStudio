import type { AppUser } from "@/lib/app-user";

function parseList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getMasterEmails() {
  return parseList(process.env.MASTER_USER_EMAILS);
}

function getMasterProviderIds() {
  return parseList(process.env.MASTER_USER_IDS ?? process.env.MASTER_USER_PROVIDER_IDS);
}

export function isMasterUserIdentity(user: Pick<AppUser, "email" | "id" | "providerId">) {
  const email = user.email.trim().toLowerCase();
  const userId = user.id.trim().toLowerCase();
  const providerId = user.providerId?.trim().toLowerCase() ?? "";

  return getMasterEmails().includes(email) || getMasterProviderIds().includes(userId) || getMasterProviderIds().includes(providerId);
}

export function applyAccessProfile(user: AppUser): AppUser {
  const currentProjectId = user.currentProjectId ?? user.memberships?.[0]?.projetoId ?? null;

  if (!isMasterUserIdentity(user)) {
    return {
      ...user,
      currentProjectId,
    };
  }

  return {
    ...user,
    isMaster: true,
    role: "admin",
    status: "ativo",
    currentProjectId,
  };
}

export function canAccessAdmin(user: AppUser | null) {
  return Boolean(user?.isMaster || user?.memberships?.length);
}

export function isAdminUser(user: AppUser | null) {
  if (!user) {
    return false;
  }

  if (user.isMaster) {
    return true;
  }

  return Boolean(user.memberships?.some((membership) => membership.papel === "admin"));
}

export function getUserProjectIds(user: AppUser | null) {
  if (!user) {
    return [];
  }

  if (user.isMaster) {
    return user.memberships?.map((item) => item.projetoId).filter(Boolean) as string[] ?? [];
  }

  return user.memberships?.map((item) => item.projetoId).filter(Boolean) as string[] ?? [];
}

export function canManageProject(user: AppUser | null, projetoId: string | null | undefined) {
  if (!user || !projetoId) {
    return false;
  }

  if (user.isMaster) {
    return true;
  }

  return Boolean(
    user.memberships?.some(
      (membership) =>
        membership.projetoId === projetoId && (membership.papel === "admin" || membership.papel === "manager"),
    ),
  );
}

export function canAccessProject(user: AppUser | null, projetoId: string | null | undefined) {
  if (!user || !projetoId) {
    return false;
  }

  if (user.isMaster) {
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
