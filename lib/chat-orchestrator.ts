import "server-only";

import { getAgenteAtivo } from "@/lib/agentes";
import type { ChatMessageRole } from "@/lib/chats";

type ConversationMessage = {
  role: ChatMessageRole;
  content: string;
};

type ConversationContext = {
  projeto?: {
    id?: string | null;
    slug?: string | null;
    nome?: string | null;
  };
  agente?: {
    id?: string | null;
    nome?: string | null;
  };
  lead?: {
    nome?: string | null;
    telefone?: string | null;
    identificado?: boolean;
  };
  memoria?: {
    resumo?: string | null;
    mensagem_count?: number;
  };
  qualificacao?: {
    segmento?: string | null;
    dor_principal?: string | null;
    objetivo?: string | null;
    pronto_para_whatsapp?: boolean;
  };
};

function heuristicReply(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("whatsapp") || normalized.includes("atendimento")) {
    return "Perfeito. A InfraStudio monta fluxos de WhatsApp para captar, qualificar e responder clientes com muito menos trabalho manual. Me diga seu segmento e eu ja te proponho um fluxo inicial.";
  }

  if (normalized.includes("crm") || normalized.includes("erp") || normalized.includes("integra")) {
    return "A gente costuma integrar CRM, ERP, formularios, pagamentos e atendimento para eliminar retrabalho e centralizar dados. Se quiser, me diga qual ferramenta voce usa hoje.";
  }

  if (normalized.includes("site") || normalized.includes("chat")) {
    return "Da para colocar um agente no seu site para captar leads, responder duvidas e encaminhar oportunidades para o WhatsApp do time comercial.";
  }

  if (normalized.includes("preco") || normalized.includes("orcamento") || normalized.includes("valor")) {
    return "Para te passar um caminho comercial melhor, me diz em uma frase o que voce quer automatizar e qual etapa hoje mais trava o fechamento.";
  }

  return "Entendi. Me conta qual processo voce quer automatizar hoje e se isso envolve site, WhatsApp, vendas, agenda ou integracoes. Com isso eu consigo te orientar e te levar para o WhatsApp no momento certo.";
}

