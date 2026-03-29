import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { getAgenteById } from "@/lib/agentes";
import { listApis, testApi } from "@/lib/apis";
import { listChatWidgets } from "@/lib/chat-widgets";
import { listChats } from "@/lib/chats";
import { listConectores } from "@/lib/conectores";
import { appendRuntimeErrorLog } from "@/lib/runtime-error-log";
import { getSessionUser } from "@/lib/session";
import { listWhatsAppChannels } from "@/lib/whatsapp-channels";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function buildConnectionSummary(agentId: string, projectId: string, payload: {
  apis: Awaited<ReturnType<typeof listApis>>;
  widgets: Awaited<ReturnType<typeof listChatWidgets>>;
  channels: Awaited<ReturnType<typeof listWhatsAppChannels>>;
  connectors: Awaited<ReturnType<typeof listConectores>>;
  chats: Awaited<ReturnType<typeof listChats>>;
}) {
  return {
    apis: payload.apis.filter((api) => api.projetoId === projectId),
    linkedApiIds: [] as string[],
    widgets: payload.widgets.filter((widget) => widget.projetoId === projectId && widget.agenteId === agentId),
    fallbackWidgets: payload.widgets.filter((widget) => widget.projetoId === projectId && widget.agenteId === null),
    whatsappChannels: payload.channels.filter((channel) => channel.agenteId === agentId),
    connectors: payload.connectors.filter((connector) => connector.agenteId === agentId),
    chats: payload.chats.filter((chat) => chat.agenteId === agentId),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const agente = await getAgenteById(id);

  if (!agente || !agente.projetoId || !canManageProject(user, agente.projetoId)) {
    return NextResponse.json({ error: "Agente nao encontrado." }, { status: 404 });
  }

  const [apis, widgets, channels, connectors, chats] = await Promise.all([
    listApis(agente.projetoId),
    listChatWidgets(agente.projetoId),
    listWhatsAppChannels(agente.projetoId),
    listConectores(agente.projetoId),
    listChats(agente.projetoId),
  ]);

  const summary = buildConnectionSummary(agente.id, agente.projetoId, { apis, widgets, channels, connectors, chats });
  const linkedApis = summary.apis.filter((api) => agente.apiIds.includes(api.id));
  const activeChannels = summary.whatsappChannels.filter((channel) => channel.status === "ativo");
  const onlineChannels = activeChannels.filter((channel) => channel.sessionData?.connectionStatus === "online");
  const activeWidgets = summary.widgets.filter((widget) => widget.ativo);
  const activeConnectors = summary.connectors.filter((connector) => connector.ativo);

  return NextResponse.json(
    {
      agent: {
        id: agente.id,
        nome: agente.nome,
        ativo: agente.ativo,
      },
      connections: {
        apis: linkedApis.map((api) => ({
          id: api.id,
          nome: api.nome,
          ativo: api.ativo,
          parametrosObrigatorios: api.parametros.filter((parametro) => parametro.obrigatorio).map((parametro) => parametro.nome),
        })),
        widgets: summary.widgets.map((widget) => ({
          id: widget.id,
          nome: widget.nome,
          slug: widget.slug,
          ativo: widget.ativo,
          dominio: widget.dominio,
        })),
        fallbackWidgets: summary.fallbackWidgets.map((widget) => ({
          id: widget.id,
          nome: widget.nome,
          slug: widget.slug,
          ativo: widget.ativo,
        })),
        whatsappChannels: summary.whatsappChannels.map((channel) => ({
          id: channel.id,
          numero: channel.numero,
          status: channel.status,
          connectionStatus: channel.sessionData?.connectionStatus ?? "offline",
          worker: channel.sessionData?.worker ?? null,
          lastSyncAt: channel.sessionData?.lastSyncAt ?? null,
        })),
        connectors: summary.connectors.map((connector) => ({
          id: connector.id,
          nome: connector.nome,
          tipo: connector.tipo,
          ativo: connector.ativo,
          endpointBase: connector.endpointBase,
          sellerId:
            typeof connector.configuracoes?.seller_id === "string" ? connector.configuracoes.seller_id : null,
          nickname:
            typeof connector.configuracoes?.nickname === "string" ? connector.configuracoes.nickname : null,
        })),
        chatsRecentes: summary.chats
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5)
          .map((chat) => ({
            id: chat.id,
            titulo: chat.titulo,
            canal: chat.canal,
            updatedAt: chat.updatedAt,
          })),
      },
      summary: {
        linkedApis: linkedApis.length,
        activeApis: linkedApis.filter((api) => api.ativo).length,
        widgets: summary.widgets.length,
        activeWidgets: activeWidgets.length,
        whatsappChannels: summary.whatsappChannels.length,
        onlineWhatsAppChannels: onlineChannels.length,
        connectors: summary.connectors.length,
        activeConnectors: activeConnectors.length,
        chats: summary.chats.length,
        fallbackWidgets: summary.fallbackWidgets.length,
      },
      warnings: [
        !agente.ativo ? "Agente inativo: chat e WhatsApp devem falhar fechado." : null,
        summary.whatsappChannels.length === 0 ? "Nenhum canal WhatsApp vinculado diretamente a este agente." : null,
        activeChannels.length > 0 && onlineChannels.length === 0 ? "Canal WhatsApp ativo sem sessao online." : null,
        summary.widgets.length === 0 ? "Nenhum widget vinculado diretamente a este agente." : null,
        summary.connectors.some((connector) => connector.ativo) && linkedApis.filter((api) => api.ativo).length === 0
          ? "Ha conectores ativos sem APIs ativas vinculadas."
          : null,
      ].filter(Boolean),
    },
    { status: 200 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const agente = await getAgenteById(id);

  if (!agente || !agente.projetoId || !canManageProject(user, agente.projetoId)) {
    return NextResponse.json({ error: "Agente nao encontrado." }, { status: 404 });
  }

  const [apis, widgets, channels, connectors] = await Promise.all([
    listApis(agente.projetoId),
    listChatWidgets(agente.projetoId),
    listWhatsAppChannels(agente.projetoId),
    listConectores(agente.projetoId),
  ]);

  const linkedApis = apis.filter((api) => agente.apiIds.includes(api.id) && api.ativo);
  const apiResults = await Promise.all(
    linkedApis.map(async (api) => {
      const required = api.parametros.filter((parametro) => parametro.obrigatorio).map((parametro) => parametro.nome);
      if (required.length) {
        return {
          id: api.id,
          nome: api.nome,
          ok: false,
          status: "pendente_contexto",
          detail: `Precisa de contexto obrigatorio: ${required.join(", ")}.`,
        };
      }

      const result = await testApi(api.id, {
        projeto: { id: agente.projetoId },
        agente: { id: agente.id },
      });

      return {
        id: api.id,
        nome: api.nome,
        ok: !result.error,
        status: result.error ? "erro" : "ok",
        detail: result.error ?? `${result.campos.length} campos detectados.`,
      };
    }),
  );

  const directWidgets = widgets.filter((widget) => widget.projetoId === agente.projetoId && widget.agenteId === agente.id);
  const agentChannels = channels.filter((channel) => channel.agenteId === agente.id);
  const agentConnectors = connectors.filter((connector) => connector.agenteId === agente.id);
  const origin = new URL(request.url).origin;

  const chatConfigResponse = await fetch(
    `${origin}/api/chat/config?projeto=${encodeURIComponent(agente.projetoId)}&agente=${encodeURIComponent(agente.id)}`,
    { cache: "no-store" },
  );
  const chatConfigPayload = (await chatConfigResponse.json().catch(() => ({}))) as { error?: string };
  const diagnosticOk =
    agente.ativo &&
    chatConfigResponse.ok &&
    apiResults.every((item) => item.status === "ok" || item.status === "pendente_contexto") &&
    agentChannels.every((channel) => channel.status === "ativo");

  if (!diagnosticOk) {
    await appendRuntimeErrorLog({
      source: "agent_diagnostic",
      message: "Validacao do agente retornou alertas.",
      projetoId: agente.projetoId,
      agenteId: agente.id,
      payload: {
        chatConfigOk: chatConfigResponse.ok,
        chatConfigError: chatConfigPayload.error ?? null,
        apiResults,
        whatsappChannels: agentChannels.map((channel) => ({
          id: channel.id,
          status: channel.status,
          connectionStatus: channel.sessionData?.connectionStatus ?? "offline",
        })),
        connectors: agentConnectors.map((connector) => ({
          id: connector.id,
          ativo: connector.ativo,
          tipo: connector.tipo,
        })),
      },
    });
  }

  return NextResponse.json(
    {
      ok: diagnosticOk,
      checks: {
        agent: {
          ok: agente.ativo,
          detail: agente.ativo ? "Agente ativo." : "Agente inativo.",
        },
        chat: {
          ok: chatConfigResponse.ok,
          detail: chatConfigResponse.ok
            ? `${directWidgets.filter((widget) => widget.ativo).length} widget(s) ativos vinculados diretamente.`
            : chatConfigPayload.error ?? "Falha ao resolver configuracao do chat.",
        },
        whatsapp: {
          ok: agentChannels.some((channel) => channel.status === "ativo" && channel.sessionData?.connectionStatus === "online"),
          detail: agentChannels.length
            ? `${agentChannels.length} canal(is) vinculados; ${agentChannels.filter((channel) => channel.sessionData?.connectionStatus === "online").length} online.`
            : "Nenhum canal WhatsApp vinculado diretamente.",
        },
        connectors: {
          ok: agentConnectors.every(
            (connector) =>
              !connector.ativo ||
              (typeof connector.configuracoes?.seller_id === "string" && connector.configuracoes.seller_id.trim()) ||
              (typeof connector.configuracoes?.nickname === "string" && connector.configuracoes.nickname.trim()),
          ),
          detail: agentConnectors.length
            ? `${agentConnectors.length} conector(es) vinculados.`
            : "Nenhum conector vinculado diretamente.",
        },
        apis: apiResults,
      },
    },
    { status: 200 },
  );
}
