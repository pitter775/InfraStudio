import "server-only";

import { hashSync } from "bcryptjs";
import type { AppUser } from "@/lib/app-user";
import { applyAccessProfile } from "@/lib/access";
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
  ativo: boolean | null;
  usuarios_projetos: UsuarioProjetoRow[] | null;
};

function normalizeRole(role: string | null | undefined): AppUser["role"] {
  if (role === "admin" || role === "manager") {
    return role;
  }

  return "viewer";
}

function normalizeStatus(ativo: boolean | null | undefined): AppUser["status"] {
  return ativo === false ? "pendente" : "ativo";
}

export function mapUsuarioToAppUser(row: Omit<UsuarioRow, "senha">): AppUser {
  const memberships =
    row.usuarios_projetos?.map((item) => ({
      projetoId: item.projeto_id,
      projetoNome: Array.isArray(item.projetos) ? item.projetos[0]?.nome ?? null : item.projetos?.nome ?? null,
      projetoSlug: Array.isArray(item.projetos) ? item.projetos[0]?.slug ?? null : item.projetos?.slug ?? null,
      papel: normalizeRole(item.papel),
    })) ?? [];

  return applyAccessProfile({
    id: row.id,
    name: row.nome?.trim() || "Usuário",
    email: row.email?.trim() || "",
    provider: row.provider ?? undefined,
    providerId: row.provider_id ?? undefined,
    role: memberships[0]?.papel ?? "viewer",
    status: normalizeStatus(row.ativo),
    currentProjectId: memberships[0]?.projetoId ?? null,
    memberships,
  });
}

export async function findUsuarioWithPasswordByEmail(email: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, senha, provider, provider_id, ativo, usuarios_projetos(papel, projeto_id, projetos(nome, slug))")
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
    .select("id, nome, email, senha, provider, provider_id, ativo")
    .eq("email", email)
    .maybeSingle();

  return { data, error };
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
    .select("id, nome, email, provider, provider_id, ativo, usuarios_projetos(papel, projeto_id, projetos(nome, slug))")
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("[usuarios] failed to list usuarios", error);
    return [];
  }

  return data.map((row) => mapUsuarioToAppUser(row as Omit<UsuarioRow, "senha">));
}

export async function listUsuariosByProjeto(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, provider, provider_id, ativo, usuarios_projetos!inner(papel, projeto_id, projetos(nome, slug))")
    .eq("usuarios_projetos.projeto_id", projetoId)
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("[usuarios] failed to list usuarios by projeto", error);
    return [];
  }

  return data.map((row) => mapUsuarioToAppUser(row as Omit<UsuarioRow, "senha">));
}

type SaveUsuarioInput = {
  id?: string;
  nome: string;
  email: string;
  senha?: string;
  ativo?: boolean;
  provider?: string | null;
  providerId?: string | null;
};

function sanitizeUsuarioPayload(input: SaveUsuarioInput) {
  return {
    nome: input.nome.trim(),
    email: input.email.trim().toLowerCase(),
    ativo: input.ativo ?? true,
    provider: input.provider ?? "email",
    provider_id: input.providerId ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function createUsuario(input: SaveUsuarioInput) {
  const supabase = getSupabaseAdminClient();
  const payload = sanitizeUsuarioPayload(input);
  const insertPayload = {
    ...payload,
    senha: hashSync(input.senha?.trim() || "123456", 10),
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("usuarios")
    .insert(insertPayload as never)
    .select("id, nome, email, provider, provider_id, ativo, usuarios_projetos(papel, projeto_id)")
    .single();

  if (error || !data) {
    console.error("[usuarios] failed to create usuario", error);
    return null;
  }

  return mapUsuarioToAppUser(data as Omit<UsuarioRow, "senha">);
}

export async function updateUsuario(input: SaveUsuarioInput) {
  if (!input.id) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const payload: Record<string, unknown> = sanitizeUsuarioPayload(input);

  if (input.senha?.trim()) {
    payload.senha = hashSync(input.senha.trim(), 10);
  }

  const { data, error } = await supabase
    .from("usuarios")
    .update(payload as never)
    .eq("id", input.id)
    .select("id, nome, email, provider, provider_id, ativo, usuarios_projetos(papel, projeto_id)")
    .single();

  if (error || !data) {
    console.error("[usuarios] failed to update usuario", error);
    return null;
  }

  return mapUsuarioToAppUser(data as Omit<UsuarioRow, "senha">);
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
    .select("id, nome, email, provider, provider_id, ativo, usuarios_projetos(papel, projeto_id)")
    .single();

  if (error || !data) {
    console.error("[usuarios] failed to toggle usuario", error);
    return null;
  }

  return mapUsuarioToAppUser(data as Omit<UsuarioRow, "senha">);
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
