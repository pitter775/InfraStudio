import "server-only";

import { listApiIdsByAgentes, syncAgenteApis } from "@/lib/apis";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AgenteRecord = {
  id: string;
  nome: string;
  slug: string | null;
  descricao: string;
  promptBase: string;
  configuracoes: Record<string, unknown> | null;
  ativo: boolean;
  projetoId: string | null;
  projetoNome?: string | null;
  projetoSlug?: string | null;
  modeloId: string | null;
  apiIds: string[];
  createdAt: string;
};

type AgenteRow = {
  id: string;
  slug: string | null;
  nome: string | null;
  descricao: string | null;
  prompt_base: string | null;
  configuracoes: Record<string, unknown> | null;
  ativo: boolean | null;
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
  modelo_id: string | null;
  created_at: string | null;
};

function mapAgente(row: AgenteRow): AgenteRecord {
  return {
    id: row.id,
    slug: row.slug?.trim() || null,
    nome: row.nome?.trim() || "Agente sem nome",
    descricao: row.descricao?.trim() || "",
    promptBase: row.prompt_base?.trim() || "",
    configuracoes: row.configuracoes ?? null,
    ativo: Boolean(row.ativo),
    projetoId: row.projeto_id,
    projetoNome: Array.isArray(row.projetos) ? row.projetos[0]?.nome ?? null : row.projetos?.nome ?? null,
    projetoSlug: Array.isArray(row.projetos) ? row.projetos[0]?.slug ?? null : row.projetos?.slug ?? null,
    modeloId: row.modelo_id,
    apiIds: [],
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

async function attachApiIds(agentes: AgenteRecord[]) {
  if (!agentes.length) {
    return agentes;
  }

  const apiIdsByAgente = await listApiIdsByAgentes(agentes.map((agente) => agente.id));
  return agentes.map((agente) => ({
    ...agente,
    apiIds: apiIdsByAgente.get(agente.id) ?? [],
  }));
}

export async function listAgentes(projetoId?: string | null) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("agentes")
    .select("id, slug, nome, descricao, prompt_base, configuracoes, ativo, projeto_id, projetos(nome, slug), modelo_id, created_at")
    .order("created_at", { ascending: true });

  if (projetoId) {
    query = query.eq("projeto_id", projetoId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("[agentes] failed to list agents", error);
    return [];
  }

  return await attachApiIds(data.map((row) => mapAgente(row as AgenteRow)));
}

export async function getAgenteAtivo(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("agentes")
    .select("id, slug, nome, descricao, prompt_base, configuracoes, ativo, projeto_id, projetos(nome, slug), modelo_id, created_at")
    .eq("projeto_id", projetoId)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[agentes] failed to load active agent", error);
    }
    return null;
  }

  const [agente] = await attachApiIds([mapAgente(data as AgenteRow)]);
  return agente ?? null;
}

async function disableOtherAgents(exceptId: string, projetoId: string | null) {
  if (!projetoId) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("agentes")
    .update({ ativo: false } as never)
    .eq("projeto_id", projetoId)
    .neq("id", exceptId);

  if (error) {
    console.error("[agentes] failed to disable other active agents", error);
  }
}

export async function createAgente(input: {
  projetoId: string;
  slug?: string | null;
  nome: string;
  descricao?: string;
  promptBase?: string;
  configuracoes?: Record<string, unknown> | null;
  ativo?: boolean;
  apiIds?: string[];
}) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("agentes")
    .insert({
      projeto_id: input.projetoId,
      slug: input.slug?.trim() || null,
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      prompt_base: input.promptBase?.trim() || null,
      configuracoes: input.configuracoes ?? null,
      ativo: input.ativo ?? true,
      created_at: now,
      updated_at: now,
    } as never)
    .select("id, slug, nome, descricao, prompt_base, configuracoes, ativo, projeto_id, projetos(nome, slug), modelo_id, created_at")
    .single();

  if (error || !data) {
    console.error("[agentes] failed to create agent", error);
    return null;
  }

  const agente = mapAgente(data as AgenteRow);
  if (agente.ativo) {
    await disableOtherAgents(agente.id, agente.projetoId);
  }

  await syncAgenteApis(agente.id, input.projetoId, input.apiIds ?? []);
  const [withApis] = await attachApiIds([agente]);
  return withApis ?? null;
}

export async function updateAgente(input: {
  id: string;
  projetoId?: string | null;
  slug?: string | null;
  nome: string;
  descricao?: string;
  promptBase?: string;
  configuracoes?: Record<string, unknown> | null;
  ativo?: boolean;
  apiIds?: string[];
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("agentes")
    .update({
      projeto_id: input.projetoId ?? undefined,
      slug: input.slug?.trim() || null,
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      prompt_base: input.promptBase?.trim() || null,
      configuracoes: input.configuracoes ?? null,
      ativo: input.ativo ?? false,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id)
    .select("id, slug, nome, descricao, prompt_base, configuracoes, ativo, projeto_id, projetos(nome, slug), modelo_id, created_at")
    .single();

  if (error || !data) {
    console.error("[agentes] failed to update agent", error);
    return null;
  }

  const agente = mapAgente(data as AgenteRow);
  if (agente.ativo) {
    await disableOtherAgents(agente.id, agente.projetoId);
  }

  if (agente.projetoId) {
    await syncAgenteApis(agente.id, agente.projetoId, input.apiIds ?? []);
  }

  const [withApis] = await attachApiIds([agente]);
  return withApis ?? null;
}
