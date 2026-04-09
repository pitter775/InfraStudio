import "server-only";

import { appendSystemLog } from "@/lib/chat-logs";
import { isDemoUser } from "@/lib/demo-user";
import { getProjetoById } from "@/lib/projetos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUsuarioByEmail } from "@/lib/usuarios";

type DemoProjectAccessState =
  | { allowed: false; reason: "NOT_FOUND" | "NOT_DEMO" | "FORBIDDEN" | "DEMO_EXPIRED"; projetoId: string | null }
  | { allowed: true; expired: boolean; projetoId: string; isDemo: boolean };

async function markDemoExpiredIfNeeded(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("projetos")
    .update({
      demo_status: "expirado",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", projetoId)
    .eq("is_demo", true);

  await appendSystemLog({
    projetoId,
    tipo: "demo_expired",
    origem: "demo_project_guard",
    descricao: "Projeto demo expirado bloqueado pelo backend.",
    payload: {
      project_id: projetoId,
    },
  });
}

export async function getDemoProjectAccessState(
  userEmail: string | null | undefined,
  projetoId: string | null | undefined,
): Promise<DemoProjectAccessState> {
  const normalizedProjectId = projetoId?.trim() || null;
  if (!normalizedProjectId) {
    return { allowed: false, reason: "NOT_FOUND", projetoId: null };
  }

  const projeto = await getProjetoById(normalizedProjectId);
  if (!projeto) {
    return { allowed: false, reason: "NOT_FOUND", projetoId: normalizedProjectId };
  }

  if (!projeto.isDemo) {
    return { allowed: true, expired: false, projetoId: normalizedProjectId, isDemo: false };
  }

  const expiresAt = projeto.demoExpiresAt ? new Date(projeto.demoExpiresAt).getTime() : Number.NaN;
  const expired =
    projeto.demoStatus === "expirado" ||
    (Number.isFinite(expiresAt) && expiresAt <= Date.now());

  const normalizedEmail = String(userEmail || "").trim().toLowerCase();
  const usuario = normalizedEmail ? await getUsuarioByEmail(normalizedEmail) : null;
  const hasProjectAccess = Boolean(
    usuario &&
      (projeto.ownerUserId === usuario.id || usuario.memberships?.some((membership) => membership.projetoId === normalizedProjectId)),
  );

  if (!hasProjectAccess) {
    return { allowed: false, reason: "FORBIDDEN", projetoId: normalizedProjectId };
  }

  if (expired) {
    await markDemoExpiredIfNeeded(normalizedProjectId);
    return { allowed: false, reason: "DEMO_EXPIRED", projetoId: normalizedProjectId };
  }

  return { allowed: true, expired: false, projetoId: normalizedProjectId, isDemo: true };
}

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
  const accessState = await getDemoProjectAccessState(userEmail, projetoId);
  return accessState.allowed && accessState.isDemo;
}

export async function getDemoProjectMutationBlockReason(
  userEmail: string | null | undefined,
  projetoId: string | null | undefined,
  method: string = "POST",
) {
  const normalizedMethod = method.trim().toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD" || normalizedMethod === "OPTIONS") {
    return null;
  }

  const normalizedProjectId = projetoId?.trim() || null;
  if (!normalizedProjectId) {
    return null;
  }

  const accessState = await getDemoProjectAccessState(userEmail, normalizedProjectId);
  if (!accessState.allowed && accessState.reason === "DEMO_EXPIRED") {
    return "DEMO_EXPIRED";
  }

  return null;
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
  if (!normalizedProjectId) {
    return false;
  }

  return Boolean(await getDemoProjectMutationBlockReason(userEmail, normalizedProjectId, normalizedMethod));
}
