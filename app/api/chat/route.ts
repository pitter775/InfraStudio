import { NextResponse } from "next/server";
import { appendMessage, createChat, getChatById, getChatContext, listChatMessages, updateChatContext, updateChatStats } from "@/lib/chats";
import { enrichLeadContext, generateSalesReply, shouldRefreshSummary, summarizeConversation } from "@/lib/chat-orchestrator";
import { getAgenteAtivo, getAgenteById, getAgenteByIdentifier } from "@/lib/agentes";
import { DEFAULT_HOME_WIDGET_SLUG, getChatWidgetByProjetoAgente, getChatWidgetBySlug } from "@/lib/chat-widgets";
import { getProjetoById, getProjetoByIdentifier } from "@/lib/projetos";

type ChatRequestBody = {
  chatId?: string;
  message?: string;
  projeto?: string;
  agente?: string;
  context?: Record<string, unknown> | null;
  widgetSlug?: string;
};

function sanitizePhone(phone: string | null | undefined) {
  return String(phone || "").replace(/\D/g, "");
}

function buildWhatsAppLink(phone: string | null | undefined, message: string) {
  var sanitizedPhone = sanitizePhone(phone);
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

async function resolveChatChannel(body: ChatRequestBody) {
  const projetoIdentifier = body.projeto?.trim() || null;
  const agenteIdentifier = body.agente?.trim() || null;
  const requestedChannelKind =
    isPlainObject(body.context) && isPlainObject(body.context.channel) && typeof body.context.channel.kind === "string"
      ? body.context.channel.kind.trim()
      : null;

  if (projetoIdentifier) {
    const projeto = await getProjetoByIdentifier(projetoIdentifier);
    let agente = agenteIdentifier
      ? await getAgenteByIdentifier(agenteIdentifier, projeto?.id ?? null)
      : null;

    if (!agente && projeto) {
      agente = await getAgenteAtivo(projeto.id);
    }

    const widget = projeto ? await getChatWidgetByProjetoAgente({ projetoId: projeto.id, agenteId: agente?.id ?? null }) : null;

    return {
      projeto,
      agente,
      widget,
      channel: {
        kind: requestedChannelKind || "external_widget",
        projeto: projetoIdentifier,
        agente: agenteIdentifier,
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
      channel: {
        kind: requestedChannelKind || "external_widget",
        widgetSlug,
      },
    };
  }

  const projeto = await getProjetoById(widget.projetoId);
  const agente =
    widget?.agenteId && projeto
      ? await getAgenteById(widget.agenteId)
      : projeto
        ? await getAgenteAtivo(projeto.id)
        : null;

  return {
    projeto,
    agente,
    widget,
    channel: {
      kind: requestedChannelKind || "external_widget",
      widgetSlug,
    },
  };
}

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const corsHeaders = buildCorsHeaders(request.headers.get("origin"));

  try {
    const body = (await request.json()) as ChatRequestBody;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: "Mensagem obrigatoria." }, { status: 400, headers: corsHeaders });
    }

    let chat = body.chatId ? await getChatById(body.chatId) : null;

    if (!chat) {
      const resolved = await resolveChatChannel(body);

      if (!resolved.projeto) {
        return NextResponse.json(
          { error: "Projeto ou widget do chat nao encontrado. Revise o embed configurado para este site." },
          { status: 400, headers: corsHeaders },
        );
      }

      const extraContext = isPlainObject(body.context) ? body.context : null;
      const baseContext = {
        source: "site_widget",
        canal: "site",
        objetivo: "captacao_comercial",
        widget: resolved.widget
          ? {
              slug: resolved.widget.slug,
              nome: resolved.widget.nome,
              whatsapp_celular: resolved.widget.whatsappCelular || null,
            }
          : null,
        projeto: {
          id: resolved.projeto?.id ?? null,
          slug: resolved.projeto?.slug ?? body.projeto?.trim() ?? null,
          nome: resolved.projeto?.nome ?? null,
        },
        agente: {
          id: resolved.agente?.id ?? null,
          slug: resolved.agente?.slug ?? body.agente?.trim() ?? null,
          nome: resolved.agente?.nome ?? null,
        },
        sdk: {
          version: "1",
          channel: "chat.js",
        },
        channel: resolved.channel,
      };

      chat = await createChat({
        titulo: message.length > 60 ? `${message.slice(0, 57)}...` : message,
        projetoId: resolved.projeto?.id ?? null,
        agenteId: resolved.agente?.id ?? null,
        contexto: mergeContext(baseContext, extraContext),
      });
    }

    if (!chat) {
      return NextResponse.json(
        { error: "Nao foi possivel iniciar a conversa no banco. Verifique permissoes nas tabelas `chats` e `mensagens`." },
        { status: 500, headers: corsHeaders },
      );
    }

    const userMessage = await appendMessage({
      chatId: chat.id,
      role: "user",
      conteudo: message,
      metadata: {
        source: "site_widget",
      },
    });

    if (!userMessage) {
      return NextResponse.json(
        { error: "Nao foi possivel gravar a mensagem do cliente. Verifique permissoes na tabela `mensagens`." },
        { status: 500, headers: corsHeaders },
      );
    }

    const history = await listChatMessages(chat.id);
    const currentContext = getChatContext(chat) as Record<string, unknown>;
    const extraContext = isPlainObject(body.context) ? body.context : null;
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
      channel: isPlainObject(enrichedContextRecord.channel)
        ? { ...(isPlainObject(mergedCurrentContext.channel) ? mergedCurrentContext.channel : {}), ...enrichedContextRecord.channel }
        : mergedCurrentContext.channel,
      ui: isPlainObject(enrichedContextRecord.ui)
        ? { ...(isPlainObject(mergedCurrentContext.ui) ? mergedCurrentContext.ui : {}), ...enrichedContextRecord.ui }
        : mergedCurrentContext.ui,
      sdk: isPlainObject(enrichedContextRecord.sdk)
        ? { ...(isPlainObject(mergedCurrentContext.sdk) ? mergedCurrentContext.sdk : {}), ...enrichedContextRecord.sdk }
        : mergedCurrentContext.sdk,
      widget: isPlainObject(enrichedContextRecord.widget)
        ? { ...(isPlainObject(mergedCurrentContext.widget) ? mergedCurrentContext.widget : {}), ...enrichedContextRecord.widget }
        : mergedCurrentContext.widget,
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
    };

    const assistantMessage = await appendMessage({
      chatId: chat.id,
      role: "assistant",
      conteudo: ai.reply,
      tokensInput: ai.usage.inputTokens,
      tokensOutput: ai.usage.outputTokens,
      custo: 0,
      metadata: {
        ...ai.metadata,
        assets: ai.assets ?? [],
      },
    });

    if (!assistantMessage) {
      return NextResponse.json(
        { error: "O modelo respondeu, mas nao foi possivel salvar a resposta no banco." },
        { status: 500, headers: corsHeaders },
      );
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
      totalCustoToAdd: 0,
      contexto: nextContext,
    });

    const widgetContext = isPlainObject((nextContext as Record<string, unknown>).widget)
      ? ((nextContext as Record<string, unknown>).widget as Record<string, unknown>)
      : null;
    const widgetPhone =
      typeof widgetContext?.whatsapp_celular === "string" && widgetContext.whatsapp_celular.trim()
        ? widgetContext.whatsapp_celular.trim()
        : null;
    const shouldOfferCommercialCta =
      /whats\s?app/i.test(ai.reply) ||
      /estimativa|orcamento|orçamento|proximo passo|pr[oó]ximo passo|encaixe inicial|fecharmos/i.test(ai.reply);
    const shouldShowWhatsappButton =
      Boolean(widgetPhone) &&
      (Boolean(nextContext.qualificacao?.pronto_para_whatsapp) || shouldOfferCommercialCta);
    const whatsappMessage = [
      "Ola! Vim do chat do site",
      nextContext.projeto?.nome ? "do projeto " + String(nextContext.projeto.nome) : "",
      ".",
      "",
      "Ultima mensagem:",
      message,
    ]
      .join(" ")
      .replace(/\s+\./g, ".")
      .trim();

    return NextResponse.json(
      {
        chatId: chat.id,
        reply: assistantMessage.conteudo ?? ai.reply,
        assets: ai.assets ?? [],
        whatsapp: shouldShowWhatsappButton
          ? {
              url: buildWhatsAppLink(widgetPhone, whatsappMessage),
              label: "Continuar no WhatsApp",
              phone: widgetPhone,
            }
          : null,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("[chat] failed to answer message", error);
    return NextResponse.json(
      {
        error: "Nao foi possivel responder agora.",
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
