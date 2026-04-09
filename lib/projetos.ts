import "server-only";

import { createAgente, listAgentes } from "@/lib/agentes";
import { createApi, listApis } from "@/lib/apis";
import { createChatWidget, listChatWidgets } from "@/lib/chat-widgets";
import { AGENTE_ASSETS_BUCKET } from "@/lib/agente-assets";
import { deleteChatAttachmentsByStoragePaths } from "@/lib/chat-attachments";
import { isAgentTestChatContext } from "@/lib/chats";
import { appendSystemLog } from "@/lib/chat-logs";
import { MERCADO_LIVRE_CONNECTOR_TYPE } from "@/lib/conectores";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { purgeWhatsAppServiceSessions } from "@/lib/whatsapp-service";

export type ProjetoRecord = {
  id: string;
  nome: string;
  slug: string | null;
  tipo: string | null;
  descricao: string;
  status: string;
  modoCobranca: "plano" | "manual" | "ilimitado";
  modeloId?: string | null;
  siteChatAtivo: boolean;
  isDemo: boolean;
  demoExpiresAt: string | null;
  demoStatus: "ativo" | "expirado";
  ownerUserId: string | null;
  criadorNome: string | null;
  criadorEmail: string | null;
};

export type ProjetoOverviewRecord = ProjetoRecord & {
  stats: {
    totalAgentes: number;
    agentesAtivos: number;
    totalConectores: number;
    conectoresAtivos: number;
    totalMercadoLivre: number;
    totalWhatsAppChannels: number;
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
  modo_cobranca: "plano" | "manual" | "ilimitado" | null;
  modelo_id?: string | null;
  is_demo?: boolean | null;
  demo_expires_at?: string | null;
  demo_status?: string | null;
  owner_user_id?: string | null;
  configuracoes: Record<string, unknown> | null;
};

const projetoSelectFields =
  "id, nome, slug, tipo, descricao, status, modo_cobranca, modelo_id, is_demo, demo_expires_at, demo_status, owner_user_id, configuracoes";

type ProjetoMembershipRow = {
  projeto_id: string | null;
  created_at: string | null;
  usuarios:
    | {
        nome: string | null;
        email: string | null;
      }
    | Array<{
        nome: string | null;
        email: string | null;
      }>
    | null;
};

function extractAttachmentStoragePaths(metadata: Record<string, unknown> | null | undefined) {
  const attachments =
    metadata && Array.isArray(metadata.attachments)
      ? metadata.attachments
      : [];

  return attachments
    .map((attachment) => {
      if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
        return "";
      }

      const storagePath = "storagePath" in attachment ? String((attachment as { storagePath?: string | null }).storagePath || "").trim() : "";
      return storagePath;
    })
    .filter(Boolean);
}

function mapProjeto(row: ProjetoRow): ProjetoRecord {
  const configuracoes = row.configuracoes ?? {};

  return {
    id: row.id,
    nome: row.nome?.trim() || "Projeto sem nome",
    slug: row.slug?.trim() || null,
    tipo: row.tipo ?? null,
    descricao: row.descricao?.trim() || "",
    status: row.status ?? "ativo",
    modoCobranca: row.modo_cobranca ?? "plano",
    modeloId: row.modelo_id ?? null,
    siteChatAtivo: configuracoes.site_chat_ativo === true,
    isDemo: row.is_demo === true,
    demoExpiresAt: row.demo_expires_at ?? null,
    demoStatus: row.demo_status === "expirado" ? "expirado" : "ativo",
    ownerUserId: row.owner_user_id ?? null,
    criadorNome: null,
    criadorEmail: null,
  };
}

