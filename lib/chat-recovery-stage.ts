import { API_RUNTIME_FACTUAL_SIGNALS, buildApiFallbackReply } from "@/lib/chat-api-runtime";
import type { ConversationContext } from "@/lib/chat-context";
import { formatHeuristicReply } from "@/lib/chat-prompt-builders";
import { extractName as extractNameFromModule, extractPhone as extractPhoneFromModule } from "@/lib/chat-contact-utils";
import { buildSearchTokens, isWhatsAppChannel, normalizeText, singularizeToken } from "@/lib/chat-text-utils";
import { normalizeAgentRuntimeConfig } from "@/lib/agent-runtime";
import type { AgenteRecord } from "@/lib/agentes";
import type { ApiRuntimeContext } from "@/lib/apis";

function isShortFollowUp(message: string) {
  const compact = normalizeText(message).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!compact) {
    return false;
  }

  const words = compact.split(" ").filter(Boolean);
  return compact.length <= 24 && words.length <= 4;
}

function buildWhatsAppHeuristicReply(message: string, context?: ConversationContext) {
  const normalized = normalizeText(message);
  const objective = normalizeText(context?.qualificacao?.objetivo ?? "");

  if (/\bagenda\b|agendamento|calendario/.test(normalized)) {
    return ["Consigo te ajudar com agenda sim.", "Voce quer automatizar agendamento, confirmacao ou lembrete?"].join("\n\n");
  }

  if (/\bsite\b|\bchat\b/.test(normalized)) {
    return [
      "Da para colocar um agente no seu site e conectar com o comercial.",
      "Voce quer captar leads, tirar duvidas ou agendar atendimento?",
    ].join("\n\n");
  }

  if (/\bwhatsapp\b|\batendimento\b/.test(normalized)) {
    return [
      "Da para automatizar o atendimento no WhatsApp sem perder o toque humano.",
      "Hoje voce quer focar em captacao, qualificacao ou suporte?",
    ].join("\n\n");
  }

  if (/\bcrm\b|\berp\b|integrac/.test(normalized)) {
    return ["Consigo integrar isso com CRM e outras ferramentas.", "Qual sistema voce usa hoje?"].join("\n\n");
  }

  if (/\bvendas?\b|comercial|lead/.test(normalized)) {
    return [
      "Boa. Da para organizar melhor entrada, qualificacao e repasse dos leads.",
      "Seu gargalo hoje esta em captar, responder ou fechar?",
    ].join("\n\n");
  }

  if (isShortFollowUp(message) && objective.includes("agenda")) {
    return [
      "Fechado. Em agenda, o melhor fluxo depende do seu caso.",
      "Voce quer marcar horario, confirmar consultas ou mandar lembretes?",
    ].join("\n\n");
  }

  return ["Consigo te orientar por aqui.", "Me diz em uma frase o que voce quer automatizar hoje."].join("\n\n");
}

export function heuristicReply(message: string, context?: ConversationContext) {
  if (isWhatsAppChannel(context)) {
    return buildWhatsAppHeuristicReply(message, context);
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("whatsapp") || normalized.includes("atendimento")) {
    return [
      "âœ“ **Fluxo recomendado**",
      "A InfraStudio monta fluxos de WhatsApp para captar, qualificar e responder clientes com muito menos trabalho manual.",
      "",
      "â†’ Me diga seu segmento e eu ja te proponho um fluxo inicial.",
    ].join("\n");
  }

  if (normalized.includes("crm") || normalized.includes("erp") || normalized.includes("integra")) {
    return [
      "âœ“ **Isso encaixa bem em integracao**",
      "A gente costuma integrar CRM, ERP, formularios, pagamentos e atendimento para eliminar retrabalho e centralizar dados.",
      "",
      "â†’ Se quiser, me diga qual ferramenta voce usa hoje.",
    ].join("\n");
  }

  if (normalized.includes("site") || normalized.includes("chat")) {
    return [
      "âœ“ **Isso encaixa bem**",
      "Da para colocar um agente no seu site para captar leads, responder duvidas e encaminhar oportunidades para o WhatsApp do time comercial.",
    ].join("\n");
  }

  if (normalized.includes("preco") || normalized.includes("orcamento") || normalized.includes("valor")) {
    return ["âœ“ **Para estimar melhor**", "Me diga em uma frase:", "- o que voce quer automatizar", "- qual etapa hoje mais trava o fechamento"].join("\n");
  }

  return [
    "âœ“ **Posso te orientar por aqui**",
    "Me conta qual processo voce quer automatizar hoje.",
    "",
    "Se ajudar, pode me dizer se isso envolve:",
    "- site",
    "- WhatsApp",
    "- vendas",
    "- agenda",
    "- integracoes",
  ].join("\n");
}

