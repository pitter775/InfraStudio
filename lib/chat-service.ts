import { getAgenteAtivo, getAgenteById, getAgenteByIdentifier, type AgenteRecord } from "@/lib/agentes";
import { appendChatRequestLog, appendSystemLog } from "@/lib/chat-logs";
import { enrichLeadContext, generateSalesReply, shouldRefreshSummary, summarizeConversation } from "@/lib/chat-orchestrator";
import { DEFAULT_HOME_WIDGET_SLUG, getChatWidgetByProjetoAgente, getChatWidgetBySlug } from "@/lib/chat-widgets";
import { appendMessage, createChat, findActiveChatByChannel, getChatById, getChatContext, listChatMessages, type ChatChannelKind, updateChatContext, updateChatStats } from "@/lib/chats";
import { registrarUso, verifyProjetoBillingAccess } from "@/lib/billing";
import { estimateOpenAICostUsd } from "@/lib/openai-pricing";
import { getProjetoById, getProjetoByIdentifier } from "@/lib/projetos";
import { appendRuntimeErrorLog } from "@/lib/runtime-error-log";
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

  const expectedAgentId = resolved.agente?.id ?? null;
  if (resolved.lockedToAgent && chat.agenteId !== expectedAgentId) {
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
    lockedWhatsAppAgent ?? (chat.agenteId ? await getAgenteById(chat.agenteId) : null);

  if (resolved.lockedToAgent) {
    if (!authoritativeAgent || !authoritativeAgent.ativo || authoritativeAgent.projetoId !== chat.projetoId) {
      await appendRuntimeErrorLog({
        source: "chat_service.chat_guardrail",
        message: "Chat bloqueado por agente invalido, inativo ou fora do projeto.",
        projetoId: chat.projetoId,
        agenteId: chat.agenteId,
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
  const projetoIdentifier = body.projeto?.trim() || null;
  const agenteIdentifier = body.agente?.trim() || null;
  const channelKind = normalizeChannelKind(body);

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
  const widgetLockedAgent = widgetAgent && widgetAgent.ativo && widgetAgent.projetoId === projeto?.id ? widgetAgent : null;
  const agente = widgetLockedAgent ?? (projeto ? await getAgenteAtivo(projeto.id) : null);

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
      chat = await findActiveChatByChannel({
        projetoId: resolved.projeto.id,
        agenteId: resolved.agente?.id ?? null,
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

      chat = await createChat({
        titulo: message.length > 60 ? `${message.slice(0, 57)}...` : message,
        projetoId: resolved.projeto?.id ?? null,
        agenteId: resolved.agente?.id ?? null,
        canal: channelKind,
        identificadorExterno: normalizedExternalIdentifier,
        contexto: mergeContext(baseContext, extraContext),
      });
    }
  }

  if (!chat) {
    throw new Error("Nao foi possivel iniciar a conversa no banco. Verifique permissoes nas tabelas `chats` e `mensagens`.");
  }

  const chatContext = getChatContext(chat) as Record<string, unknown>;
  const lockedAgentFromContext =
    isPlainObject(chatContext.agente) && chatContext.agente.locked === true ? true : false;

  if (channelKind === "whatsapp" || lockedAgentFromContext) {
    const currentAgentId = chat.agenteId ?? effectiveBody.agente ?? null;
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

  const ai = await generateSalesReply(
    history.map((item) => ({
      role: item.role,
      content: item.conteudo,
    })),
    nextContext as Parameters<typeof generateSalesReply>[1],
  );

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
    id: lockedAgent?.id ?? chat.agenteId ?? null,
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

  const estimatedCostUsd =
    ai.metadata?.provider === "openai"
      ? estimateOpenAICostUsd(ai.usage.inputTokens, ai.usage.outputTokens, typeof ai.metadata?.model === "string" ? ai.metadata.model : null)
      : 0;

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
    contexto: nextContext,
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
