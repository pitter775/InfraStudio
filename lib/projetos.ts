import "server-only";

import { AGENTE_ASSETS_BUCKET } from "@/lib/agente-assets";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { purgeWhatsAppServiceSessions } from "@/lib/whatsapp-service";

export type ProjetoRecord = {
  id: string;
  nome: string;
  slug: string | null;
  tipo: string | null;
  descricao: string;
  status: string;
  siteChatAtivo: boolean;
};

export type ProjetoOverviewRecord = ProjetoRecord & {
  stats: {
    totalAgentes: number;
    agentesAtivos: number;
    totalConectores: number;
    conectoresAtivos: number;
    totalChats: number;
  };
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

async function attachProjetoStats(projetos: ProjetoRecord[]) {
  if (!projetos.length) {
    return [] as ProjetoOverviewRecord[];
  }

  const supabase = getSupabaseAdminClient();
  const projetoIds = projetos.map((projeto) => projeto.id);

  const [agentesResponse, conectoresResponse, chatsResponse] = await Promise.all([
    supabase.from("agentes").select("projeto_id, ativo").in("projeto_id", projetoIds),
    supabase.from("conectores").select("projeto_id, ativo").in("projeto_id", projetoIds),
    supabase.from("chats").select("projeto_id").in("projeto_id", projetoIds),
  ]);

  const agentesRows = (agentesResponse.data ?? []) as Array<{ projeto_id: string | null; ativo: boolean | null }>;
  const conectoresRows = (conectoresResponse.data ?? []) as Array<{ projeto_id: string | null; ativo: boolean | null }>;
  const chatsRows = (chatsResponse.data ?? []) as Array<{ projeto_id: string | null }>;

  return projetos.map<ProjetoOverviewRecord>((projeto) => {
    const agentes = agentesRows.filter((item) => item.projeto_id === projeto.id);
    const conectores = conectoresRows.filter((item) => item.projeto_id === projeto.id);
    const chats = chatsRows.filter((item) => item.projeto_id === projeto.id);

    return {
      ...projeto,
      stats: {
        totalAgentes: agentes.length,
        agentesAtivos: agentes.filter((item) => item.ativo !== false).length,
        totalConectores: conectores.length,
        conectoresAtivos: conectores.filter((item) => item.ativo !== false).length,
        totalChats: chats.length,
      },
    };
  });
}

export async function listProjetosWithStats() {
  const projetos = await listProjetos();
  return attachProjetoStats(projetos);
}

export async function listProjetosByUsuario(usuarioId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usuarios_projetos")
    .select("projetos(id, nome, slug, tipo, descricao, status, configuracoes)")
    .eq("usuario_id", usuarioId);

  if (error || !data) {
    console.error("[projetos] failed to list projetos by usuario", error);
    return [];
  }

  const projetos = data
    .map((row) => {
      const projeto = Array.isArray((row as { projetos?: ProjetoRow | ProjetoRow[] | null }).projetos)
        ? (row as { projetos?: ProjetoRow[] | null }).projetos?.[0] ?? null
        : ((row as { projetos?: ProjetoRow | null }).projetos ?? null);

      return projeto ? mapProjeto(projeto) : null;
    })
    .filter((item): item is ProjetoRecord => Boolean(item));

  return projetos.sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));
}

