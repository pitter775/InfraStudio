import "server-only";

import { randomUUID } from "crypto";
import { createAgente, listAgentes } from "@/lib/agentes";
import { createApi, listApis } from "@/lib/apis";
import { listChatWidgets, createChatWidget } from "@/lib/chat-widgets";
import { deleteChatConversation, listChats } from "@/lib/chats";
import { listConectores, createConector } from "@/lib/conectores";
import { buildDemoExpirationDate, sanitizeConnectorConfigForDemo } from "@/lib/demo";
import { getProjetoById, listProjetosByUsuario, updateProjeto, createProjetoForUsuario, type ProjetoRecord } from "@/lib/projetos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { listWhatsAppChannels, updateWhatsAppChannelSession } from "@/lib/whatsapp-channels";
import { purgeWhatsAppServiceSessions } from "@/lib/whatsapp-service";

const DEMO_TEMPLATE_SLUG_HINTS = ["demo-template", "demo_template", "template-demo"];

function sanitizeProjectName(name: string) {
  const compact = name.replace(/\s+/g, " ").trim();
  return compact || "Projeto demonstracao";
}

function buildDemoProjectName(templateName: string) {
  return `${sanitizeProjectName(templateName)} Demo ${new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

async function ensureSingleDemoMembership(usuarioId: string, projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { error: deleteError } = await supabase
    .from("usuarios_projetos")
    .delete()
    .eq("usuario_id", usuarioId)
    .neq("projeto_id", projetoId);

  if (deleteError) {
    console.error("[demo] failed to prune demo memberships", deleteError);
    return false;
  }

  const { data: existing, error: existingError } = await supabase
    .from("usuarios_projetos")
    .select("usuario_id")
    .eq("usuario_id", usuarioId)
    .eq("projeto_id", projetoId)
    .maybeSingle();

  if (existingError) {
    console.error("[demo] failed to read demo membership", existingError);
    return false;
  }

  if (existing) {
    return true;
  }

  const { error } = await supabase.from("usuarios_projetos").insert({
    usuario_id: usuarioId,
    projeto_id: projetoId,
    papel: "viewer",
    created_at: new Date().toISOString(),
  } as never);

  if (error) {
    console.error("[demo] failed to create demo membership", error);
    return false;
  }

  return true;
}

export async function resolveDemoTemplateProject() {
  const envTemplateId = process.env.DEMO_TEMPLATE_SOURCE_ID?.trim() || null;
  if (envTemplateId) {
    return await getProjetoById(envTemplateId);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos")
    .select("id, nome, slug, tipo, descricao, status, modo_cobranca, modelo_id, is_demo, owner_user_id, configuracoes")
    .eq("is_demo", true)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    console.error("[demo] failed to list demo templates", error);
    return null;
  }

  const rows = await Promise.all(
    ((data ?? []) as Array<{ id: string }>).map(async (item) => await getProjetoById(item.id)),
  );
  const projetos = rows.filter((item): item is ProjetoRecord => Boolean(item));
  return (
    projetos.find((item) => item.demoTemplateSource) ??
    projetos.find((item) => item.slug && DEMO_TEMPLATE_SLUG_HINTS.includes(item.slug)) ??
    projetos.find((item) => item.ownerUserId === null) ??
    projetos[0] ??
    null
  );
}

async function cloneTemplateProjectStructure(template: ProjetoRecord, projetoId: string) {
  const [apis, agentes, widgets, conectores] = await Promise.all([
    listApis(template.id),
    listAgentes(template.id),
    listChatWidgets(template.id),
    listConectores(template.id),
  ]);

  const apiIdMap = new Map<string, string>();
  for (const api of apis) {
    const created = await createApi({
      projetoId,
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

    if (created) {
      apiIdMap.set(api.id, created.id);
    }
  }

  const agenteIdMap = new Map<string, string>();
  for (const agente of agentes) {
    const created = await createAgente({
      projetoId,
      slug: agente.slug,
      nome: agente.nome,
      descricao: agente.descricao,
      promptBase: agente.promptBase,
      configuracoes: agente.configuracoes,
      ativo: agente.ativo,
      apiIds: agente.apiIds.map((apiId) => apiIdMap.get(apiId)).filter((apiId): apiId is string => Boolean(apiId)),
    });

    if (created) {
      agenteIdMap.set(agente.id, created.id);
    }
  }

  for (const widget of widgets) {
    await createChatWidget({
      nome: widget.nome,
      slug: `${widget.slug}-${randomUUID().slice(0, 6)}`,
      projetoId,
      agenteId: widget.agenteId ? (agenteIdMap.get(widget.agenteId) ?? null) : null,
      dominio: widget.dominio,
      whatsappCelular: "",
      tema: widget.tema,
      corPrimaria: widget.corPrimaria,
      fundoTransparente: widget.fundoTransparente,
      ativo: widget.ativo,
    });
  }

  for (const conector of conectores) {
    await createConector({
      projetoId,
      agenteId: conector.agenteId ? (agenteIdMap.get(conector.agenteId) ?? null) : null,
      nome: conector.nome,
      tipo: conector.tipo,
      endpointBase: conector.endpointBase,
      configuracoes: sanitizeConnectorConfigForDemo(conector.configuracoes),
      ativo: conector.ativo,
    });
  }
}

export async function markDemoProjectStatus(
  projetoId: string,
  status: "ativo" | "expirado" | "convertido" | "descartado",
  options?: {
    expiresAt?: string | null;
  },
) {
  const projeto = await getProjetoById(projetoId);
  if (!projeto) {
    return null;
  }

  return await updateProjeto({
    id: projetoId,
    nome: projeto.nome,
    slug: projeto.slug,
    tipo: projeto.tipo,
    descricao: projeto.descricao,
    status: projeto.status,
    modoCobranca: projeto.modoCobranca,
    modeloId: projeto.modeloId,
    ownerUserId: projeto.ownerUserId,
    isDemo: true,
    modo: "demo",
    demoExpiresAt: options?.expiresAt ?? projeto.demoExpiresAt,
    demoStatus: status,
    demoOwnerUserId: projeto.demoOwnerUserId ?? projeto.ownerUserId,
    demoTemplateSourceId: projeto.demoTemplateSourceId,
    demoTemplateSource: projeto.demoTemplateSource,
    siteChatAtivo: projeto.siteChatAtivo,
  });
}

export async function cleanupDemoProjectSensitiveData(
  projetoId: string,
  status: "expirado" | "convertido" | "descartado",
) {
  const projeto = await getProjetoById(projetoId);
  if (!projeto?.isDemo) {
    return { ok: true };
  }

  const supabase = getSupabaseAdminClient();
  const channels = await listWhatsAppChannels(projetoId);

  for (const channel of channels) {
    await updateWhatsAppChannelSession(channel.id, {
      connectionStatus: "offline",
      qrCodeUrl: null,
      qrCodeDataUrl: null,
      qrCodeText: null,
      disconnectedAt: new Date().toISOString(),
      notes: `Canal demo encerrado automaticamente (${status}).`,
    }, "inativo").catch(() => null);
  }

  await purgeWhatsAppServiceSessions({ projetoId }).catch(() => ({
    ok: false,
  }));

  const chatIds = (await listChats(projetoId)).map((chat) => chat.id);
  for (const chatId of chatIds) {
    await deleteChatConversation(chatId).catch(() => ({ ok: false }));
  }

  await supabase.from("whatsapp_handoff_contatos").delete().eq("projeto_id", projetoId);
  await supabase.from("canais_whatsapp").delete().eq("projeto_id", projetoId);
  await supabase.from("segredos").delete().eq("projeto_id", projetoId);

  const connectors = await listConectores(projetoId);
  for (const connector of connectors) {
    await supabase
      .from("conectores")
      .update({
        configuracoes: sanitizeConnectorConfigForDemo(connector.configuracoes),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", connector.id);
  }

  return { ok: true };
}

export async function discardOtherDemoProjects(usuarioId: string, keepProjectId?: string | null) {
  const projetos = await listProjetosByUsuario(usuarioId);
  const previousDemos = projetos.filter((item) => item.isDemo && item.id !== keepProjectId && item.demoStatus === "ativo");

  for (const projeto of previousDemos) {
    await cleanupDemoProjectSensitiveData(projeto.id, "descartado");
    await markDemoProjectStatus(projeto.id, "descartado", {
      expiresAt: new Date().toISOString(),
    });
  }
}

export async function createOrReuseDemoProjectForUser(usuarioId: string) {
  const projetos = await listProjetosByUsuario(usuarioId);
  const activeDemo = projetos.find((item) => item.isDemo && item.demoStatus === "ativo" && !item.demoExpired);
  if (activeDemo) {
    await ensureSingleDemoMembership(usuarioId, activeDemo.id);
    return activeDemo;
  }

  await discardOtherDemoProjects(usuarioId);

  const template = await resolveDemoTemplateProject();
  if (!template) {
    return null;
  }

  const expiresAt = buildDemoExpirationDate();
  const projeto = await createProjetoForUsuario({
    usuarioId,
    nome: buildDemoProjectName(template.nome),
    slug: null,
    tipo: template.tipo,
    descricao: template.descricao,
    status: "ativo",
    modoCobranca: template.modoCobranca,
    siteChatAtivo: template.siteChatAtivo,
    modeloId: template.modeloId ?? null,
    isDemo: true,
    modo: "demo",
    demoExpiresAt: expiresAt,
    demoStatus: "ativo",
    demoTemplateSourceId: template.id,
  });

  if (!projeto) {
    return null;
  }

  await cloneTemplateProjectStructure(template, projeto.id);
  await ensureSingleDemoMembership(usuarioId, projeto.id);
  return await getProjetoById(projeto.id);
}

export async function convertDemoProjectToRealProject(input: {
  demoProjetoId: string;
  usuarioId: string;
}) {
  const demoProjeto = await getProjetoById(input.demoProjetoId);
  if (!demoProjeto?.isDemo || demoProjeto.demoExpired || demoProjeto.demoStatus !== "ativo") {
    return null;
  }

  const [apis, agentes, widgets, conectores] = await Promise.all([
    listApis(demoProjeto.id),
    listAgentes(demoProjeto.id),
    listChatWidgets(demoProjeto.id),
    listConectores(demoProjeto.id),
  ]);

  const projetoReal = await createProjetoForUsuario({
    usuarioId: input.usuarioId,
    nome: demoProjeto.nome.replace(/\s+Demo\s+\d{2}:\d{2}$/i, "").trim() || demoProjeto.nome,
    slug: demoProjeto.slug,
    tipo: demoProjeto.tipo,
    descricao: demoProjeto.descricao,
    status: "ativo",
    modoCobranca: demoProjeto.modoCobranca,
    siteChatAtivo: demoProjeto.siteChatAtivo,
    modeloId: demoProjeto.modeloId ?? null,
    isDemo: false,
    modo: "real",
  });

  if (!projetoReal) {
    return null;
  }

  const apiIdMap = new Map<string, string>();
  for (const api of apis) {
    const created = await createApi({
      projetoId: projetoReal.id,
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

    if (created) {
      apiIdMap.set(api.id, created.id);
    }
  }

  const agenteIdMap = new Map<string, string>();
  for (const agente of agentes) {
    const created = await createAgente({
      projetoId: projetoReal.id,
      slug: agente.slug,
      nome: agente.nome,
      descricao: agente.descricao,
      promptBase: agente.promptBase,
      configuracoes: agente.configuracoes,
      ativo: agente.ativo,
      apiIds: agente.apiIds.map((apiId) => apiIdMap.get(apiId)).filter((apiId): apiId is string => Boolean(apiId)),
    });

    if (created) {
      agenteIdMap.set(agente.id, created.id);
    }
  }

  for (const widget of widgets) {
    await createChatWidget({
      nome: widget.nome,
      slug: `${widget.slug}-${randomUUID().slice(0, 6)}`,
      projetoId: projetoReal.id,
      agenteId: widget.agenteId ? (agenteIdMap.get(widget.agenteId) ?? null) : null,
      dominio: widget.dominio,
      whatsappCelular: "",
      tema: widget.tema,
      corPrimaria: widget.corPrimaria,
      fundoTransparente: widget.fundoTransparente,
      ativo: widget.ativo,
    });
  }

  for (const conector of conectores) {
    await createConector({
      projetoId: projetoReal.id,
      agenteId: conector.agenteId ? (agenteIdMap.get(conector.agenteId) ?? null) : null,
      nome: conector.nome,
      tipo: conector.tipo,
      endpointBase: conector.endpointBase,
      configuracoes: sanitizeConnectorConfigForDemo(conector.configuracoes),
      ativo: conector.ativo,
    });
  }

  await cleanupDemoProjectSensitiveData(demoProjeto.id, "convertido");
  await markDemoProjectStatus(demoProjeto.id, "convertido");
  return projetoReal;
}

export async function cleanupExpiredDemoProjects() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos")
    .select("id, nome, slug, tipo, descricao, status, modo_cobranca, modelo_id, is_demo, owner_user_id, configuracoes")
    .eq("is_demo", true);

  if (error || !data) {
    console.error("[demo] failed to list expired demos", error);
    return { ok: false, processed: [] as string[] };
  }

  const projetos = (
    await Promise.all(
      ((data ?? []) as Array<{ id: string }>).map(async (item) => await getProjetoById(item.id)),
    )
  ).filter((item): item is ProjetoRecord => Boolean(item));
  const processed: string[] = [];

  for (const projeto of projetos) {
    if (!projeto.isDemo || !projeto.demoExpired || projeto.demoStatus === "convertido" || projeto.demoStatus === "descartado") {
      continue;
    }

    await cleanupDemoProjectSensitiveData(projeto.id, "expirado");
    await markDemoProjectStatus(projeto.id, "expirado");
    processed.push(projeto.id);
  }

  return { ok: true, processed };
}