function buildSystemPrompt(agent: Awaited<ReturnType<typeof getAgenteAtivo>>) {
  const defaultPrompt = [
    "Voce e o agente comercial inicial da InfraStudio.",
    "Seu papel e entender a necessidade do cliente, mostrar capacidade tecnica com objetividade e conduzir para o WhatsApp quando houver intencao comercial.",
    "Foque em automacao, IA, integracoes, sistemas sob medida, atendimento e vendas.",
    "Seja consultivo, direto e convincente sem soar robotico.",
    "Nao invente funcionalidades. Quando faltar contexto, faca uma pergunta curta de qualificacao.",
    "Mantenha respostas curtas, normalmente entre 3 e 6 linhas.",
    "Quando houver fit comercial, convide para continuar no WhatsApp.",
  ].join("\n");

  if (!agent) {
    return defaultPrompt;
  }

  const config = agent.configuracoes ?? {};
  const capabilities = Array.isArray(config.capacidades) ? config.capacidades.join(", ") : "";
  const qualifying = Array.isArray(config.perguntas_qualificacao) ? config.perguntas_qualificacao.join(" | ") : "";
  const cta = typeof config.cta_whatsapp === "string" ? config.cta_whatsapp : "";
  const pricingRules = Array.isArray(config.regras_precificacao)
    ? `Regras de precificacao disponiveis: ${JSON.stringify(config.regras_precificacao)}`
    : "";
  const handoff = config.handoff ? `Regras de handoff: ${JSON.stringify(config.handoff)}` : "";

  return [
    defaultPrompt,
    agent.nome ? `Nome do agente: ${agent.nome}` : "",
    agent.descricao ? `Descricao: ${agent.descricao}` : "",
    agent.promptBase ? `Prompt base: ${agent.promptBase}` : "",
    capabilities ? `Capacidades principais: ${capabilities}` : "",
    qualifying ? `Perguntas de qualificacao sugeridas: ${qualifying}` : "",
    pricingRules,
    handoff,
    cta ? `Orientacao de CTA: ${cta}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildInput(messages: ConversationMessage[]) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : message.role === "system" ? "system" : "user",
    content: [{ type: "input_text", text: message.content }],
  }));
}

function maybeAskForLeadIdentification(context: ConversationContext, latestUserMessage: string) {
  const count = context.memoria?.mensagem_count ?? 0;
  const identified = Boolean(context.lead?.identificado);
  const ready = Boolean(context.qualificacao?.pronto_para_whatsapp);
  const normalized = latestUserMessage.toLowerCase();

  if (identified) {
    return null;
  }

  if (ready || count >= 4 || normalized.includes("orcamento") || normalized.includes("whatsapp")) {
    return "Consigo seguir com voce por aqui, mas para te direcionar melhor no WhatsApp me envie seu nome e telefone com DDD.";
  }

  return null;
}

export async function generateSalesReply(history: ConversationMessage[], context?: ConversationContext) {
  const latestUserMessage = [...history].reverse().find((item) => item.role === "user")?.content ?? "";
  const projectId = context?.projeto?.id ?? null;
  const agent = projectId ? await getAgenteAtivo(projectId) : null;
  const systemPrompt = buildSystemPrompt(agent);
  const identificationPrompt = maybeAskForLeadIdentification(context ?? {}, latestUserMessage);

  if (identificationPrompt) {
    return {
      reply: identificationPrompt,
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "lead_identification_gate",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
      },
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      reply: heuristicReply(latestUserMessage),
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: { provider: "heuristic", model: "fallback", agenteId: agent?.id ?? null, agenteNome: agent?.nome ?? null },
    };
  }

  try {
    const recentMessages = history.slice(-6);
    const summary = context?.memoria?.resumo ? `Resumo atual do chat: ${context.memoria.resumo}` : "";
    const lead = context?.lead?.identificado
      ? `Lead identificado: nome=${context.lead?.nome ?? ""}; telefone=${context.lead?.telefone ?? ""}.`
      : "Lead ainda nao identificado.";
    const qualification = [
      context?.qualificacao?.segmento ? `Segmento: ${context.qualificacao.segmento}.` : "",
      context?.qualificacao?.objetivo ? `Objetivo: ${context.qualificacao.objetivo}.` : "",
      context?.qualificacao?.dor_principal ? `Dor principal: ${context.qualificacao.dor_principal}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
        temperature: 0.5,
        max_output_tokens: 220,
        instructions: [systemPrompt, summary, lead, qualification].filter(Boolean).join("\n"),
        input: buildInput(recentMessages),
      }),
    });

    const payload = (await response.json()) as {
      output_text?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
      error?: { message?: string };
      model?: string;
    };

    if (!response.ok || !payload.output_text) {
      console.error("[chat] openai response failed", payload.error?.message ?? payload);
      return {
        reply: heuristicReply(latestUserMessage),
        usage: { inputTokens: 0, outputTokens: 0 },
        metadata: {
          provider: "heuristic",
          model: "fallback_after_openai_error",
          agenteId: agent?.id ?? null,
          agenteNome: agent?.nome ?? null,
        },
      };
    }

    return {
      reply: payload.output_text.trim(),
      usage: {
        inputTokens: payload.usage?.input_tokens ?? 0,
        outputTokens: payload.usage?.output_tokens ?? 0,
      },
      metadata: {
        provider: "openai",
        model: payload.model ?? (process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini"),
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
      },
    };
  } catch (error) {
    console.error("[chat] failed to call openai", error);
    return {
      reply: heuristicReply(latestUserMessage),
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        provider: "heuristic",
        model: "fallback_after_exception",
        agenteId: agent?.id ?? null,
        agenteNome: agent?.nome ?? null,
      },
    };
  }
}

