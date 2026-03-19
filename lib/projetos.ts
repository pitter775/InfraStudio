import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProjetoRecord = {
  id: string;
  nome: string;
  slug: string | null;
  tipo: string | null;
  descricao: string;
  status: string;
};

type ProjetoRow = {
  id: string;
  nome: string | null;
  slug: string | null;
  tipo: string | null;
  descricao: string | null;
  status: string | null;
};

function mapProjeto(row: ProjetoRow): ProjetoRecord {
  return {
    id: row.id,
    nome: row.nome?.trim() || "Projeto sem nome",
    slug: row.slug?.trim() || null,
    tipo: row.tipo ?? null,
    descricao: row.descricao?.trim() || "",
    status: row.status ?? "ativo",
  };
}

export async function listProjetos() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos")
    .select("id, nome, slug, tipo, descricao, status")
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
    .select("id, nome, slug, tipo, descricao, status")
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

export async function createProjeto(input: {
  nome: string;
  slug?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  status?: string | null;
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
      created_at: now,
      updated_at: now,
    } as never)
    .select("id, nome, slug, tipo, descricao, status")
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
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos")
    .update({
      nome: input.nome.trim(),
      slug: input.slug?.trim() || null,
      tipo: input.tipo?.trim() || null,
      descricao: input.descricao?.trim() || null,
      status: input.status?.trim() || "ativo",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id)
    .select("id, nome, slug, tipo, descricao, status")
    .single();

  if (error || !data) {
    console.error("[projetos] failed to update projeto", error);
    return null;
  }

  return mapProjeto(data as ProjetoRow);
}
