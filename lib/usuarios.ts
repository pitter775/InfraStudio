import "server-only";

import { hashSync } from "bcryptjs";
import type { AppUser } from "@/lib/app-user";
import { applyAccessProfile } from "@/lib/access";
import { isDemoUser } from "@/lib/demo-user";
import { createProjeto } from "@/lib/projetos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type UsuarioProjetoRow = {
  papel: string | null;
  projeto_id: string | null;
  projetos?:
    | {
        nome: string | null;
        slug: string | null;
      }
    | {
        nome: string | null;
        slug: string | null;
      }[]
    | null;
};

type UsuarioRow = {
  id: string;
  nome: string | null;
  email: string | null;
  senha: string | null;
  provider: string | null;
  provider_id: string | null;
  role: string | null;
  email_verificado: boolean | null;
  ativo: boolean | null;
  usuarios_projetos: UsuarioProjetoRow[] | null;
};

function normalizeRole(role: string | null | undefined): AppUser["role"] {
  if (role === "admin") {
    return "admin";
  }

  return "viewer";
}

function normalizeStatus(ativo: boolean | null | undefined): AppUser["status"] {
  return ativo === false ? "pendente" : "ativo";
}

export function mapUsuarioToAppUser(row: Omit<UsuarioRow, "senha">): AppUser {
  const demoUser = isDemoUser(row.email);
  const memberships =
    row.usuarios_projetos?.map((item) => ({
      projetoId: item.projeto_id,
      projetoNome: Array.isArray(item.projetos) ? item.projetos[0]?.nome ?? null : item.projetos?.nome ?? null,
      projetoSlug: Array.isArray(item.projetos) ? item.projetos[0]?.slug ?? null : item.projetos?.slug ?? null,
      papel: demoUser ? "viewer" : normalizeRole(item.papel),
    })) ?? [];
  const globalRole = demoUser ? "viewer" : normalizeRole(row.role);

  return applyAccessProfile({
    id: row.id,
    name: row.nome?.trim() || "Usuario",
    email: row.email?.trim() || "",
    provider: row.provider ?? undefined,
    providerId: row.provider_id ?? undefined,
    role: demoUser ? "viewer" : globalRole === "admin" || memberships.some((item) => item.papel === "admin") ? "admin" : "viewer",
    status: normalizeStatus(row.ativo),
    currentProjectId: memberships[0]?.projetoId ?? null,
    memberships,
  });
}

const usuarioSelectFields =
  "id, nome, email, senha, provider, provider_id, role, email_verificado, ativo, usuarios_projetos(papel, projeto_id, projetos(nome, slug))";

const usuarioSelectFieldsNoPassword =
  "id, nome, email, provider, provider_id, role, email_verificado, ativo, usuarios_projetos(papel, projeto_id, projetos(nome, slug))";

const usuarioSelectFieldsCompact =
  "id, nome, email, provider, provider_id, role, email_verificado, ativo, usuarios_projetos(papel, projeto_id)";

export async function findUsuarioWithPasswordByEmail(email: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select(usuarioSelectFields)
    .eq("email", email)
    .maybeSingle<UsuarioRow>();

  if (error) {
    console.error("[usuarios] failed to find usuario by email", error);
    return null;
  }

  return data;
}

export async function debugFindUsuarioByEmail(email: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, senha, provider, provider_id, role, email_verificado, ativo")
    .eq("email", email)
    .maybeSingle();

  return { data, error };
}

export async function findUsuarioByProvider(provider: string, providerId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select(usuarioSelectFieldsNoPassword)
    .eq("provider", provider)
    .eq("provider_id", providerId)
    .maybeSingle<UsuarioRow>();

  if (error) {
    console.error("[usuarios] failed to find usuario by provider", error);
    return null;
  }

  return data ? mapUsuarioToAppUser(data as Omit<UsuarioRow, "senha">) : null;
}