function extractPhone(message: string) {
  const digits = message.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

function extractName(message: string) {
  const match = message.match(/(?:meu nome(?: e| eh)?|sou o|sou a)\s+([a-zà-ú ]{3,})/i);
  return match?.[1]?.trim() ?? null;
}

export function enrichLeadContext(
  currentContext: Record<string, unknown> | null,
  history: ConversationMessage[],
  latestUserMessage: string,
) {
  const context = (currentContext ?? {}) as {
    origem?: string;
    lead?: { nome?: string | null; telefone?: string | null; email?: string | null; identificado?: boolean };
    memoria?: { resumo?: string | null; mensagem_count?: number; ultimo_resumo_at?: string | null };
    qualificacao?: {
      segmento?: string | null;
      dor_principal?: string | null;
      objetivo?: string | null;
      pronto_para_whatsapp?: boolean;
    };
  };

  const phone = extractPhone(latestUserMessage);
  const name = extractName(latestUserMessage);
  const nextCount = history.filter((item) => item.role !== "system").length;

  const nextContext = {
    origem: context.origem ?? "site",
    projeto: {
      id: (currentContext as { projeto?: { id?: string | null } } | null)?.projeto?.id ?? null,
      slug: (currentContext as { projeto?: { slug?: string | null } } | null)?.projeto?.slug ?? null,
      nome: (currentContext as { projeto?: { nome?: string | null } } | null)?.projeto?.nome ?? null,
    },
    agente: {
      id: (currentContext as { agente?: { id?: string | null } } | null)?.agente?.id ?? null,
      nome: (currentContext as { agente?: { nome?: string | null } } | null)?.agente?.nome ?? null,
    },
    lead: {
      nome: name ?? context.lead?.nome ?? null,
      telefone: phone ?? context.lead?.telefone ?? null,
      email: context.lead?.email ?? null,
      identificado: Boolean((phone ?? context.lead?.telefone) && (name ?? context.lead?.nome)),
    },
    memoria: {
      resumo: context.memoria?.resumo ?? null,
      mensagem_count: nextCount,
      ultimo_resumo_at: context.memoria?.ultimo_resumo_at ?? null,
    },
    qualificacao: {
      segmento: context.qualificacao?.segmento ?? null,
      dor_principal: context.qualificacao?.dor_principal ?? null,
      objetivo: context.qualificacao?.objetivo ?? null,
      pronto_para_whatsapp: context.qualificacao?.pronto_para_whatsapp ?? false,
    },
  };

  const normalized = latestUserMessage.toLowerCase();

  if (!nextContext.qualificacao.segmento) {
    if (normalized.includes("imobili")) nextContext.qualificacao.segmento = "imobiliaria";
    else if (normalized.includes("clin")) nextContext.qualificacao.segmento = "clinica";
    else if (normalized.includes("loja") || normalized.includes("e-commerce")) nextContext.qualificacao.segmento = "loja";
  }

  if (!nextContext.qualificacao.objetivo) {
    if (normalized.includes("whatsapp")) nextContext.qualificacao.objetivo = "automatizar atendimento no WhatsApp";
    else if (normalized.includes("crm")) nextContext.qualificacao.objetivo = "integrar CRM";
    else if (normalized.includes("site") || normalized.includes("chat")) nextContext.qualificacao.objetivo = "implantar agente no site";
  }

  return nextContext;
}

export function shouldRefreshSummary(messageCount: number) {
  return messageCount > 0 && messageCount % 5 === 0;
}

export async function summarizeConversation(history: ConversationMessage[], currentSummary: string | null | undefined) {
  const recent = history.slice(-8);

  if (!process.env.OPENAI_API_KEY) {
    const compact = recent
      .map((item) => `${item.role === "assistant" ? "Assistente" : "Cliente"}: ${item.content}`)
      .join(" | ")
      .slice(0, 500);

    return currentSummary ? `${currentSummary} ${compact}`.slice(0, 900) : compact;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_output_tokens: 140,
        instructions:
          "Resuma a conversa comercial em portugues de forma objetiva, destacando necessidade, segmento, dor, objecoes e proximo passo. Nao floreie.",
        input: buildInput([
          ...(currentSummary ? [{ role: "system" as const, content: `Resumo anterior: ${currentSummary}` }] : []),
          ...recent,
        ]),
      }),
    });

    const payload = (await response.json()) as { output_text?: string };
    return payload.output_text?.trim() ?? currentSummary ?? null;
  } catch (error) {
    console.error("[chat] failed to summarize conversation", error);
    return currentSummary ?? null;
  }
}
