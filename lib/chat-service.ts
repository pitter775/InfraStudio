import { getAgenteById, getAgenteByIdentifier, type AgenteRecord } from "@/lib/agentes";
import { appendChatRequestLog } from "@/lib/chat-logs";
import { enrichLeadContext, generateSalesReply, shouldRefreshSummary, summarizeConversation } from "@/lib/chat-orchestrator";
import { DEFAULT_HOME_WIDGET_SLUG, getChatWidgetByProjetoAgente, getChatWidgetBySlug } from "@/lib/chat-widgets";
import { appendMessage, createChat, findActiveChatByChannel, getChatById, getChatContext, listChatMessages, type ChatChannelKind, updateChatContext, updateChatStats } from "@/lib/chats";
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

async function resolveChatChannel(body: ChatRequestBody): Promise<ResolvedChatChannel> {
  const projetoIdentifier = body.projeto?.trim() || null;
  const agenteIdentifier = body.agente?.trim() || null;
  const channelKind = normalizeChannelKind(body);

  if (projetoIdentifier) {
    const projeto = await getProjetoByIdentifier(projetoIdentifier);
    let agente = agenteIdentifier ? await getAgenteByIdentifier(agenteIdentifier, projeto?.id ?? null) : null;
    const explicitAgentRequested = Boolean(agenteIdentifier);

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

  if (channelKind === "whatsapp" && body.whatsappChannelId) {
    const officialChannel = await getWhatsAppChannelById(body.whatsappChannelId);

    if (!officialChannel || !officialChannel.projetoId) {
      await appendRuntimeErrorLog({
        source: "chat_service.whatsapp_guardrail",
        message: "Canal WhatsApp nao encontrado ou sem projeto.",
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
      return buildSilentChatResult(body.chatId);
    }

    if (!officialChannel.agenteId) {
      await appendRuntimeErrorLog({
        source: "chat_service.whatsapp_guardrail",
        message: "Canal WhatsApp sem agente vinculado.",
        projetoId: officialChannel.projetoId,
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
  let chat = effectiveBody.chatId ? await getChatById(effectiveBody.chatId) : null;

  if (!chat) {
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
      return buildSilentChatResult(effectiveBody.chatId);
    }

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
    const currentAgent = lockedWhatsAppAgent ?? (currentAgentId ? await getAgenteById(currentAgentId) : null);

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
      return buildSilentChatResult(chat.id);
    }
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

  nextContext.agente = {
    id: typeof ai.metadata?.agenteId === "string" ? ai.metadata.agenteId : null,
    nome: typeof ai.metadata?.agenteNome === "string" ? ai.metadata.agenteNome : null,
    locked: channelKind === "whatsapp" || lockedAgentFromContext,
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