export async function touchUsuarioLogin(usuarioId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("usuarios")
    .update({
      ativo: true,
      ultimo_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", usuarioId);

  if (error) {
    console.error("[usuarios] failed to update ultimo_login_at", error);
  }
}

export async function listUsuarios() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select(usuarioSelectFieldsNoPassword)
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("[usuarios] failed to list usuarios", error);
    return [];
  }

  return data.map((row) => mapUsuarioToAppUser(row as Omit<UsuarioRow, "senha">));
}

export async function getUsuarioById(usuarioId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select(usuarioSelectFieldsNoPassword)
    .eq("id", usuarioId)
    .maybeSingle();

  if (error || !data) {
    console.error("[usuarios] failed to get usuario by id", error);
    return null;
  }

  return mapUsuarioToAppUser(data as Omit<UsuarioRow, "senha">);
}

export async function getUsuarioByEmail(email: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select(usuarioSelectFieldsNoPassword)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[usuarios] failed to get usuario by email", error);
    }
    return null;
  }

  return mapUsuarioToAppUser(data as Omit<UsuarioRow, "senha">);
}

export async function listUsuariosByProjeto(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, provider, provider_id, role, email_verificado, ativo, usuarios_projetos!inner(papel, projeto_id, projetos(nome, slug))")
    .eq("usuarios_projetos.projeto_id", projetoId)
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("[usuarios] failed to list usuarios by projeto", error);
    return [];
  }

  return data.map((row) => mapUsuarioToAppUser(row as Omit<UsuarioRow, "senha">));
}

