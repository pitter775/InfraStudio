import { getAgenteById, getAgenteByIdentifier, type AgenteRecord } from "@/lib/agentes";
import { appendChatRequestLog, appendSystemLog } from "@/lib/chat-logs";
import { getChatHandoffByChatId, requestHumanHandoff, shouldPauseAssistantForHandoff } from "@/lib/chat-handoffs";
import { enrichLeadContext, generateSalesReply, shouldRefreshSummary, summarizeConversation } from "@/lib/chat-orchestrator";
import { DEFAULT_HOME_WIDGET_SLUG, getChatWidgetByProjetoAgente, getChatWidgetBySlug } from "@/lib/chat-widgets";
import { appendMessage, createChat, findActiveChatByChannel, getChatById, getChatContext, listChatMessages, type ChatChannelKind, updateChatContext, updateChatStats } from "@/lib/chats";
import { registrarUso, verifyProjetoBillingAccess } from "@/lib/billing";
import { estimateOpenAICostUsd } from "@/lib/openai-pricing";
import { getProjetoById, getProjetoByIdentifier } from "@/lib/projetos";
import { appendRuntimeErrorLog } from "@/lib/runtime-error-log";
import { notifyWhatsAppHandoffContacts } from "@/lib/whatsapp-handoff-alerts";
import { getPreferredWhatsAppChannel, getWhatsAppChannelById, updateWhatsAppChannelSession } from "@/lib/whatsapp-channels";

export type ChatRequestBody = {
  chatId?: string;
  message?: string;
  mensagem?: string;
  projeto?: string;
  agente?: string;
  context?: Record<string, unknown> | null;
  widgetSlug?: string;
  canal?: ChatChannelKind;
  identificadorExterno?: string | null;
  identificador?: string | null;
  source?: string | null;
  whatsappChannelId?: string | null;
};

type ResolvedChatChannel = {
  projeto: Awaited<ReturnType<typeof getProjetoById>> | Awaited<ReturnType<typeof getProjetoByIdentifier>>;
  agente: AgenteRecord | null;
  widget: Awaited<ReturnType<typeof getChatWidgetBySlug>> | Awaited<ReturnType<typeof getChatWidgetByProjetoAgente>>;
  channel: Record<string, unknown>;
  lockedToAgent: boolean;
};

type ChatContextValidationResult = {
  chat: NonNullable<Awaited<ReturnType<typeof getChatById>>>;
  authoritativeAgent: AgenteRecord | null;
};

function getLockedAgentIdFromChatContext(chat: NonNullable<Awaited<ReturnType<typeof getChatById>>>) {
  const context = getChatContext(chat) as Record<string, unknown>;
  const agente = isPlainObject(context.agente) ? context.agente : null;
  const locked = agente?.locked === true;
  const agenteId = typeof agente?.id === "string" && agente.id.trim() ? agente.id.trim() : null;
  return locked && agenteId ? agenteId : null;
}

function sanitizePhone(phone: string | null | undefined) {
  return String(phone || "").replace(/\D/g, "");
}

function buildWhatsAppLink(phone: string | null | undefined, message: string) {
  const sanitizedPhone = sanitizePhone(phone);
  if (!sanitizedPhone) {
    return null;
  }

  return "https://wa.me/" + sanitizedPhone + "?text=" + encodeURIComponent(message);
}