export async function listProjetosByUsuarioWithStats(usuarioId: string) {
  const projetos = await listProjetosByUsuario(usuarioId);
  return attachProjetoStats(projetos);
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

export async function createProjetoForUsuario(input: {
  usuarioId: string;
  nome: string;
  slug?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  status?: string | null;
  siteChatAtivo?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const projeto = await createProjeto(input);

  if (!projeto) {
    return null;
  }

  const { error } = await supabase
    .from("usuarios_projetos")
    .insert({
      usuario_id: input.usuarioId,
      projeto_id: projeto.id,
      papel: "admin",
      created_at: new Date().toISOString(),
    } as never);

  if (error) {
    console.error("[projetos] failed to create usuario_projeto link", error);
    await supabase.from("projetos").delete().eq("id", projeto.id);
    return null;
  }

  return projeto;
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

export async function deleteProjeto(id: string) {
  const supabase = getSupabaseAdminClient();

  const purge = await purgeWhatsAppServiceSessions({ projetoId: id });
  if (!purge.ok) {
    console.error("[projetos] failed to purge whatsapp-service sessions", purge.error);
    return false;
  }

  const { data: assetsData, error: assetsReadError } = await supabase
    .from("agente_arquivos")
    .select("storage_path")
    .eq("projeto_id", id);

  if (assetsReadError) {
    console.error("[projetos] failed to list project assets", assetsReadError);
    return false;
  }

  const storagePaths = ((assetsData ?? []) as Array<{ storage_path: string | null }>)
    .map((item) => item.storage_path?.trim() || "")
    .filter(Boolean);

  if (storagePaths.length) {
    const storageResult = await supabase.storage.from(AGENTE_ASSETS_BUCKET).remove(storagePaths);
    if (storageResult.error) {
      console.error("[projetos] failed to delete project asset files", storageResult.error);
      return false;
    }
  }

  const { data: chatsData, error: chatsReadError } = await supabase.from("chats").select("id").eq("projeto_id", id);
  if (chatsReadError) {
    console.error("[projetos] failed to list project chats", chatsReadError);
    return false;
  }

  const chatIds = ((chatsData ?? []) as Array<{ id: string | null }>).map((item) => item.id).filter(Boolean) as string[];
  if (chatIds.length) {
    const { error: messageError } = await supabase.from("mensagens").delete().in("chat_id", chatIds);
    if (messageError) {
      console.error("[projetos] failed to delete project chat messages", messageError);
      return false;
    }
  }

  const { data: apisData, error: apisReadError } = await supabase.from("apis").select("id").eq("projeto_id", id);
  if (apisReadError) {
    console.error("[projetos] failed to list project apis", apisReadError);
    return false;
  }

  const apiIds = ((apisData ?? []) as Array<{ id: string | null }>).map((item) => item.id).filter(Boolean) as string[];
  if (apiIds.length) {
    const { error: agentApiError } = await supabase.from("agente_api").delete().in("api_id", apiIds);
    if (agentApiError) {
      console.error("[projetos] failed to delete project api links", agentApiError);
      return false;
    }

    const { error: apiFieldError } = await supabase.from("api_campos").delete().in("api_id", apiIds);
    if (apiFieldError) {
      console.error("[projetos] failed to delete project api fields", apiFieldError);
      return false;
    }
  }

  const { data: agentsData, error: agentsReadError } = await supabase.from("agentes").select("id").eq("projeto_id", id);
  if (agentsReadError) {
    console.error("[projetos] failed to list project agents", agentsReadError);
    return false;
  }

  const agentIds = ((agentsData ?? []) as Array<{ id: string | null }>).map((item) => item.id).filter(Boolean) as string[];
  if (agentIds.length) {
    const { error: agentApiByAgentError } = await supabase.from("agente_api").delete().in("agente_id", agentIds);
    if (agentApiByAgentError) {
      console.error("[projetos] failed to delete project agent api links", agentApiByAgentError);
      return false;
    }
  }

  const deletions = [
    { label: "project logs", execute: () => supabase.from("logs").delete().eq("projeto_id", id) },
    { label: "project secrets", execute: () => supabase.from("segredos").delete().eq("projeto_id", id) },
    { label: "project memberships", execute: () => supabase.from("usuarios_projetos").delete().eq("projeto_id", id) },
    { label: "project widgets", execute: () => supabase.from("chat_widgets").delete().eq("projeto_id", id) },
    { label: "project whatsapp channels", execute: () => supabase.from("canais_whatsapp").delete().eq("projeto_id", id) },
    { label: "project connectors", execute: () => supabase.from("conectores").delete().eq("projeto_id", id) },
    { label: "project asset rows", execute: () => supabase.from("agente_arquivos").delete().eq("projeto_id", id) },
    { label: "project chats", execute: () => supabase.from("chats").delete().eq("projeto_id", id) },
    { label: "project apis", execute: () => supabase.from("apis").delete().eq("projeto_id", id) },
    { label: "project agents", execute: () => supabase.from("agentes").delete().eq("projeto_id", id) },
  ];

  for (const item of deletions) {
    const { error } = await item.execute();
    if (error) {
      console.error(`[projetos] failed to delete ${item.label}`, error);
      return false;
    }
  }

  const { error } = await supabase.from("projetos").delete().eq("id", id);
  if (error) {
    console.error("[projetos] failed to delete projeto", error);
    return false;
  }

  return true;
}