export async function updateUsuarioProviderAndVerification(input: {
  usuarioId: string;
  provider: string;
  providerId: string;
  emailVerificado: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("usuarios")
    .update({
      provider: input.provider,
      provider_id: input.providerId,
      email_verificado: input.emailVerificado,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.usuarioId);

  if (error) {
    console.error("[usuarios] failed to update usuario provider", error);
    return false;
  }

  return true;
}

type SaveUsuarioInput = {
  id?: string;
  nome: string;
  email: string;
  senha?: string;
  ativo?: boolean;
  emailVerificado?: boolean;
  papel?: AppUser["role"];
  projetoId?: string | null;
  projetoIds?: string[];
  provider?: string | null;
  providerId?: string | null;
  skipDefaultProjeto?: boolean;
};

function sanitizeUsuarioPayload(input: SaveUsuarioInput) {
  const demoUser = isDemoUser(input.email);
  return {
    nome: input.nome.trim(),
    email: input.email.trim().toLowerCase(),
    ativo: input.ativo ?? true,
    email_verificado: input.emailVerificado ?? true,
    role: demoUser ? "viewer" : input.papel === "admin" ? "admin" : "viewer",
    provider: input.provider ?? "email",
    provider_id: input.providerId ?? null,
    updated_at: new Date().toISOString(),
  };
}

async function syncUsuarioProjetoPapel(input: {
  usuarioId: string;
  projetoId?: string | null;
  papel?: AppUser["role"];
  forceViewer?: boolean;
}) {
  if (!input.projetoId) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const papel = input.forceViewer ? "viewer" : input.papel === "admin" ? "admin" : "viewer";
  const { data: existing, error: readError } = await supabase
    .from("usuarios_projetos")
    .select("usuario_id")
    .eq("usuario_id", input.usuarioId)
    .eq("projeto_id", input.projetoId)
    .maybeSingle();

  if (readError) {
    console.error("[usuarios] failed to read usuario_projeto", readError);
    return;
  }

  if (existing) {
    const { error } = await supabase
      .from("usuarios_projetos")
      .update({
        papel,
      } as never)
      .eq("usuario_id", input.usuarioId)
      .eq("projeto_id", input.projetoId);

    if (error) {
      console.error("[usuarios] failed to update usuario_projeto papel", error);
    }

    return;
  }

  const { error } = await supabase
    .from("usuarios_projetos")
    .insert({
      usuario_id: input.usuarioId,
      projeto_id: input.projetoId,
      papel,
      created_at: new Date().toISOString(),
    } as never);

  if (error) {
    console.error("[usuarios] failed to create usuario_projeto papel", error);
  }
}

function normalizeProjetoIds(input: Pick<SaveUsuarioInput, "projetoId" | "projetoIds">) {
  const rawIds = [...(input.projetoIds ?? []), input.projetoId ?? null];
  return Array.from(
    new Set(
      rawIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim()),
    ),
  );
}

async function syncUsuarioProjetoPapeis(input: {
  usuarioId: string;
  projetoIds: string[];
  papel?: AppUser["role"];
}) {
  const supabase = getSupabaseAdminClient();
  const papel = input.papel === "admin" ? "admin" : "viewer";
  const { data: existing, error: readError } = await supabase
    .from("usuarios_projetos")
    .select("projeto_id")
    .eq("usuario_id", input.usuarioId);

  if (readError) {
    console.error("[usuarios] failed to read usuario_projetos", readError);
    return;
  }

  const existingRows = (existing ?? []) as Array<{ projeto_id: string | null }>;
  const existingProjetoIds = new Set(
    existingRows
      .map((item) => item.projeto_id)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  );
  const targetProjetoIds = new Set(input.projetoIds);

  const projetoIdsToDelete = Array.from(existingProjetoIds).filter((projetoId) => !targetProjetoIds.has(projetoId));
  if (projetoIdsToDelete.length > 0) {
    const { error } = await supabase
      .from("usuarios_projetos")
      .delete()
      .eq("usuario_id", input.usuarioId)
      .in("projeto_id", projetoIdsToDelete);

    if (error) {
      console.error("[usuarios] failed to delete removed usuario_projetos", error);
    }
  }

  for (const projetoId of input.projetoIds) {
    await syncUsuarioProjetoPapel({
      usuarioId: input.usuarioId,
      projetoId,
      papel: input.papel,
    });
  }
}

async function ensureUsuarioHasProjeto(input: {
  usuarioId: string;
  nome: string;
  projetoIds: string[];
  papel?: AppUser["role"];
}) {
  if (input.projetoIds.length > 0) {
    return input.projetoIds;
  }

  const projetoNome = input.nome.trim() ? `Projeto ${input.nome.trim()}` : "Projeto sem nome";
  const projeto = await createProjeto({
    nome: projetoNome,
    status: "ativo",
    modoCobranca: "plano",
    ownerUserId: input.usuarioId,
  });

  if (!projeto) {
    console.error("[usuarios] failed to create default projeto for usuario", {
      usuarioId: input.usuarioId,
      nome: input.nome,
    });
    return input.projetoIds;
  }

  await syncUsuarioProjetoPapel({
    usuarioId: input.usuarioId,
    projetoId: projeto.id,
    papel: input.papel,
  });

  return [projeto.id];
}

export async function createUsuario(input: SaveUsuarioInput) {
  const supabase = getSupabaseAdminClient();
  const payload = sanitizeUsuarioPayload(input);
  const demoUser = isDemoUser(input.email);
  const requestedProjetoIds = normalizeProjetoIds(input);
  const insertPayload = {
    ...payload,
    senha: hashSync(input.senha?.trim() || "123456", 10),
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("usuarios")
    .insert(insertPayload as never)
    .select(usuarioSelectFieldsCompact)
    .single();

  if (error || !data) {
    console.error("[usuarios] failed to create usuario", error);
    return null;
  }

  const usuario = data as Omit<UsuarioRow, "senha">;
  const projetoIds = input.skipDefaultProjeto
    ? requestedProjetoIds
    : await ensureUsuarioHasProjeto({
        usuarioId: usuario.id,
        nome: input.nome,
        projetoIds: requestedProjetoIds,
        papel: demoUser ? "viewer" : input.papel,
      });

  await syncUsuarioProjetoPapeis({
    usuarioId: usuario.id,
    projetoIds,
    papel: demoUser ? "viewer" : input.papel,
  });

  return (await getUsuarioById(usuario.id)) ?? mapUsuarioToAppUser(usuario);
}

export async function updateUsuario(input: SaveUsuarioInput) {
  if (!input.id) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const payload: Record<string, unknown> = sanitizeUsuarioPayload(input);
  const demoUser = isDemoUser(input.email);
  const requestedProjetoIds = normalizeProjetoIds(input);

  if (input.senha?.trim()) {
    payload.senha = hashSync(input.senha.trim(), 10);
  }

  const { data, error } = await supabase
    .from("usuarios")
    .update(payload as never)
    .eq("id", input.id)
    .select(usuarioSelectFieldsCompact)
    .single();

  if (error || !data) {
    console.error("[usuarios] failed to update usuario", error);
    return null;
  }

  const usuario = data as Omit<UsuarioRow, "senha">;
  const projetoIds = await ensureUsuarioHasProjeto({
    usuarioId: usuario.id,
    nome: input.nome,
    projetoIds: requestedProjetoIds,
    papel: demoUser ? "viewer" : input.papel,
  });

  await syncUsuarioProjetoPapeis({
    usuarioId: usuario.id,
    projetoIds,
    papel: demoUser ? "viewer" : input.papel,
  });

  return (await getUsuarioById(usuario.id)) ?? mapUsuarioToAppUser(usuario);
}

export async function setUsuarioAtivo(usuarioId: string, ativo: boolean) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usuarios")
    .update({
      ativo,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", usuarioId)
    .select(usuarioSelectFieldsCompact)
    .single();

  if (error || !data) {
    console.error("[usuarios] failed to toggle usuario", error);
    return null;
  }

  return mapUsuarioToAppUser(data as Omit<UsuarioRow, "senha">);
}

export async function enforceDemoUserRestrictions(input?: {
  usuarioId?: string | null;
  email?: string | null;
  projetoId?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const normalizedEmail = input?.email?.trim().toLowerCase() || "";
  const shouldFilterByEmail = Boolean(normalizedEmail && isDemoUser(normalizedEmail));

  const userIds = new Set<string>();
  if (input?.usuarioId?.trim()) {
    userIds.add(input.usuarioId.trim());
  }

  if (shouldFilterByEmail) {
    const { data: byEmail } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", normalizedEmail)
      .limit(10);

    for (const row of (byEmail ?? []) as Array<{ id: string | null }>) {
      if (row.id) {
        userIds.add(row.id);
      }
    }
  }

  if (!userIds.size && !shouldFilterByEmail) {
    const { data: demoUsers } = await supabase
      .from("usuarios")
      .select("id")
      .like("email", "demonstracao_%");

    for (const row of (demoUsers ?? []) as Array<{ id: string | null }>) {
      if (row.id) {
        userIds.add(row.id);
      }
    }
  }

  const normalizedUserIds = Array.from(userIds);
  if (!normalizedUserIds.length) {
    return;
  }

  await supabase
    .from("usuarios")
    .update({
      role: "viewer",
      updated_at: new Date().toISOString(),
    } as never)
    .in("id", normalizedUserIds);

  let membershipQuery = supabase
    .from("usuarios_projetos")
    .update({ papel: "viewer" } as never)
    .in("usuario_id", normalizedUserIds);

  if (input?.projetoId?.trim()) {
    membershipQuery = membershipQuery.eq("projeto_id", input.projetoId.trim());
  }

  await membershipQuery;
}

export async function deleteUsuario(usuarioId: string) {
  const supabase = getSupabaseAdminClient();

  const { error: membershipsError } = await supabase.from("usuarios_projetos").delete().eq("usuario_id", usuarioId);

  if (membershipsError) {
    console.error("[usuarios] failed to delete usuario memberships", membershipsError);
    return false;
  }

  const { error } = await supabase.from("usuarios").delete().eq("id", usuarioId);

  if (error) {
    console.error("[usuarios] failed to delete usuario", error);
    return false;
  }

  return true;
}