export async function listProjetos() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos")
    .select(projetoSelectFields)
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

  const [agentesResponse, conectoresResponse, whatsappChannelsResponse, chatsResponse, membershipsResponse] = await Promise.all([
    supabase.from("agentes").select("projeto_id, ativo").in("projeto_id", projetoIds),
    supabase.from("conectores").select("projeto_id, ativo, tipo").in("projeto_id", projetoIds),
    supabase.from("whatsapp_canais").select("projeto_id").in("projeto_id", projetoIds),
    supabase.from("chats").select("projeto_id, canal, contexto").in("projeto_id", projetoIds),
    supabase.from("usuarios_projetos").select("projeto_id, created_at, usuarios(nome, email)").in("projeto_id", projetoIds),
  ]);

  const agentesRows = (agentesResponse.data ?? []) as Array<{ projeto_id: string | null; ativo: boolean | null }>;
  const conectoresRows = (conectoresResponse.data ?? []) as Array<{ projeto_id: string | null; ativo: boolean | null; tipo: string | null }>;
  const whatsappRows = (whatsappChannelsResponse.data ?? []) as Array<{ projeto_id: string | null }>;
  const chatsRows = ((chatsResponse.data ?? []) as Array<{ projeto_id: string | null; canal?: string | null; contexto?: Record<string, unknown> | null }>)
    .filter((item) => item.canal !== "admin_agent_test" && !isAgentTestChatContext(item.contexto));
  const membershipsRows = (membershipsResponse.data ?? []) as ProjetoMembershipRow[];

  return projetos.map<ProjetoOverviewRecord>((projeto) => {
    const agentes = agentesRows.filter((item) => item.projeto_id === projeto.id);
    const conectores = conectoresRows.filter((item) => item.projeto_id === projeto.id);
    const mercadoLivre = conectores.filter((item) => (item.tipo ?? "").trim() === MERCADO_LIVRE_CONNECTOR_TYPE);
    const whatsappChannels = whatsappRows.filter((item) => item.projeto_id === projeto.id);
    const chats = chatsRows.filter((item) => item.projeto_id === projeto.id);
    const criador = membershipsRows
      .filter((item) => item.projeto_id === projeto.id)
      .sort((left, right) => new Date(left.created_at ?? 0).getTime() - new Date(right.created_at ?? 0).getTime())[0] ?? null;
    const creatorUser = Array.isArray(criador?.usuarios) ? criador?.usuarios[0] ?? null : criador?.usuarios ?? null;

    return {
      ...projeto,
      criadorNome: creatorUser?.nome?.trim() || projeto.criadorNome,
      criadorEmail: creatorUser?.email?.trim() || projeto.criadorEmail,
      stats: {
        totalAgentes: agentes.length,
        agentesAtivos: agentes.filter((item) => item.ativo !== false).length,
        totalConectores: conectores.length,
        conectoresAtivos: conectores.filter((item) => item.ativo !== false).length,
        totalMercadoLivre: mercadoLivre.length,
        totalWhatsAppChannels: whatsappChannels.length,
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
    .select(`projetos(${projetoSelectFields})`)
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
    .select(projetoSelectFields)
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
    .select(projetoSelectFields)
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

async function getDemoTemplateProjeto() {
  const templateProjectId = process.env.DEMO_TEMPLATE_PROJECT_ID?.trim() || "";
  console.log("DEMO TEMPLATE USADO:", templateProjectId);

  if (!templateProjectId) {
    throw new Error("DEMO_TEMPLATE_PROJECT_ID nao configurado.");
  }

  const templateProjeto = await getProjetoById(templateProjectId);
  if (!templateProjeto) {
    throw new Error(`Projeto template demo nao encontrado: ${templateProjectId}`);
  }

  if (templateProjeto.ownerUserId === null) {
    return templateProjeto;
  }

  return templateProjeto;
}

export async function getDemoProjetoByOwner(usuarioId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos")
    .select(projetoSelectFields)
    .eq("is_demo", true)
    .eq("owner_user_id", usuarioId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[projetos] failed to load owned demo projeto", error);
    }
    return null;
  }

  return mapProjeto(data as ProjetoRow);
}

async function projetoNeedsDemoHydration(projetoId: string) {
  const [agentes, apis, widgets] = await Promise.all([
    listAgentes(projetoId),
    listApis(projetoId),
    listChatWidgets(projetoId),
  ]);

  return agentes.length === 0 && apis.length === 0 && widgets.length === 0;
}

async function cloneDemoTemplateStructure(sourceProjetoId: string, targetProjetoId: string) {
  const [sourceApis, sourceAgentes, sourceWidgets] = await Promise.all([
    listApis(sourceProjetoId),
    listAgentes(sourceProjetoId),
    listChatWidgets(sourceProjetoId),
  ]);

  const apiIdMap = new Map<string, string>();
  for (const api of sourceApis) {
    const createdApi = await createApi({
      projetoId: targetProjetoId,
      nome: api.nome,
      url: api.url,
      metodo: api.metodo,
      descricao: api.descricao,
      ativo: api.ativo,
      campos: api.campos.map((campo) => ({
        nome: campo.nome,
        tipo: campo.tipo,
        descricao: campo.descricao,
      })),
      parametros: api.parametros,
    });

    if (createdApi) {
      apiIdMap.set(api.id, createdApi.id);
    }
  }

  const agenteIdMap = new Map<string, string>();
  for (const agente of sourceAgentes) {
    const createdAgente = await createAgente({
      projetoId: targetProjetoId,
      slug: null,
      nome: agente.nome,
      descricao: agente.descricao,
      promptBase: agente.promptBase,
      configuracoes: agente.configuracoes,
      ativo: agente.ativo,
      apiIds: agente.apiIds.map((apiId) => apiIdMap.get(apiId)).filter((apiId): apiId is string => Boolean(apiId)),
    });

    if (createdAgente) {
      agenteIdMap.set(agente.id, createdAgente.id);
    }
  }

  for (const widget of sourceWidgets) {
    await createChatWidget({
      nome: widget.nome,
      slug: `${widget.slug}-${targetProjetoId.slice(0, 8)}`,
      projetoId: targetProjetoId,
      agenteId: widget.agenteId ? (agenteIdMap.get(widget.agenteId) ?? null) : null,
      dominio: widget.dominio,
      whatsappCelular: "",
      tema: widget.tema,
      corPrimaria: widget.corPrimaria,
      fundoTransparente: widget.fundoTransparente,
      ativo: widget.ativo,
    });
  }
}

export async function createProjeto(input: {
  nome: string;
  slug?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  status?: string | null;
  modoCobranca?: "plano" | "manual" | "ilimitado";
  siteChatAtivo?: boolean;
  ownerUserId?: string | null;
  modeloId?: string | null;
  isDemo?: boolean;
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
      modo_cobranca: input.modoCobranca ?? "plano",
      owner_user_id: input.ownerUserId ?? null,
      modelo_id: input.modeloId ?? null,
      is_demo: input.isDemo === true,
      demo_expires_at: input.isDemo === true ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null,
      demo_status: input.isDemo === true ? "ativo" : null,
      configuracoes: {
        site_chat_ativo: input.siteChatAtivo ?? false,
      },
      created_at: now,
      updated_at: now,
    } as never)
    .select(projetoSelectFields)
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
  modoCobranca?: "plano" | "manual" | "ilimitado";
  siteChatAtivo?: boolean;
  modeloId?: string | null;
  isDemo?: boolean;
  membershipRole?: "admin" | "viewer";
}) {
  const supabase = getSupabaseAdminClient();
  const projeto = await createProjeto({
    nome: input.nome,
    slug: input.slug,
    tipo: input.tipo,
    descricao: input.descricao,
    status: input.status,
    modoCobranca: input.modoCobranca,
    siteChatAtivo: input.siteChatAtivo,
    ownerUserId: input.usuarioId,
    modeloId: input.modeloId,
    isDemo: input.isDemo,
  });

  if (!projeto) {
    return null;
  }

  const { error } = await supabase
    .from("usuarios_projetos")
    .insert({
      usuario_id: input.usuarioId,
      projeto_id: projeto.id,
      papel: input.membershipRole ?? "admin",
      created_at: new Date().toISOString(),
    } as never);

  if (error) {
    console.error("[projetos] failed to create usuario_projeto link", error);
    await supabase.from("projetos").delete().eq("id", projeto.id);
    return null;
  }

  return projeto;
}

export async function ensureDemoProjetoForUsuario(usuarioId: string) {
  const templateProjeto = await getDemoTemplateProjeto();
  const existingProjeto = await getDemoProjetoByOwner(usuarioId);
  if (existingProjeto) {
    if (templateProjeto.id !== existingProjeto.id && (await projetoNeedsDemoHydration(existingProjeto.id))) {
      await cloneDemoTemplateStructure(templateProjeto.id, existingProjeto.id);
    }
    return existingProjeto;
  }

  const projeto = await createProjetoForUsuario({
    usuarioId,
    nome: templateProjeto.nome,
    tipo: templateProjeto.tipo ?? "demo",
    descricao: templateProjeto.descricao || "Projeto temporario de demonstracao.",
    status: templateProjeto.status,
    modoCobranca: templateProjeto.modoCobranca,
    siteChatAtivo: templateProjeto.siteChatAtivo,
    modeloId: templateProjeto.modeloId ?? null,
    isDemo: true,
    membershipRole: "viewer",
  });

  if (projeto && templateProjeto.id !== projeto.id) {
    await cloneDemoTemplateStructure(templateProjeto.id, projeto.id);
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
  modoCobranca?: "plano" | "manual" | "ilimitado";
  siteChatAtivo?: boolean;
  modeloId?: string | null;
  ownerUserId?: string | null;
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
      modo_cobranca: input.modoCobranca ?? undefined,
      ...(input.modeloId !== undefined ? { modelo_id: input.modeloId } : {}),
      ...(input.ownerUserId !== undefined ? { owner_user_id: input.ownerUserId } : {}),
      configuracoes: nextConfiguracoes,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id)
    .select(projetoSelectFields)
    .single();

  if (error || !data) {
    console.error("[projetos] failed to update projeto", error);
    return null;
  }

  return mapProjeto(data as ProjetoRow);
}

export type DeleteProjetoResult = {
  ok: boolean;
  step?: string;
  error?: string;
};

export async function deleteProjeto(id: string): Promise<DeleteProjetoResult> {
  const supabase = getSupabaseAdminClient();
  const fail = async (step: string, error?: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message ?? step)
          : step;

    console.error(`[projetos] failed at ${step}`, error);
    await appendSystemLog({
      projetoId: id,
      tipo: "project_delete_failure",
      origem: "lib.projetos.deleteProjeto",
      descricao: `Falha ao excluir projeto: ${step}.`,
      payload: {
        step,
        message,
      },
    });

    return {
      ok: false,
      step,
      error: message,
    } satisfies DeleteProjetoResult;
  };

  const purge = await purgeWhatsAppServiceSessions({ projetoId: id });
  if (!purge.ok) {
    return await fail("purge whatsapp-service sessions", purge.error);
  }

  const { data: assetsData, error: assetsReadError } = await supabase
    .from("agente_arquivos")
    .select("storage_path")
    .eq("projeto_id", id);

  if (assetsReadError) {
    return await fail("read project assets", assetsReadError);
  }

  const storagePaths = ((assetsData ?? []) as Array<{ storage_path: string | null }>)
    .map((item) => item.storage_path?.trim() || "")
    .filter(Boolean);

  if (storagePaths.length) {
    const storageResult = await supabase.storage.from(AGENTE_ASSETS_BUCKET).remove(storagePaths);
    if (storageResult.error) {
      return await fail("delete project asset files", storageResult.error);
    }
  }

  const { data: chatsData, error: chatsReadError } = await supabase.from("chats").select("id").eq("projeto_id", id);
  if (chatsReadError) {
    return await fail("read project chats", chatsReadError);
  }

  const chatIds = ((chatsData ?? []) as Array<{ id: string | null }>).map((item) => item.id).filter(Boolean) as string[];
  if (chatIds.length) {
    const { data: messagesData, error: messagesReadError } = await supabase
      .from("mensagens")
      .select("id, metadata")
      .in("chat_id", chatIds);

    if (messagesReadError) {
      return await fail("read project chat attachments", messagesReadError);
    }

    const chatAttachmentStoragePaths = ((messagesData ?? []) as Array<{ metadata?: Record<string, unknown> | null }>)
      .flatMap((message) => extractAttachmentStoragePaths(message.metadata))
      .filter(Boolean);

    if (chatAttachmentStoragePaths.length) {
      await deleteChatAttachmentsByStoragePaths(chatAttachmentStoragePaths);
    }

    const { error: handoffEventsError } = await supabase.from("chat_handoff_eventos").delete().in("chat_id", chatIds);
    if (handoffEventsError) {
      return await fail("delete project chat handoff events", handoffEventsError);
    }

    const { error: handoffError } = await supabase.from("chat_handoffs").delete().in("chat_id", chatIds);
    if (handoffError) {
      return await fail("delete project chat handoffs", handoffError);
    }

    const { error: messageError } = await supabase.from("mensagens").delete().in("chat_id", chatIds);
    if (messageError) {
      return await fail("delete project chat messages", messageError);
    }
  }

  const { data: apisData, error: apisReadError } = await supabase.from("apis").select("id").eq("projeto_id", id);
  if (apisReadError) {
    return await fail("read project apis", apisReadError);
  }

  const apiIds = ((apisData ?? []) as Array<{ id: string | null }>).map((item) => item.id).filter(Boolean) as string[];
  if (apiIds.length) {
    const { error: agentApiError } = await supabase.from("agente_api").delete().in("api_id", apiIds);
    if (agentApiError) {
      return await fail("delete project api links", agentApiError);
    }

    const { error: apiFieldError } = await supabase.from("api_campos").delete().in("api_id", apiIds);
    if (apiFieldError) {
      return await fail("delete project api fields", apiFieldError);
    }
  }

  const { data: agentsData, error: agentsReadError } = await supabase.from("agentes").select("id").eq("projeto_id", id);
  if (agentsReadError) {
    return await fail("read project agents", agentsReadError);
  }

  const agentIds = ((agentsData ?? []) as Array<{ id: string | null }>).map((item) => item.id).filter(Boolean) as string[];
  if (agentIds.length) {
    const { error: agentApiByAgentError } = await supabase.from("agente_api").delete().in("agente_id", agentIds);
    if (agentApiByAgentError) {
      return await fail("delete project agent api links", agentApiByAgentError);
    }
  }

  const deletions = [
    { label: "project legacy billing subscriptions", execute: () => supabase.from("projetos_assinaturas").delete().eq("projeto_id", id) },
    { label: "project billing cycles", execute: () => supabase.from("projetos_ciclos_uso").delete().eq("projeto_id", id) },
    { label: "project billing snapshot", execute: () => supabase.from("projetos_planos").delete().eq("projeto_id", id) },
    { label: "project legacy user limits", execute: () => supabase.from("usuarios_limites_ia").delete().eq("projeto_id", id) },
    { label: "project usage rows", execute: () => supabase.from("consumos").delete().eq("projeto_id", id) },
    { label: "project logs", execute: () => supabase.from("logs").delete().eq("projeto_id", id) },
    { label: "project secrets", execute: () => supabase.from("segredos").delete().eq("projeto_id", id) },
    { label: "project memberships", execute: () => supabase.from("usuarios_projetos").delete().eq("projeto_id", id) },
    { label: "project widgets", execute: () => supabase.from("chat_widgets").delete().eq("projeto_id", id) },
    { label: "project whatsapp channels", execute: () => supabase.from("canais_whatsapp").delete().eq("projeto_id", id) },
    { label: "project whatsapp handoff contacts", execute: () => supabase.from("whatsapp_handoff_contatos").delete().eq("projeto_id", id) },
    { label: "project connectors", execute: () => supabase.from("conectores").delete().eq("projeto_id", id) },
    { label: "project asset rows", execute: () => supabase.from("agente_arquivos").delete().eq("projeto_id", id) },
    { label: "project chats", execute: () => supabase.from("chats").delete().eq("projeto_id", id) },
    { label: "project apis", execute: () => supabase.from("apis").delete().eq("projeto_id", id) },
    { label: "project agents", execute: () => supabase.from("agentes").delete().eq("projeto_id", id) },
  ];

  for (const item of deletions) {
    const { error } = await item.execute();
    if (error) {
      return await fail(item.label, error);
    }
  }

  const { error } = await supabase.from("projetos").delete().eq("id", id);
  if (error) {
    return await fail("delete projeto row", error);
  }

  return { ok: true };
}

