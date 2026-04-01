import "server-only";

import { listAgenteAssetsByAgenteIds, type AgenteAssetRecord } from "@/lib/agente-assets";
import { listApiIdsByAgentes, syncAgenteApis } from "@/lib/apis";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { purgeWhatsAppServiceSessions } from "@/lib/whatsapp-service";

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
  arquivos: AgenteAssetRecord[];
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
    arquivos: [],
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

async function attachRelations(agentes: AgenteRecord[]) {
  if (!agentes.length) {
    return agentes;
  }

  const agenteIds = agentes.map((agente) => agente.id);
  const [apiIdsByAgente, assetsByAgente] = await Promise.all([
    listApiIdsByAgentes(agenteIds),
    listAgenteAssetsByAgenteIds(agenteIds),
  ]);

  return agentes.map((agente) => ({
    ...agente,
    apiIds: apiIdsByAgente.get(agente.id) ?? [],
    arquivos: assetsByAgente.get(agente.id) ?? [],
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

  return await attachRelations(data.map((row) => mapAgente(row as AgenteRow)));
}

export async function getAgenteAtivo(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("agentes")
    .select("id, slug, nome, descricao, prompt_base, configuracoes, ativo, projeto_id, projetos(nome, slug), modelo_id, created_at")
    .eq("projeto_id", projetoId)
    .eq("ativo", true)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[agentes] failed to load active agent", error);
    }
    return null;
  }

  const [agente] = await attachRelations([mapAgente(data as AgenteRow)]);
  return agente ?? null;
}

export async function getAgenteById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("agentes")
    .select("id, slug, nome, descricao, prompt_base, configuracoes, ativo, projeto_id, projetos(nome, slug), modelo_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[agentes] failed to load agent by id", error);
    }
    return null;
  }

  const [agente] = await attachRelations([mapAgente(data as AgenteRow)]);
  return agente ?? null;
}

export async function getAgenteBySlug(slug: string, projetoId?: string | null) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("agentes")
    .select("id, slug, nome, descricao, prompt_base, configuracoes, ativo, projeto_id, projetos(nome, slug), modelo_id, created_at")
    .eq("slug", slug)
    .limit(1);

  if (projetoId) {
    query = query.eq("projeto_id", projetoId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[agentes] failed to load agent by slug", error);
    }
    return null;
  }

  const [agente] = await attachRelations([mapAgente(data as AgenteRow)]);
  return agente ?? null;
}

export async function getAgenteByIdentifier(identifier: string, projetoId?: string | null) {
  const value = identifier.trim();
  if (!value) {
    return null;
  }

  const bySlug = await getAgenteBySlug(value, projetoId);
  if (bySlug) {
    return bySlug;
  }

  const byId = await getAgenteById(value);
  if (!byId) {
    return null;
  }

  if (projetoId && byId.projetoId !== projetoId) {
    return null;
  }

  return byId;
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

async function disableAllProjectAgents(projetoId: string | null) {
  if (!projetoId) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("agentes")
    .update({ ativo: false } as never)
    .eq("projeto_id", projetoId)
    .eq("ativo", true);

  if (error) {
    console.error("[agentes] failed to disable active project agents before save", error);
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
  const shouldActivate = input.ativo ?? true;

  if (shouldActivate) {
    await disableAllProjectAgents(input.projetoId);
  }

  const { data, error } = await supabase
    .from("agentes")
    .insert({
      projeto_id: input.projetoId,
      slug: input.slug?.trim() || null,
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      prompt_base: input.promptBase?.trim() || null,
      configuracoes: input.configuracoes ?? null,
      ativo: shouldActivate,
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
  const [withApis] = await attachRelations([agente]);
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
  const current = await getAgenteById(input.id);
  const nextProjectId = input.projetoId ?? current?.projetoId ?? null;
  const shouldActivate = input.ativo ?? false;

  if (shouldActivate) {
    await disableAllProjectAgents(nextProjectId);
  }

  const { data, error } = await supabase
    .from("agentes")
    .update({
      projeto_id: nextProjectId ?? undefined,
      slug: input.slug?.trim() || null,
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      prompt_base: input.promptBase?.trim() || null,
      configuracoes: input.configuracoes ?? null,
      ativo: shouldActivate,
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

  const [withApis] = await attachRelations([agente]);
  return withApis ?? null;
}

export async function deleteAgente(id: string) {
  const supabase = getSupabaseAdminClient();
  const agente = await getAgenteById(id);
  if (!agente) {
    return false;
  }

  const purge = await purgeWhatsAppServiceSessions({ agenteId: id });
  if (!purge.ok) {
    console.error("[agentes] failed to purge whatsapp-service sessions", purge.error);
    return false;
  }

  const assetsByAgente = await listAgenteAssetsByAgenteIds([id]);
  const assets = assetsByAgente.get(id) ?? [];
  const storagePaths = assets.map((asset) => asset.storagePath).filter(Boolean);

  if (storagePaths.length) {
    const storageResult = await supabase.storage.from("agente-assets").remove(storagePaths);
    if (storageResult.error) {
      console.error("[agentes] failed to delete agent asset files", storageResult.error);
      return false;
    }
  }

  const { error: assetError } = await supabase.from("agente_arquivos").delete().eq("agente_id", id);
  if (assetError) {
    console.error("[agentes] failed to delete agent assets", assetError);
    return false;
  }

  const { data: chatsData, error: chatsReadError } = await supabase.from("chats").select("id").eq("agente_id", id);
  if (chatsReadError) {
    console.error("[agentes] failed to list agent chats", chatsReadError);
    return false;
  }

  const chatIds = ((chatsData ?? []) as Array<{ id: string | null }>).map((item) => item.id).filter(Boolean) as string[];
  if (chatIds.length) {
    const { error: messageError } = await supabase.from("mensagens").delete().in("chat_id", chatIds);
    if (messageError) {
      console.error("[agentes] failed to delete agent chat messages", messageError);
      return false;
    }
  }

  const { error: chatsError } = await supabase.from("chats").delete().eq("agente_id", id);
  if (chatsError) {
    console.error("[agentes] failed to delete agent chats", chatsError);
    return false;
  }

  const { error: widgetError } = await supabase.from("chat_widgets").delete().eq("agente_id", id);
  if (widgetError) {
    console.error("[agentes] failed to delete agent widgets", widgetError);
    return false;
  }

  const { error: channelError } = await supabase.from("canais_whatsapp").delete().eq("agente_id", id);
  if (channelError) {
    console.error("[agentes] failed to delete agent whatsapp channels", channelError);
    return false;
  }

  const { error: connectorError } = await supabase.from("conectores").delete().eq("agente_id", id);
  if (connectorError) {
    console.error("[agentes] failed to delete agent connectors", connectorError);
    return false;
  }

  const { error: apiLinkError } = await supabase.from("agente_api").delete().eq("agente_id", id);
  if (apiLinkError) {
    console.error("[agentes] failed to delete agent api links", apiLinkError);
    return false;
  }

  const { error } = await supabase.from("agentes").delete().eq("id", id);
  if (error) {
    console.error("[agentes] failed to delete agent", error);
    return false;
  }

  return true;
}