function getWhatsAppContactNameFromContext(context: Record<string, unknown> | null | undefined) {
  if (!isPlainObject(context?.whatsapp)) {
    return null;
  }

  const value = context.whatsapp.contactName;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getWhatsAppContactPhoneFromContext(context: Record<string, unknown> | null | undefined) {
  if (!isPlainObject(context?.lead) && !isPlainObject(context?.whatsapp)) {
    return null;
  }

  const leadPhone = isPlainObject(context?.lead) ? context.lead.telefone : null;
  if (typeof leadPhone === "string" && leadPhone.trim()) {
    return leadPhone.trim();
  }

  if (!isPlainObject(context?.whatsapp)) {
    return null;
  }

  const remotePhone = context.whatsapp.remotePhone;
  if (typeof remotePhone === "string" && remotePhone.trim()) {
    return remotePhone.trim();
  }

  const senderPhone = context.whatsapp.remetente;
  return typeof senderPhone === "string" && senderPhone.trim() ? senderPhone.trim() : null;
}

function getWhatsAppContactAvatarFromContext(context: Record<string, unknown> | null | undefined) {
  if (!isPlainObject(context?.whatsapp)) {
    return null;
  }

  const value = context.whatsapp.profilePicUrl;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveChatContactSnapshot(
  context: Record<string, unknown> | null | undefined,
  fallbackExternalIdentifier?: string | null,
) {
  return {
    contatoNome: getWhatsAppContactNameFromContext(context),
    contatoTelefone: getWhatsAppContactPhoneFromContext(context) ?? sanitizePhone(fallbackExternalIdentifier),
    contatoAvatarUrl: getWhatsAppContactAvatarFromContext(context),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeContext(base: Record<string, unknown>, extra?: Record<string, unknown> | null) {
  if (!extra) {
    return base;
  }

  return {
    ...base,
    ...extra,
  };
}

function buildSilentChatResult(chatId?: string | null) {
  return {
    chatId: chatId ?? "",
    reply: "",
    assets: [],
    whatsapp: null,
  };
}

function getChatWhatsAppChannelId(
  chat: NonNullable<Awaited<ReturnType<typeof getChatById>>> | null,
  body: ChatRequestBody,
) {
  if (typeof body.whatsappChannelId === "string" && body.whatsappChannelId.trim()) {
    return body.whatsappChannelId.trim();
  }

  const context = getChatContext(chat) as Record<string, unknown>;
  const whatsapp = isPlainObject(context.whatsapp) ? context.whatsapp : null;
  return typeof whatsapp?.channelId === "string" && whatsapp.channelId.trim() ? whatsapp.channelId.trim() : null;
}

function isHumanHandoffIntent(message: string) {
  const normalized = message.toLowerCase();
  return [
    /\bfalar com (um )?(humano|atendente|vendedor|pessoa)\b/,
    /\bquero falar com (um )?(humano|atendente|vendedor|pessoa)\b/,
    /\bme passa (um )?(humano|atendente|vendedor)\b/,
    /\bchama (um )?(humano|atendente|vendedor)\b/,
    /\bprefiro falar com (uma )?pessoa\b/,
    /\btem algu[eé]m ai\b/,
  ].some((pattern) => pattern.test(normalized));
}

function buildHumanHandoffReply(channelKind: ChatChannelKind) {
  return channelKind === "whatsapp"
    ? "Perfeito. Ja acionei um atendente humano para continuar por aqui. Assim que alguem assumir, seguimos neste mesmo WhatsApp."
    : "Perfeito. Ja acionei um atendente humano para continuar por aqui assim que possivel.";
}

function shouldEscalateToHumanByAi(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  if (metadata.provider === "agent_scoped_recovery") {
    return true;
  }

  return metadata.handoffSuggested === true;
}

function parseAssetPrice(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const numeric = value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRecentMercadoLivreProductsFromAssets(assets: unknown) {
  if (!Array.isArray(assets)) {
    return [];
  }

  return assets
    .filter(
      (asset) =>
        isPlainObject(asset) &&
        typeof asset.id === "string" &&
        (asset.id.startsWith("mercado-livre-") || /^MLB\d+$/i.test(asset.id)),
    )
    .map((asset) => ({
      id: typeof asset.id === "string" ? asset.id : null,
      nome: typeof asset.nome === "string" ? asset.nome : null,
      descricao: typeof asset.descricao === "string" ? asset.descricao : null,
      preco: parseAssetPrice(asset.descricao),
      link: typeof asset.targetUrl === "string" ? asset.targetUrl : null,
      imagem: typeof asset.publicUrl === "string" ? asset.publicUrl : null,
    }))
    .filter((asset) => asset.nome && asset.imagem);
}

function isCatalogSearchMessage(message: string) {
  const latestNormalizedMessage = message.toLowerCase();
  const catalogSignals = ["tem ", "produto", "produtos", "catalogo", "catálogo", "loja", "vende", "procuro", "estou procurando"];
  return catalogSignals.some((signal) => latestNormalizedMessage.includes(signal)) || /^\s*e\s+\S+/i.test(message);
}

function buildBillingBlockedResult(chatId: string, message: string) {
  return {
    chatId,
    reply: message,
    assets: [],
    whatsapp: null,
  };
}

async function appendChatFailureLog(input: {
  projetoId?: string | null;
  agenteId?: string | null;
  chatId?: string | null;
  origem: string;
  descricao: string;
  payload?: Record<string, unknown> | null;
}) {
  await appendSystemLog({
    projetoId: input.projetoId ?? null,
    tipo: "chat_failure",
    origem: input.origem,
    descricao: input.descricao,
    payload: {
      chatId: input.chatId ?? null,
      agenteId: input.agenteId ?? null,
      ...(input.payload ?? {}),
    },
  });
}

function normalizeChannelKind(body: ChatRequestBody) {
  if (typeof body.canal === "string" && body.canal.trim()) {
    return body.canal.trim();
  }

  return isPlainObject(body.context) && isPlainObject(body.context.channel) && typeof body.context.channel.kind === "string"
    ? body.context.channel.kind.trim()
    : "web";
}

function getAdminTestAgentId(body: ChatRequestBody) {
  return isPlainObject(body.context) &&
    isPlainObject(body.context.admin) &&
    typeof body.context.admin.agenteId === "string" &&
    body.context.admin.agenteId.trim()
    ? body.context.admin.agenteId.trim()
    : null;
}

function getAdminTestProjectId(body: ChatRequestBody) {
  return isPlainObject(body.context) &&
    isPlainObject(body.context.admin) &&
    typeof body.context.admin.projetoId === "string" &&
    body.context.admin.projetoId.trim()
    ? body.context.admin.projetoId.trim()
    : null;
}

function buildContinuationMessage(input: {
  projetoNome?: string | null;
  agenteNome?: string | null;
  resumo?: string | null;
  ultimaMensagem: string;
}) {
  const resumoLimpo = String(input.resumo || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);

  return [
    `Ola! Vim do chat do site${input.projetoNome ? ` do projeto ${input.projetoNome}` : ""}.`,
    input.agenteNome ? `Agente de referencia: ${input.agenteNome}.` : "",
    resumoLimpo ? `Contexto resumido: ${resumoLimpo}` : "",
    `Ultima mensagem: ${input.ultimaMensagem}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

async function validateChatAgainstResolvedChannel(input: {
  chat: NonNullable<Awaited<ReturnType<typeof getChatById>>>;
  resolved: ResolvedChatChannel;
  channelKind: ChatChannelKind;
  effectiveBody: ChatRequestBody;
  normalizedExternalIdentifier: string | null;
  lockedWhatsAppAgent: AgenteRecord | null;
}): Promise<ChatContextValidationResult | null> {
  const { chat, resolved, channelKind, effectiveBody, normalizedExternalIdentifier, lockedWhatsAppAgent } = input;

  if (!resolved.projeto || chat.projetoId !== resolved.projeto.id || chat.canal !== channelKind) {
    await appendRuntimeErrorLog({
      source: "chat_service.chat_id_guardrail",
      message: "ChatId recebido fora do contexto autorizado.",
      projetoId: resolved.projeto?.id ?? chat.projetoId,
      agenteId: chat.agenteId,
      payload: {
        chatId: chat.id,
        chatProjetoId: chat.projetoId,
        resolvedProjetoId: resolved.projeto?.id ?? null,
        chatCanal: chat.canal,
        requestedCanal: channelKind,
      },
    });
    return null;
  }

  const lockedAgentIdFromContext = getLockedAgentIdFromChatContext(chat);
  const expectedAgentId = lockedAgentIdFromContext ?? chat.agenteId ?? resolved.agente?.id ?? null;

  if (expectedAgentId && chat.agenteId !== expectedAgentId) {
    await appendRuntimeErrorLog({
      source: "chat_service.chat_id_guardrail",
      message: "ChatId recebido com agente divergente do canal travado.",
      projetoId: resolved.projeto.id,
      agenteId: chat.agenteId,
      payload: {
        chatId: chat.id,
        expectedAgentId,
        effectiveAgentId: effectiveBody.agente ?? null,
      },
    });
    return null;
  }

  if (normalizedExternalIdentifier && chat.identificadorExterno && chat.identificadorExterno !== normalizedExternalIdentifier) {
    await appendRuntimeErrorLog({
      source: "chat_service.chat_id_guardrail",
      message: "ChatId recebido com identificador externo divergente.",
      projetoId: resolved.projeto.id,
      agenteId: chat.agenteId,
      payload: {
        chatId: chat.id,
        chatExternalId: chat.identificadorExterno,
        requestedExternalId: normalizedExternalIdentifier,
      },
    });
    return null;
  }

  const authoritativeAgent =
    (expectedAgentId ? await getAgenteById(expectedAgentId) : null) ??
    lockedWhatsAppAgent ??
    (chat.agenteId ? await getAgenteById(chat.agenteId) : null);

  if (resolved.lockedToAgent || lockedAgentIdFromContext) {
    if (!authoritativeAgent || !authoritativeAgent.ativo || authoritativeAgent.projetoId !== chat.projetoId) {
      await appendRuntimeErrorLog({
        source: "chat_service.chat_guardrail",
        message: "Chat bloqueado por agente invalido, inativo ou fora do projeto.",
        projetoId: chat.projetoId,
        agenteId: expectedAgentId ?? chat.agenteId,
        payload: {
          chatId: chat.id,
          channelKind,
          agentProjetoId: authoritativeAgent?.projetoId ?? null,
          agentAtivo: authoritativeAgent?.ativo ?? null,
        },
      });
      return null;
    }
  }

  return {
    chat,
    authoritativeAgent,
  };
}

async function resolveChatChannel(body: ChatRequestBody): Promise<ResolvedChatChannel> {
  const channelKind = normalizeChannelKind(body);
  const adminTestAgentId = channelKind === "admin_agent_test" ? getAdminTestAgentId(body) : null;
  const adminTestProjectId = channelKind === "admin_agent_test" ? getAdminTestProjectId(body) : null;
  const projetoIdentifier = adminTestProjectId ?? (body.projeto?.trim() || null);
  const agenteIdentifier = adminTestAgentId ?? (body.agente?.trim() || null);

  if (projetoIdentifier) {
    const projeto = await getProjetoByIdentifier(projetoIdentifier);
    let agente = agenteIdentifier ? await getAgenteByIdentifier(agenteIdentifier, projeto?.id ?? null) : null;

    if (agente && (!agente.ativo || agente.projetoId !== projeto?.id)) {
      agente = null;
    }

    const widget = projeto ? await getChatWidgetByProjetoAgente({ projetoId: projeto.id, agenteId: agente?.id ?? null }) : null;

    return {
      projeto,
      agente,
      widget,
      lockedToAgent: true,
      channel: {
        kind: channelKind,
        projeto: projetoIdentifier,
        agente: agenteIdentifier,
        identificador_externo: body.identificadorExterno?.trim() || null,
      },
    };
  }

  const widgetSlug = body.widgetSlug?.trim() || DEFAULT_HOME_WIDGET_SLUG;
  const widget = await getChatWidgetBySlug(widgetSlug);

  if (!widget?.projetoId) {
    return {
      projeto: null,
      agente: null,
      widget: null,
      lockedToAgent: true,
      channel: {
        kind: channelKind,
        widgetSlug,
        identificador_externo: body.identificadorExterno?.trim() || null,
      },
    };
  }

  const projeto = await getProjetoById(widget.projetoId);
  const widgetAgent = widget?.agenteId && projeto ? await getAgenteById(widget.agenteId) : null;
  const agente = widgetAgent && widgetAgent.ativo && widgetAgent.projetoId === projeto?.id ? widgetAgent : null;

  return {
    projeto,
    agente,
    widget,
    lockedToAgent: true,
    channel: {
      kind: channelKind,
      widgetSlug,
      identificador_externo: body.identificadorExterno?.trim() || null,
    },
  };
}

export async function processIncomingChatMessage(body: ChatRequestBody) {
  const message = (body.message ?? body.mensagem)?.trim();
  if (!message) {
    throw new Error("Mensagem obrigatoria.");
  }

  const channelKind = normalizeChannelKind(body);
  let effectiveBody = body;
  let lockedWhatsAppAgent: AgenteRecord | null = null;

  if (channelKind === "admin_agent_test") {
    const adminTestAgentId = getAdminTestAgentId(body);
    const adminTestProjectId = getAdminTestProjectId(body);
    if (adminTestAgentId || adminTestProjectId) {
      effectiveBody = {
        ...body,
        agente: adminTestAgentId ?? body.agente,
        projeto: adminTestProjectId ?? body.projeto,
      };
    }
  }

  if (channelKind === "whatsapp" && body.whatsappChannelId) {
    const officialChannel = await getWhatsAppChannelById(body.whatsappChannelId);

    if (!officialChannel || !officialChannel.projetoId) {
      await appendRuntimeErrorLog({
        source: "chat_service.whatsapp_guardrail",
        message: "Canal WhatsApp nao encontrado ou sem projeto.",
        payload: { whatsappChannelId: body.whatsappChannelId },
      });
      await appendChatFailureLog({
        origem: "chat_service.whatsapp_guardrail",
        descricao: "Canal WhatsApp nao encontrado ou sem projeto.",
        payload: { whatsappChannelId: body.whatsappChannelId },
      });
      return buildSilentChatResult(body.chatId);
    }

    if (officialChannel.status !== "ativo") {
      await appendRuntimeErrorLog({
        source: "chat_service.whatsapp_guardrail",
        message: "Canal WhatsApp inativo bloqueado.",
        projetoId: officialChannel.projetoId,
        agenteId: officialChannel.agenteId,
        payload: { whatsappChannelId: officialChannel.id, status: officialChannel.status },
      });
      await appendChatFailureLog({
        projetoId: officialChannel.projetoId,
        agenteId: officialChannel.agenteId,
        origem: "chat_service.whatsapp_guardrail",
        descricao: "Canal WhatsApp inativo bloqueado.",
        payload: { whatsappChannelId: officialChannel.id, status: officialChannel.status },
      });
      return buildSilentChatResult(body.chatId);
    }

    if (!officialChannel.agenteId) {
      await appendRuntimeErrorLog({
        source: "chat_service.whatsapp_guardrail",
        message: "Canal WhatsApp sem agente vinculado.",
        projetoId: officialChannel.projetoId,
        payload: { whatsappChannelId: officialChannel.id },
      });
      await appendChatFailureLog({
        projetoId: officialChannel.projetoId,
        origem: "chat_service.whatsapp_guardrail",
        descricao: "Canal WhatsApp sem agente vinculado.",
        payload: { whatsappChannelId: officialChannel.id },
      });
      return buildSilentChatResult(body.chatId);
    }

    const officialAgent = await getAgenteById(officialChannel.agenteId);

    if (!officialAgent || !officialAgent.ativo || officialAgent.projetoId !== officialChannel.projetoId) {
      await appendRuntimeErrorLog({
        source: "chat_service.whatsapp_guardrail",
        message: "Agente do canal WhatsApp invalido, inativo ou fora do projeto.",
        projetoId: officialChannel.projetoId,
        agenteId: officialChannel.agenteId,
        payload: { whatsappChannelId: officialChannel.id, agenteProjetoId: officialAgent?.projetoId ?? null, agenteAtivo: officialAgent?.ativo ?? null },
      });
      await appendChatFailureLog({
        projetoId: officialChannel.projetoId,
        agenteId: officialChannel.agenteId,
        origem: "chat_service.whatsapp_guardrail",
        descricao: "Agente do canal WhatsApp invalido, inativo ou fora do projeto.",
        payload: {
          whatsappChannelId: officialChannel.id,
          agenteProjetoId: officialAgent?.projetoId ?? null,
          agenteAtivo: officialAgent?.ativo ?? null,
        },
      });
      return buildSilentChatResult(body.chatId);
    }

    lockedWhatsAppAgent = officialAgent;

    effectiveBody = {
      ...body,
      projeto: officialChannel.projetoId,
      agente: officialAgent.id,
      context: mergeContext(
        isPlainObject(body.context) ? body.context : {},
        {
          whatsapp: {
            ...(isPlainObject(body.context?.whatsapp) ? body.context.whatsapp : {}),
            channelId: officialChannel.id,
            numeroCanal: officialChannel.numero,
          },
        },
      ),
    };
  }

  const normalizedExternalIdentifier =
    channelKind === "whatsapp"
      ? sanitizePhone(effectiveBody.identificadorExterno ?? effectiveBody.identificador)
      : effectiveBody.identificadorExterno?.trim() || effectiveBody.identificador?.trim() || null;
  const resolved = await resolveChatChannel({
    ...effectiveBody,
    canal: channelKind,
    identificadorExterno: normalizedExternalIdentifier,
  });

  if (!resolved.projeto) {
    throw new Error("Projeto ou widget do chat nao encontrado. Revise o embed configurado para este site.");
  }

  if (resolved.lockedToAgent && !resolved.agente) {
    await appendRuntimeErrorLog({
      source: "chat_service.channel_resolution",
      message: "Canal travado a agente invalido ou inativo.",
      projetoId: resolved.projeto.id,
      payload: {
        projeto: effectiveBody.projeto ?? null,
        agente: effectiveBody.agente ?? null,
        widgetSlug: effectiveBody.widgetSlug ?? null,
        channelKind,
      },
    });
    await appendChatFailureLog({
      projetoId: resolved.projeto.id,
      origem: "chat_service.channel_resolution",
      descricao: "Canal travado a agente invalido ou inativo.",
      payload: {
        projeto: effectiveBody.projeto ?? null,
        agente: effectiveBody.agente ?? null,
        widgetSlug: effectiveBody.widgetSlug ?? null,
        channelKind,
      },
    });
    return buildSilentChatResult(effectiveBody.chatId);
  }

  let authoritativeAgent = lockedWhatsAppAgent ?? resolved.agente ?? null;
  let chat = effectiveBody.chatId ? await getChatById(effectiveBody.chatId) : null;

  if (chat) {
    const validatedChat = await validateChatAgainstResolvedChannel({
      chat,
      resolved,
      channelKind,
      effectiveBody,
      normalizedExternalIdentifier,
      lockedWhatsAppAgent,
    });

    if (!validatedChat) {
      chat = null;
    } else {
      chat = validatedChat.chat;
      authoritativeAgent = validatedChat.authoritativeAgent ?? authoritativeAgent;
    }
  }

  if (!chat) {
    if (normalizedExternalIdentifier) {
      const preferredAgentId = resolved.agente?.id ?? null;
      chat = await findActiveChatByChannel({
        projetoId: resolved.projeto.id,
        agenteId: preferredAgentId,
        canal: channelKind,
        identificadorExterno: normalizedExternalIdentifier,
        channelScopeId: channelKind === "whatsapp" ? body.whatsappChannelId ?? null : null,
      });
    }

    if (!chat) {
      const extraContext = isPlainObject(effectiveBody.context) ? effectiveBody.context : null;
      const source = effectiveBody.source?.trim() || (channelKind === "whatsapp" ? "whatsapp_bridge" : "site_widget");
      const baseContext = {
        source,
        canal: channelKind,
        objetivo: channelKind === "whatsapp" ? "atendimento_whatsapp" : "captacao_comercial",
        widget: resolved.widget
          ? {
              slug: resolved.widget.slug,
              nome: resolved.widget.nome,
              whatsapp_celular: resolved.widget.whatsappCelular || null,
            }
          : null,
        projeto: {
          id: resolved.projeto?.id ?? null,
          slug: resolved.projeto?.slug ?? effectiveBody.projeto?.trim() ?? null,
          nome: resolved.projeto?.nome ?? null,
        },
        agente: {
          id: resolved.agente?.id ?? null,
          slug: resolved.agente?.slug ?? effectiveBody.agente?.trim() ?? null,
          nome: resolved.agente?.nome ?? null,
          locked: resolved.lockedToAgent,
        },
        sdk: {
          version: "1",
          channel: channelKind === "whatsapp" ? "whatsapp-bridge" : "chat.js",
        },
        channel: {
          ...resolved.channel,
          external_id: normalizedExternalIdentifier,
        },
      };

      const initialContext = mergeContext(baseContext, extraContext);
      const contactSnapshot = resolveChatContactSnapshot(initialContext, normalizedExternalIdentifier);
      const fallbackChatTitle =
        contactSnapshot.contatoNome ?? (message.length > 60 ? `${message.slice(0, 57)}...` : message);
      chat = await createChat({
        titulo: fallbackChatTitle,
        projetoId: resolved.projeto?.id ?? null,
        agenteId: resolved.agente?.id ?? null,
        canal: channelKind,
        identificadorExterno: normalizedExternalIdentifier,
        contexto: initialContext,
        contatoNome: contactSnapshot.contatoNome,
        contatoTelefone: contactSnapshot.contatoTelefone,
        contatoAvatarUrl: contactSnapshot.contatoAvatarUrl,
      });
    }
  }

  if (!chat) {
    throw new Error("Nao foi possivel iniciar a conversa no banco. Verifique permissoes nas tabelas `chats` e `mensagens`.");
  }

  const chatContext = getChatContext(chat) as Record<string, unknown>;
  const lockedAgentFromContext =
    isPlainObject(chatContext.agente) && chatContext.agente.locked === true ? true : false;
  const lockedAgentIdFromContext = getLockedAgentIdFromChatContext(chat);

  if (channelKind === "whatsapp" || lockedAgentFromContext) {
    const currentAgentId = lockedAgentIdFromContext ?? chat.agenteId ?? effectiveBody.agente ?? null;
    const currentAgent = authoritativeAgent ?? (currentAgentId ? await getAgenteById(currentAgentId) : null);

    if (!currentAgent || !currentAgent.ativo || currentAgent.projetoId !== chat.projetoId) {
      await appendRuntimeErrorLog({
        source: "chat_service.chat_guardrail",
        message: "Chat bloqueado por agente invalido, inativo ou fora do projeto.",
        projetoId: chat.projetoId,
        agenteId: currentAgentId,
        payload: {
          chatId: chat.id,
          channelKind,
          lockedAgentFromContext,
          agentProjetoId: currentAgent?.projetoId ?? null,
          agentAtivo: currentAgent?.ativo ?? null,
        },
      });
      await appendChatFailureLog({
        projetoId: chat.projetoId,
        agenteId: currentAgentId,
        chatId: chat.id,
        origem: "chat_service.chat_guardrail",
        descricao: "Chat bloqueado por agente invalido, inativo ou fora do projeto.",
        payload: {
          channelKind,
          lockedAgentFromContext,
          agentProjetoId: currentAgent?.projetoId ?? null,
          agentAtivo: currentAgent?.ativo ?? null,
        },
      });
      return buildSilentChatResult(chat.id);
    }

    authoritativeAgent = currentAgent;
  }

  const userMessage = await appendMessage({
    chatId: chat.id,
    role: "user",
    conteudo: message,
    canal: channelKind,
    identificadorExterno: normalizedExternalIdentifier,
    metadata: {
      source: effectiveBody.source?.trim() || (channelKind === "whatsapp" ? "whatsapp_bridge" : "site_widget"),
    },
  });

  if (!userMessage) {
    throw new Error("Nao foi possivel gravar a mensagem do cliente. Verifique permissoes na tabela `mensagens`.");
  }

  if (channelKind === "whatsapp") {
    const inboundWhatsappContext =
      effectiveBody.context && isPlainObject(effectiveBody.context.whatsapp)
        ? (effectiveBody.context.whatsapp as {
            [key: string]: unknown;
            channelId?: string | null;
            remoteJid?: string | null;
            remotePhone?: string | null;
            remetente?: string | null;
            contactName?: string | null;
            profilePicUrl?: string | null;
          })
        : null;
    const inboundLeadContext =
      effectiveBody.context && isPlainObject(effectiveBody.context.lead)
        ? (effectiveBody.context.lead as Record<string, unknown>)
        : null;
    const inboundContactSnapshot = resolveChatContactSnapshot(
      effectiveBody.context && typeof effectiveBody.context === "object" ? effectiveBody.context : null,
      normalizedExternalIdentifier,
    );

    await appendSystemLog({
      projetoId: chat.projetoId,
      tipo: "chat_whatsapp_contact_snapshot",
      origem: "chat_service.whatsapp",
      descricao: "Snapshot de contato recebido do WhatsApp.",
      payload: {
        chatId: chat.id,
        channelId: inboundWhatsappContext?.channelId ?? body.whatsappChannelId ?? null,
        remoteJid: inboundWhatsappContext?.remoteJid ?? null,
        remotePhone: inboundWhatsappContext?.remotePhone ?? null,
        remetente: inboundWhatsappContext?.remetente ?? null,
        contactName: inboundWhatsappContext?.contactName ?? null,
        profilePicUrl: inboundWhatsappContext?.profilePicUrl ?? null,
        profilePicUrlPresent: Boolean(inboundWhatsappContext?.profilePicUrl),
        rawWhatsappContext: inboundWhatsappContext,
        rawLeadContext: inboundLeadContext,
        resolvedSnapshot: inboundContactSnapshot,
        storedChatSnapshot: {
          contatoNome: chat.contatoNome ?? null,
          contatoTelefone: chat.contatoTelefone ?? null,
          contatoAvatarUrl: chat.contatoAvatarUrl ?? null,
        },
        normalizedExternalIdentifier,
      },
      skipErrorGate: true,
    });
  }

  const currentHandoff = await getChatHandoffByChatId(chat.id);
  if (shouldPauseAssistantForHandoff(currentHandoff)) {
    await appendSystemLog({
      projetoId: chat.projetoId,
      tipo: "chat_handoff_paused",
      origem: "chat_service.handoff",
      descricao: "Mensagem recebida com atendimento humano ativo; IA permaneceu em silencio.",
      payload: {
        chatId: chat.id,
        handoffStatus: currentHandoff?.status ?? null,
        channelKind,
      },
    });

    if (channelKind === "whatsapp" && body.whatsappChannelId) {
      await updateWhatsAppChannelSession(body.whatsappChannelId, {
        connectionStatus: "online",
        lastInboundAt: new Date().toISOString(),
      });
    }

    return buildSilentChatResult(chat.id);
  }

  const history = await listChatMessages(chat.id);
  const billingAccess = chat.projetoId ? await verifyProjetoBillingAccess(chat.projetoId) : null;
  if (billingAccess && !billingAccess.allowed) {
    await appendChatFailureLog({
      projetoId: chat.projetoId,
      agenteId: authoritativeAgent?.id ?? chat.agenteId,
      chatId: chat.id,
      origem: "chat_service.billing_guardrail",
      descricao: billingAccess.message ?? "Projeto bloqueado por limite de uso.",
      payload: {
        code: billingAccess.code,
      },
    });

    return buildBillingBlockedResult(
      chat.id,
      billingAccess.message ?? "O limite mensal deste projeto foi atingido. Fale com o administrador para liberar novo ciclo ou ajustar o plano.",
    );
  }

  const currentContext = chatContext;
  const extraContext = isPlainObject(effectiveBody.context) ? effectiveBody.context : null;
  const mergedCurrentContext = mergeContext(currentContext, extraContext);
  const enrichedContext = enrichLeadContext(
    mergedCurrentContext,
    history.map((item) => ({ role: item.role, content: item.conteudo })),
    message,
  );
  const enrichedContextRecord = enrichedContext as Record<string, unknown>;
  const nextContext = {
    ...mergedCurrentContext,
    ...enrichedContext,
    canal: channelKind,
    channel: isPlainObject(enrichedContextRecord.channel)
      ? {
          ...(isPlainObject(mergedCurrentContext.channel) ? mergedCurrentContext.channel : {}),
          ...enrichedContextRecord.channel,
          kind: channelKind,
          external_id: normalizedExternalIdentifier,
        }
      : {
          ...(isPlainObject(mergedCurrentContext.channel) ? mergedCurrentContext.channel : {}),
          kind: channelKind,
          external_id: normalizedExternalIdentifier,
        },
    ui: {
      ...(isPlainObject(mergedCurrentContext.ui) ? mergedCurrentContext.ui : {}),
      ...(isPlainObject(enrichedContextRecord.ui) ? enrichedContextRecord.ui : {}),
      ...(channelKind === "whatsapp"
        ? {
            structured_response: false,
            allow_icons: true,
          }
        : {}),
    },
    sdk: isPlainObject(enrichedContextRecord.sdk)
      ? { ...(isPlainObject(mergedCurrentContext.sdk) ? mergedCurrentContext.sdk : {}), ...enrichedContextRecord.sdk }
      : mergedCurrentContext.sdk,
    widget: isPlainObject(enrichedContextRecord.widget)
      ? { ...(isPlainObject(mergedCurrentContext.widget) ? mergedCurrentContext.widget : {}), ...enrichedContextRecord.widget }
      : mergedCurrentContext.widget,
    catalogo: isPlainObject(mergedCurrentContext.catalogo) ? { ...mergedCurrentContext.catalogo } : {},
  };

  if (!nextContext.lead?.telefone && history.length >= 2 && history.length < 6) {
    nextContext.qualificacao = {
      ...nextContext.qualificacao,
      pronto_para_whatsapp: false,
    };
  }

  const requestedCatalogSearch = isCatalogSearchMessage(message);
  if (requestedCatalogSearch) {
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      ultimaBusca: message.trim(),
      produtoAtual: null,
      ultimosProdutos: [],
    };
  }

  const ai = await generateSalesReply(
    history.map((item) => ({
      role: item.role,
      content: item.conteudo,
    })),
    nextContext as Parameters<typeof generateSalesReply>[1],
  );

  const handoffRequested =
    channelKind === "whatsapp" &&
    Boolean(chat.projetoId) &&
    Boolean(getChatWhatsAppChannelId(chat, body)) &&
    (isHumanHandoffIntent(message) || shouldEscalateToHumanByAi(ai.metadata));

  if (handoffRequested && chat.projetoId) {
    const canalWhatsappId = getChatWhatsAppChannelId(chat, body);
    const acknowledgement = buildHumanHandoffReply(channelKind);
    const alertResult = canalWhatsappId
        ? await notifyWhatsAppHandoffContacts({
            projetoId: chat.projetoId,
            projetoNome: nextContext.projeto?.nome ? String(nextContext.projeto.nome) : null,
            canalWhatsappId,
            chatId: chat.id,
            chatTitle:
              typeof nextContext.lead?.nome === "string" && nextContext.lead.nome.trim()
                ? nextContext.lead.nome.trim()
                : chat.titulo,
            latestUserMessage: message,
            motivo: isHumanHandoffIntent(message)
              ? "Cliente pediu atendimento humano."
              : "Conversa saiu do alcance do agente e foi escalada para um humano.",
          })
      : { ok: false, sent: 0, link: null, failures: [] as Array<{ numero: string; error: string }> };

    await requestHumanHandoff({
      chatId: chat.id,
      projetoId: chat.projetoId,
      canalWhatsappId: canalWhatsappId ?? null,
      requestedBy: "agent",
      motivo: isHumanHandoffIntent(message)
        ? "Cliente pediu atendimento humano."
        : "Conversa saiu do alcance do agente e foi escalada para um humano.",
      metadata: {
        trigger: isHumanHandoffIntent(message) ? "message_intent" : "agent_scope_limit",
        alertSent: alertResult.sent,
        alertLink: alertResult.link ?? null,
        failures: "failures" in alertResult ? alertResult.failures : [],
      },
      alertMessage: alertResult.link ?? null,
    });

    ai.reply = acknowledgement;
    ai.assets = [];
    (nextContext as Record<string, unknown>).handoff = {
      status: "pending_human",
      requestedAt: new Date().toISOString(),
      alertLink: alertResult.link ?? null,
      alertCount: alertResult.sent ?? 0,
    };
  }

  if (!String(ai.reply ?? "").trim()) {
    await appendChatFailureLog({
      projetoId: chat.projetoId,
      agenteId: authoritativeAgent?.id ?? chat.agenteId,
      chatId: chat.id,
      origem: "chat_service.reply_guardrail",
      descricao: "Resposta bloqueada ou vazia no fluxo do agente.",
      payload: {
        channelKind,
        provider: typeof ai.metadata?.provider === "string" ? ai.metadata.provider : null,
        model: typeof ai.metadata?.model === "string" ? ai.metadata.model : null,
      },
    });
  }

  if (typeof ai.metadata?.provider === "string" && ai.metadata.provider === "agent_scoped_recovery") {
    await appendChatFailureLog({
      projetoId: chat.projetoId,
      agenteId: authoritativeAgent?.id ?? chat.agenteId,
      chatId: chat.id,
      origem: "chat_service.agent_scoped_recovery",
      descricao: "IA principal falhou e a conversa seguiu com recuperacao contextual do agente.",
      payload: {
        channelKind,
        provider: ai.metadata.provider,
        model: typeof ai.metadata?.model === "string" ? ai.metadata.model : null,
      },
    });
    await appendSystemLog({
      projetoId: chat.projetoId,
      tipo: "chat_recovery",
      origem: "chat_service.agent_scoped_recovery",
      descricao: "Recuperacao contextual aplicada no agente travado.",
      payload: {
        chatId: chat.id,
        agenteId: authoritativeAgent?.id ?? chat.agenteId ?? null,
        channelKind,
        provider: ai.metadata.provider,
        model: typeof ai.metadata?.model === "string" ? ai.metadata.model : null,
      },
    });
  }

  const aiResolvedAgentId = typeof ai.metadata?.agenteId === "string" ? ai.metadata.agenteId : null;
  const aiResolvedAgentName = typeof ai.metadata?.agenteNome === "string" ? ai.metadata.agenteNome : null;
  const lockedAgent = authoritativeAgent ?? (chat.agenteId ? await getAgenteById(chat.agenteId) : null);

  if (resolved.lockedToAgent && aiResolvedAgentId && lockedAgent && aiResolvedAgentId !== lockedAgent.id) {
    await appendRuntimeErrorLog({
      source: "chat_service.agent_drift_guardrail",
      message: "Resposta tentou sobrescrever o agente travado do chat.",
      projetoId: chat.projetoId,
      agenteId: lockedAgent.id,
      payload: {
        chatId: chat.id,
        lockedAgentId: lockedAgent.id,
        aiResolvedAgentId,
        aiResolvedAgentName,
        channelKind,
      },
    });
    await appendChatFailureLog({
      projetoId: chat.projetoId,
      agenteId: lockedAgent.id,
      chatId: chat.id,
      origem: "chat_service.agent_drift_guardrail",
      descricao: "Resposta tentou sobrescrever o agente travado do chat.",
      payload: {
        lockedAgentId: lockedAgent.id,
        aiResolvedAgentId,
        aiResolvedAgentName,
        channelKind,
      },
    });
  }

  nextContext.agente = {
    id: lockedAgent?.id ?? lockedAgentIdFromContext ?? chat.agenteId ?? null,
    nome: lockedAgent?.nome ?? aiResolvedAgentName ?? null,
    locked: resolved.lockedToAgent || channelKind === "whatsapp" || lockedAgentFromContext,
  };

  const latestNormalizedMessage = message.toLowerCase();
  const catalogSignals = ["tem ", "produto", "produtos", "catalogo", "catálogo", "loja", "vende", "procuro", "estou procurando"];
  const catalogSearchRequested = catalogSignals.some((signal) => latestNormalizedMessage.includes(signal)) || /^\s*e\s+\S+/i.test(message);
  if (catalogSearchRequested) {
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      ultimaBusca: message.trim(),
    };
  }

  const recentMercadoLivreProducts = extractRecentMercadoLivreProductsFromAssets(ai.assets);
  if (recentMercadoLivreProducts.length) {
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      ultimosProdutos: recentMercadoLivreProducts,
    };
  }

  if (isPlainObject(ai.metadata) && isPlainObject(ai.metadata.catalogoProdutoAtual)) {
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      produtoAtual: ai.metadata.catalogoProdutoAtual,
    };
  }

  const estimatedCostUsd =
    ai.metadata?.provider === "openai"
      ? estimateOpenAICostUsd(ai.usage.inputTokens, ai.usage.outputTokens, typeof ai.metadata?.model === "string" ? ai.metadata.model : null)
      : 0;

  const leadNameForTitle =
    typeof nextContext.lead?.nome === "string" && nextContext.lead.nome.trim() ? nextContext.lead.nome.trim() : null;
  const whatsappContactNameForTitle = getWhatsAppContactNameFromContext(nextContext);
  const contactSnapshot = resolveChatContactSnapshot(nextContext, normalizedExternalIdentifier);

  const assistantMessage = await appendMessage({
    chatId: chat.id,
    role: "assistant",
    conteudo: ai.reply,
    canal: channelKind,
    identificadorExterno: normalizedExternalIdentifier,
    tokensInput: ai.usage.inputTokens,
    tokensOutput: ai.usage.outputTokens,
    custo: estimatedCostUsd,
    metadata: {
      ...ai.metadata,
      assets: ai.assets ?? [],
    },
  });

  if (!assistantMessage) {
    throw new Error("O modelo respondeu, mas nao foi possivel salvar a resposta no banco.");
  }

  const messageCount = Number(nextContext.memoria?.mensagem_count ?? 0);
  if (shouldRefreshSummary(messageCount)) {
    nextContext.memoria = {
      ...nextContext.memoria,
      resumo: await summarizeConversation(
        history.map((item) => ({
          role: item.role,
          content: item.conteudo,
        })),
        typeof nextContext.memoria?.resumo === "string" ? nextContext.memoria.resumo : null,
        nextContext.projeto?.id ?? null,
      ),
      ultimo_resumo_at: new Date().toISOString(),
    };
  }

  if (nextContext.lead?.identificado) {
    nextContext.qualificacao = {
      ...nextContext.qualificacao,
      pronto_para_whatsapp: true,
    };
  }

  await updateChatContext(chat.id, nextContext);
  await updateChatStats({
    chatId: chat.id,
    totalTokensToAdd: ai.usage.inputTokens + ai.usage.outputTokens,
    totalCustoToAdd: estimatedCostUsd,
    titulo: leadNameForTitle ?? whatsappContactNameForTitle ?? chat.titulo,
    contexto: nextContext,
    identificadorExterno: normalizedExternalIdentifier,
    contatoNome: contactSnapshot.contatoNome,
    contatoTelefone: contactSnapshot.contatoTelefone,
    contatoAvatarUrl: contactSnapshot.contatoAvatarUrl,
  });

  if (chat.projetoId) {
    await registrarUso(
      chat.projetoId,
      ai.usage.inputTokens + ai.usage.outputTokens,
      estimatedCostUsd,
      {
        tokensInput: ai.usage.inputTokens,
        tokensOutput: ai.usage.outputTokens,
        usuarioId: chat.usuarioId,
        origem: channelKind,
        referenciaId: assistantMessage.id,
      },
    );
  }

  await appendChatRequestLog({
    projetoId: nextContext.projeto?.id ?? null,
    descricao: `Chat ${chat.id} | ${ai.metadata?.provider ?? "unknown"} | ${ai.metadata?.model ?? "unknown"}`,
    payload: {
      chatId: chat.id,
      title: chat.titulo,
      provider: ai.metadata?.provider ?? null,
      model: ai.metadata?.model ?? null,
      channel: nextContext.channel ?? null,
      lead: nextContext.lead ?? null,
      summary: nextContext.memoria?.resumo ?? null,
      messageCount: nextContext.memoria?.mensagem_count ?? history.length,
      latestUserMessage: message,
      tokens: {
        input: ai.usage.inputTokens,
        output: ai.usage.outputTokens,
        total: ai.usage.inputTokens + ai.usage.outputTokens,
      },
      estimatedCostUsd,
      requestDebug:
        ai.metadata && typeof ai.metadata === "object" && "debugRequest" in ai.metadata
          ? (ai.metadata.debugRequest as Record<string, unknown>)
          : null,
      replyPreview: String(ai.reply ?? "").slice(0, 500),
    },
  });

  let whatsapp: {
    url: string | null;
    label: string;
    phone: string;
  } | null = null;

  if (channelKind !== "whatsapp" && nextContext.projeto?.id) {
    const preferredChannel = await getPreferredWhatsAppChannel({
      projetoId: String(nextContext.projeto.id),
      agenteId: nextContext.agente?.id ? String(nextContext.agente.id) : null,
    });
    const widgetContext = isPlainObject((nextContext as Record<string, unknown>).widget)
      ? ((nextContext as Record<string, unknown>).widget as Record<string, unknown>)
      : null;
    const fallbackWidgetPhone =
      typeof widgetContext?.whatsapp_celular === "string" && widgetContext.whatsapp_celular.trim()
        ? widgetContext.whatsapp_celular.trim()
        : null;
    const agentAtual = nextContext.agente?.id ? await getAgenteById(String(nextContext.agente.id)) : null;
    const configuredWhatsappCta =
      agentAtual?.configuracoes &&
      typeof agentAtual.configuracoes.cta_whatsapp === "string" &&
      agentAtual.configuracoes.cta_whatsapp.trim()
        ? agentAtual.configuracoes.cta_whatsapp.trim()
        : null;
    const hasWhatsappHandoff =
      Boolean(agentAtual?.configuracoes) &&
      typeof agentAtual?.configuracoes?.handoff === "object" &&
      agentAtual.configuracoes.handoff !== null;
    const whatsappPhone = preferredChannel?.numero || fallbackWidgetPhone;
    const hasWhatsappBias = Boolean(whatsappPhone) || Boolean(configuredWhatsappCta) || hasWhatsappHandoff;
    const shouldOfferCommercialCta =
      /whats\s?app/i.test(ai.reply) ||
      /estimativa|orcamento|orÃ§amento|proximo passo|pr[oÃ³]ximo passo|encaixe inicial|fecharmos/i.test(ai.reply);
    const shouldPreferWhatsappButton =
      hasWhatsappBias &&
      (Boolean(nextContext.qualificacao?.pronto_para_whatsapp) ||
        shouldOfferCommercialCta ||
        Number(nextContext.memoria?.mensagem_count ?? 0) >= 2);

    if (whatsappPhone && shouldPreferWhatsappButton) {
      whatsapp = {
        url: buildWhatsAppLink(
          whatsappPhone,
          buildContinuationMessage({
            projetoNome: nextContext.projeto?.nome ? String(nextContext.projeto.nome) : null,
            agenteNome: nextContext.agente?.nome ? String(nextContext.agente.nome) : null,
            resumo: typeof nextContext.memoria?.resumo === "string" ? nextContext.memoria.resumo : null,
            ultimaMensagem: message,
          }),
        ),
        label: "Continuar no WhatsApp",
        phone: whatsappPhone,
      };
    }
  }

  if (channelKind === "whatsapp" && body.whatsappChannelId) {
    await updateWhatsAppChannelSession(body.whatsappChannelId, {
      connectionStatus: "online",
      lastInboundAt: new Date().toISOString(),
      lastOutboundAt: new Date().toISOString(),
    });
  }

  return {
    chatId: chat.id,
    reply: assistantMessage.conteudo ?? ai.reply,
    assets: ai.assets ?? [],
    whatsapp,
  };
}