export async function listExpiredDemoProjetosForCleanup(safetyWindowMs = 60 * 60 * 1000) {
  const supabase = getSupabaseAdminClient();
  const threshold = new Date(Date.now() - Math.max(0, safetyWindowMs)).toISOString();
  const { data, error } = await supabase
    .from("projetos")
    .select(projetoSelectFields)
    .eq("is_demo", true)
    .eq("demo_status", "expirado")
    .lt("demo_expires_at", threshold)
    .order("demo_expires_at", { ascending: true });

  if (error || !data) {
    console.error("[projetos] failed to list expired demo projetos for cleanup", error);
    return [];
  }

  return (data as ProjetoRow[]).map((row) => mapProjeto(row));
}

export async function cleanupExpiredDemoProjetos(safetyWindowMs = 60 * 60 * 1000) {
  const projetos = await listExpiredDemoProjetosForCleanup(safetyWindowMs);
  const projetosProcessados: string[] = [];
  const falhas: Array<{ projetoId: string; step?: string; error?: string }> = [];
  let totalRemovido = 0;

  for (const projeto of projetos) {
    if (!projeto.isDemo) {
      continue;
    }

    projetosProcessados.push(projeto.id);
    const deleted = await deleteProjeto(projeto.id);
    if (deleted.ok) {
      totalRemovido += 1;
      continue;
    }

    falhas.push({
      projetoId: projeto.id,
      step: deleted.step,
      error: deleted.error,
    });
  }

  await appendSystemLog({
    tipo: "demo_cleanup",
    origem: "lib.projetos.cleanupExpiredDemoProjetos",
    descricao: "Limpeza automatica de projetos demo expirados executada.",
    payload: {
      total_removido: totalRemovido,
      projetos_processados: projetosProcessados,
      falhas,
    },
  });

  return {
    totalRemovido,
    projetosProcessados,
    falhas,
  };
}
