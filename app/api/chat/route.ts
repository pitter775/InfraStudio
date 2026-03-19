import { NextResponse } from "next/server";
import { appendMessage, createChat, getChatById, getChatContext, listChatMessages, updateChatContext, updateChatStats } from "@/lib/chats";
import { enrichLeadContext, generateSalesReply, shouldRefreshSummary, summarizeConversation } from "@/lib/chat-orchestrator";
import { getAgenteAtivo } from "@/lib/agentes";
import { getProjetoBySlug } from "@/lib/projetos";

type ChatRequestBody = {
  chatId?: string;
  message?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: "Mensagem obrigatória." }, { status: 400 });
    }

    let chat = body.chatId ? await getChatById(body.chatId) : null;

    if (!chat) {
      const projeto = await getProjetoBySlug("infrastudio");
      const agente = projeto ? await getAgenteAtivo(projeto.id) : null;

      chat = await createChat({
        titulo: message.length > 60 ? `${message.slice(0, 57)}...` : message,
        projetoId: projeto?.id ?? null,
        agenteId: agente?.id ?? null,
        contexto: {
          source: "site_widget",
          canal: "site",
          objetivo: "captacao_comercial",
          projeto: {
            id: projeto?.id ?? null,
            slug: projeto?.slug ?? "infrastudio",
            nome: projeto?.nome ?? "InfraStudio",
          },
          agente: {
            id: agente?.id ?? null,
            nome: agente?.nome ?? null,
          },
        },
      });
    }

    if (!chat) {
      return NextResponse.json(
        { error: "Não foi possível iniciar a conversa no banco. Verifique permissões da API nas tabelas `chats` e `mensagens`." },
        { status: 500 },
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
        { error: "Não foi possível gravar a mensagem do cliente. Verifique permissões na tabela `mensagens`." },
        { status: 500 },
      );
    }

    const history = await listChatMessages(chat.id);
    const currentContext = getChatContext(chat);
    const nextContext = enrichLeadContext(
      currentContext,
      history.map((item) => ({ role: item.role, content: item.conteudo })),
      message,
    );

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
      nextContext,
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
      metadata: ai.metadata,
    });

    if (!assistantMessage) {
      return NextResponse.json(
        { error: "O modelo respondeu, mas não foi possível salvar a resposta no banco." },
        { status: 500 },
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

    return NextResponse.json(
      {
        chatId: chat.id,
        reply: assistantMessage?.conteudo ?? ai.reply,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[chat] failed to answer message", error);
    return NextResponse.json(
      {
        error: "Não foi possível responder agora.",
      },
      { status: 500 },
    );
  }
}
