import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProjetoRecord = {
  id: string;
  nome: string;
  slug: string | null;
  tipo: string | null;
  descricao: string;
  status: string;
  siteChatAtivo: boolean;
};

type ProjetoRow = {
  id: string;
  nome: string | null;
  slug: string | null;
  tipo: string | null;
  descricao: string | null;
  status: string | null;
  configuracoes: Record<string, unknown> | null;
};

function mapProjeto(row: ProjetoRow): ProjetoRecord {
  const configuracoes = row.configuracoes ?? {};

  return {
    id: row.id,
    nome: row.nome?.trim() || "Projeto sem nome",
    slug: row.slug?.trim() || null,
    tipo: row.tipo ?? null,
    descricao: row.descricao?.trim() || "",
    status: row.status ?? "ativo",
    siteChatAtivo: configuracoes.site_chat_ativo === true,
  };
}

export async function listProjetos() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos")
    .select("id, nome, slug, tipo, descricao, status, configuracoes")
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("[projetos] failed to list projetos", error);
    return [];
  }

  return data.map((row) => mapProjeto(row as ProjetoRow));
}

export async function getProjetoBySlug(slug: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos")
    .select("id, nome, slug, tipo, descricao, status, configuracoes")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[projetos] failed to load projeto by slug", error);
    }
    return null;
  }

  return mapProjeto(data as ProjetoRow);
}

export async function getProjetoById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos")
    .select("id, nome, slug, tipo, descricao, status, configuracoes")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[projetos] failed to load projeto by id", error);
    }
    return null;
  }

  return mapProjeto(data as ProjetoRow);
}

export async function getProjetoByIdentifier(identifier: string) {
  const value = identifier.trim();
  if (!value) {
    return null;
  }

  const bySlug = await getProjetoBySlug(value);
  if (bySlug) {
    return bySlug;
  }

  return await getProjetoById(value);
}

export async function createProjeto(input: {
  nome: string;
  slug?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  status?: string | null;
  siteChatAtivo?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("projetos")
    .insert({
      nome: input.nome.trim(),
      slug: input.slug?.trim() || null,
      tipo: input.tipo?.trim() || null,
      descricao: input.descricao?.trim() || null,
      status: input.status?.trim() || "ativo",
      configuracoes: {
        site_chat_ativo: input.siteChatAtivo ?? false,
      },
      created_at: now,
      updated_at: now,
    } as never)
    .select("id, nome, slug, tipo, descricao, status, configuracoes")
    .single();

  if (error || !data) {
    console.error("[projetos] failed to create projeto", error);
    return null;
  }

  return mapProjeto(data as ProjetoRow);
}

export async function updateProjeto(input: {
  id: string;
  nome: string;
  slug?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  status?: string | null;
  siteChatAtivo?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const { data: current } = await supabase
    .from("projetos")
    .select("configuracoes")
    .eq("id", input.id)
    .maybeSingle<{ configuracoes: Record<string, unknown> | null }>();

  const nextConfiguracoes = {
    ...(current?.configuracoes ?? {}),
    ...(input.siteChatAtivo === undefined ? {} : { site_chat_ativo: input.siteChatAtivo }),
  };

  const { data, error } = await supabase
    .from("projetos")
    .update({
      nome: input.nome.trim(),
      slug: input.slug?.trim() || null,
      tipo: input.tipo?.trim() || null,
      descricao: input.descricao?.trim() || null,
      status: input.status?.trim() || "ativo",
      configuracoes: nextConfiguracoes,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id)
    .select("id, nome, slug, tipo, descricao, status, configuracoes")
    .single();

  if (error || !data) {
    console.error("[projetos] failed to update projeto", error);
    return null;
  }

  return mapProjeto(data as ProjetoRow);
}
