import "server-only";

import type { CatalogFollowUpDecision } from "@/lib/catalog-follow-up";
import type { CatalogProductReference, ConversationContext } from "@/lib/chat-context";
import type { OpenAIResponsesPayload } from "@/lib/chat-openai-utils";
import { extractOpenAiOutputText } from "@/lib/chat-openai-utils";

export type SemanticIntentKind =
  | "product_interest"
  | "product_question"
  | "product_rejection"
  | "new_search"
  | "generic";

export type ApiSemanticIntentKind = "api_question" | "api_follow_up" | "generic";

export type SemanticIntentStageResult = {
  intent: SemanticIntentKind;
  confidence: number;
  reason: string;
  usedLlm: boolean;
};

export type ApiSemanticIntentStageResult = {
  intent: ApiSemanticIntentKind;
  confidence: number;
  reason: string;
  usedLlm: boolean;
};

export async function classifySemanticIntentStage(input: {
  openai: {
    apiKey: string | null;
    model: string;
  };
  message: string;
  context?: ConversationContext;
  recentProducts: CatalogProductReference[];
}): Promise<SemanticIntentStageResult | null> {
  if (!input.openai.apiKey) {
    return null;
  }

  const currentProduct = input.context?.catalogo?.produtoAtual ?? null;
  if (!currentProduct && input.recentProducts.length === 0) {
    return null;
  }

  const requestPayload = {
    model: input.openai.model,
    temperature: 0,
    max_output_tokens: 160,
    instructions: [
      "O usuario esta conversando com um assistente de vendas de produtos.",
      "A conversa pode incluir lista de produtos recem exibidos, produto em foco, linguagem informal, erros de digitacao e frases curtas.",
      "Classifique a intencao da mensagem usando apenas uma das categorias: product_interest, product_question, product_rejection, new_search, generic.",
      'Responda apenas JSON valido com: {"intent":"...","confidence":0.0,"reason":"..."}',
      "Nao responda ao usuario. Apenas classifique a intencao.",
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              message: input.message,
              context: {
                hasCurrentProduct: Boolean(currentProduct),
                currentProduct: currentProduct
                  ? {
                      id: currentProduct.id ?? null,
                      nome: currentProduct.nome ?? null,
                      descricao: currentProduct.descricao ?? null,
                      preco: currentProduct.preco ?? null,
                    }
                  : null,
                recentProducts: input.recentProducts.slice(0, 6).map((product) => ({
                  id: product.id ?? product.link ?? product.nome ?? null,
                  nome: product.nome ?? null,
                  descricao: product.descricao ?? null,
                  preco: product.preco ?? null,
                  cardIndex: product.cardIndex ?? null,
                })),
                channelKind: input.context?.channel?.kind ?? null,
                summary: input.context?.memoria?.resumo ?? null,
              },
            }),
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.openai.apiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    const payload = (await response.json()) as OpenAIResponsesPayload;
    const outputText = extractOpenAiOutputText(payload);
    if (!response.ok || !outputText) {
      return null;
    }

    const parsed = JSON.parse(outputText) as {
      intent?: SemanticIntentKind;
      confidence?: number;
      reason?: string;
    };

    if (
      parsed.intent !== "product_interest" &&
      parsed.intent !== "product_question" &&
      parsed.intent !== "product_rejection" &&
      parsed.intent !== "new_search" &&
      parsed.intent !== "generic"
    ) {
      return null;
    }

    return {
      intent: parsed.intent,
      confidence:
        typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.7,
      reason: typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim() : "Classificacao semantica da intencao.",
      usedLlm: true,
    };
  } catch {
    return null;
  }
}

export async function classifySemanticApiIntentStage(input: {
  openai: {
    apiKey: string | null;
    model: string;
  };
  message: string;
  context?: ConversationContext;
  focusedApiContextInstructions: string;
}): Promise<ApiSemanticIntentStageResult | null> {
  if (!input.openai.apiKey || !input.focusedApiContextInstructions.trim()) {
    return null;
  }

  const requestPayload = {
    model: input.openai.model,
    temperature: 0,
    max_output_tokens: 160,
    instructions: [
      "O usuario esta conversando com um assistente que possui contexto estruturado vindo de APIs.",
      "A mensagem pode ser uma pergunta factual, uma continuidade curta sobre a mesma consulta, ou algo generico fora do contexto atual.",
      "Classifique a intencao usando apenas uma das categorias: api_question, api_follow_up, generic.",
      'Responda apenas JSON valido com: {"intent":"...","confidence":0.0,"reason":"..."}',
      "Nao responda ao usuario. Apenas classifique a intencao.",
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              message: input.message,
              context: {
                channelKind: input.context?.channel?.kind ?? null,
                summary: input.context?.memoria?.resumo ?? null,
                focusedApiContextInstructions: input.focusedApiContextInstructions,
              },
            }),
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.openai.apiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    const payload = (await response.json()) as OpenAIResponsesPayload;
    const outputText = extractOpenAiOutputText(payload);
    if (!response.ok || !outputText) {
      return null;
    }

    const parsed = JSON.parse(outputText) as {
      intent?: ApiSemanticIntentKind;
      confidence?: number;
      reason?: string;
    };

    if (parsed.intent !== "api_question" && parsed.intent !== "api_follow_up" && parsed.intent !== "generic") {
      return null;
    }

    return {
      intent: parsed.intent,
      confidence:
        typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.7,
      reason: typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim() : "Classificacao semantica da intencao de API.",
      usedLlm: true,
    };
  } catch {
    return null;
  }
}

export function buildCatalogDecisionFromSemanticIntent(input: {
  semanticIntent: SemanticIntentStageResult | null;
  context?: ConversationContext;
  recentProducts: CatalogProductReference[];
}): CatalogFollowUpDecision | null {
  if (!input.semanticIntent) {
    return null;
  }

  const currentProduct = input.context?.catalogo?.produtoAtual ?? null;
  const productInFocus = currentProduct ?? (input.recentProducts.length === 1 ? input.recentProducts[0] ?? null : null);

  if (input.semanticIntent.intent === "product_interest" || input.semanticIntent.intent === "product_question") {
    if (!productInFocus) {
      return null;
    }

    return {
      kind: "recent_product_reference",
      confidence: input.semanticIntent.confidence,
      reason: input.semanticIntent.reason,
      matchedProducts: [productInFocus],
      usedLlm: input.semanticIntent.usedLlm,
      shouldBlockNewSearch: true,
    };
  }

  if (input.semanticIntent.intent === "product_rejection") {
    return {
      kind: input.recentProducts.length > 0 ? "load_more_results" : "new_product_search",
      confidence: input.semanticIntent.confidence,
      reason: input.semanticIntent.reason,
      matchedProducts: currentProduct ? [currentProduct] : [],
      usedLlm: input.semanticIntent.usedLlm,
      shouldBlockNewSearch: input.recentProducts.length > 0,
    };
  }

  if (input.semanticIntent.intent === "new_search") {
    return {
      kind: "new_product_search",
      confidence: input.semanticIntent.confidence,
      reason: input.semanticIntent.reason,
      matchedProducts: [],
      usedLlm: input.semanticIntent.usedLlm,
      shouldBlockNewSearch: false,
    };
  }

  return {
    kind: "non_catalog_message",
    confidence: input.semanticIntent.confidence,
    reason: input.semanticIntent.reason,
    matchedProducts: [],
    usedLlm: input.semanticIntent.usedLlm,
    shouldBlockNewSearch: true,
  };
}