export function buildNeutralGlobalFallbackReply(agent: AgenteRecord | null, context?: ConversationContext) {
  const objective =
    normalizeAgentRuntimeConfig(agent?.configuracoes?.runtime)?.overview.objetivo?.trim() ||
    context?.qualificacao?.objetivo?.trim() ||
    agent?.descricao?.trim() ||
    context?.projeto?.nome?.trim() ||
    "este atendimento";

  return [`Sigo por aqui no contexto de ${agent?.nome ?? "atendimento"}.`, `Me diga o ponto exato que voce quer validar em ${objective}.`].join("\n\n");
}

export function buildMercadoLivreFocusedFallbackReply(agent: AgenteRecord | null) {
  return [
    `Sigo por aqui no contexto de ${agent?.nome ?? "atendimento"}.`,
    "Como este agente esta focado na loja do Mercado Livre, me diga o produto, modelo, marca, cor ou SKU que voce quer buscar.",
  ].join("\n\n");
}

export function isInfraStudioFirstPartyContext(context?: ConversationContext) {
  const channelKind = normalizeText(context?.channel?.kind ?? "");
  if (channelKind === "admin_agent_test") {
    return false;
  }

  const projetoSlug = normalizeText(context?.projeto?.slug ?? "");
  const projetoNome = normalizeText(context?.projeto?.nome ?? "");
  return projetoSlug === "infrastudio" || projetoNome === "infrastudio";
}

export function buildAgentScopedRecoveryReply(input: {
  message: string;
  context?: ConversationContext;
  agent: AgenteRecord | null;
  apiContexts: ApiRuntimeContext[];
  hasMercadoLivreConnector: boolean;
}) {
  const firstPartyFallback = isInfraStudioFirstPartyContext(input.context) ? heuristicReply(input.message, input.context) : null;
  if (firstPartyFallback?.trim()) {
    return formatHeuristicReply(firstPartyFallback, input.context);
  }

  const runtime = normalizeAgentRuntimeConfig(input.agent?.configuracoes?.runtime);
  const objective =
    runtime?.overview.objetivo?.trim() ||
    input.context?.qualificacao?.objetivo?.trim() ||
    input.agent?.descricao?.trim() ||
    input.context?.projeto?.nome?.trim() ||
    "este atendimento";

  if (isWhatsAppChannel(input.context)) {
    const baseReply = [
      `Sigo por aqui no contexto de ${input.agent?.nome ?? "atendimento"}.`,
      `Me diga o ponto exato que voce quer validar em ${objective}: risco, valor, status, documentos ou detalhes.`,
    ].join("\n\n");

    const apiReply = /codigo|status|consulta|buscar|verifica|api|integr/i.test(normalizeText(input.message))
      ? buildApiFallbackReply(input.message, input.apiContexts, {
          normalizeText,
          buildSearchTokens,
          singularizeToken,
        })
      : null;

    return apiReply ? formatHeuristicReply(apiReply, input.context) : baseReply;
  }

  const neutralFallbackReply = buildNeutralGlobalFallbackReply(input.agent, input.context);
  const mercadoLivreFallbackReply = input.hasMercadoLivreConnector ? buildMercadoLivreFocusedFallbackReply(input.agent) : neutralFallbackReply;
  const baseReply = isInfraStudioFirstPartyContext(input.context)
    ? [
        `Sigo por aqui no contexto de ${input.agent?.nome ?? "atendimento"}.`,
        `Me diga o ponto exato que voce quer validar em ${objective}: risco, valor, status, documentos ou detalhes.`,
      ].join("\n\n")
    : mercadoLivreFallbackReply;

  const apiReply = /codigo|status|consulta|buscar|verifica|api|integr/i.test(normalizeText(input.message))
    ? buildApiFallbackReply(input.message, input.apiContexts, {
        normalizeText,
        buildSearchTokens,
        singularizeToken,
      })
    : null;

  return apiReply ? formatHeuristicReply(apiReply, input.context) : baseReply;
}

export function extractPhone(message: string) {
  return extractPhoneFromModule(message);
}

export function extractName(message: string) {
  return extractNameFromModule(message, normalizeText);
}


