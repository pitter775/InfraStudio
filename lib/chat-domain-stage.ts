import "server-only";

import type { ConversationDomainStage } from "@/lib/chat-intent-classifier";

export type ConversationDomainSupportState = {
  domainStage: ConversationDomainStage;
  instruction: string;
  maxOutputTokens: number;
  recentMessageWindow: number;
};

export function resolveConversationDomainSupportState(input: {
  domainStage: ConversationDomainStage;
  hasMercadoLivreContext: boolean;
  hasFocusedApiContext: boolean;
  hasLeadContext: boolean;
}) {
  const baseInstruction =
    "A resposta deve respeitar o dominio principal da conversa atual e evitar mudar de assunto sem sinal forte do cliente.";

  if (input.domainStage === "catalog_commerce") {
    return {
      domainStage: input.domainStage,
      instruction: [
        baseInstruction,
        "Dominio atual: catalogo e comercio.",
        "Priorize continuidade comercial, comparacao entre itens recentes, detalhes de produto, preco, frete e fechamento.",
        "Se houver contexto recente de catalogo, nao trate a mensagem como busca nova sem sinal forte e explicito.",
      ].join("\n"),
      maxOutputTokens: input.hasMercadoLivreContext ? 260 : 220,
      recentMessageWindow: 4,
    } satisfies ConversationDomainSupportState;
  }

  if (input.domainStage === "api_runtime") {
    return {
      domainStage: input.domainStage,
      instruction: [
        baseInstruction,
        "Dominio atual: consulta de dados e runtime de API.",
        "Priorize precisao factual, explique com clareza o que veio dos dados e nao invente informacoes ausentes.",
        "Se houver contexto de API focado, use esses dados antes de responder genericamente.",
      ].join("\n"),
      maxOutputTokens: input.hasFocusedApiContext ? 260 : 220,
      recentMessageWindow: 4,
    } satisfies ConversationDomainSupportState;
  }

  if (input.domainStage === "lead_qualification") {
    return {
      domainStage: input.domainStage,
      instruction: [
        baseInstruction,
        "Dominio atual: qualificacao de lead.",
        "Priorize perguntas curtas, progressivas e comercialmente uteis.",
        "Nao sobrecarregue o cliente com muitas perguntas na mesma resposta.",
      ].join("\n"),
      maxOutputTokens: input.hasLeadContext ? 180 : 200,
      recentMessageWindow: 3,
    } satisfies ConversationDomainSupportState;
  }

  return {
    domainStage: input.domainStage,
    instruction: [
      baseInstruction,
      "Dominio atual: conversa comercial geral.",
      "Priorize clareza, direcionamento e proximos passos objetivos.",
    ].join("\n"),
    maxOutputTokens: 220,
    recentMessageWindow: 3,
  } satisfies ConversationDomainSupportState;
}
