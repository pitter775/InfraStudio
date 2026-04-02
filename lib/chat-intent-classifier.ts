import "server-only";

import { API_RUNTIME_FACTUAL_SIGNALS } from "@/lib/chat-api-runtime";
import { normalizeText } from "@/lib/chat-text-utils";

export type HeuristicIntentStage =
  | "lead_name_acknowledgement"
  | "catalog_reference"
  | "mercado_livre"
  | "catalog_pricing"
  | "lead_identification"
  | "none";

export type OrchestratorRouteStage =
  | "inactive_or_invalid_agent"
  | HeuristicIntentStage
  | "guardrail_no_openai"
  | "openai";

export type ConversationDomainStage =
  | "catalog_commerce"
  | "api_runtime"
  | "lead_qualification"
  | "general_sales";

export function classifyHeuristicIntentStage(input: {
  leadNameAcknowledgementReply: string | null;
  hasCatalogReferenceHeuristicReply: boolean;
  hasMercadoLivreHeuristicReply: boolean;
  catalogPricingReply: string | null;
  leadIdentificationReply: string | null;
}) {
  if (input.leadNameAcknowledgementReply) {
    return "lead_name_acknowledgement" satisfies HeuristicIntentStage;
  }

  if (input.hasCatalogReferenceHeuristicReply) {
    return "catalog_reference" satisfies HeuristicIntentStage;
  }

  if (input.hasMercadoLivreHeuristicReply) {
    return "mercado_livre" satisfies HeuristicIntentStage;
  }

  if (input.catalogPricingReply) {
    return "catalog_pricing" satisfies HeuristicIntentStage;
  }

  if (input.leadIdentificationReply) {
    return "lead_identification" satisfies HeuristicIntentStage;
  }

  return "none" satisfies HeuristicIntentStage;
}

export function classifyOrchestratorRouteStage(input: {
  hasValidAgent: boolean;
  heuristicIntentStage: HeuristicIntentStage;
  hasOpenAiKey: boolean;
}) {
  if (!input.hasValidAgent) {
    return "inactive_or_invalid_agent" satisfies OrchestratorRouteStage;
  }

  if (input.heuristicIntentStage !== "none") {
    return input.heuristicIntentStage satisfies OrchestratorRouteStage;
  }

  if (!input.hasOpenAiKey) {
    return "guardrail_no_openai" satisfies OrchestratorRouteStage;
  }

  return "openai" satisfies OrchestratorRouteStage;
}

export function classifyConversationDomainStage(input: {
  heuristicIntentStage: HeuristicIntentStage;
  hasFocusedApiContext: boolean;
  latestUserMessage?: string;
  hasMemorySummary?: boolean;
  hasCurrentCatalogContext?: boolean;
  hasLeadContext?: boolean;
}) {
  const normalizedMessage = normalizeText(input.latestUserMessage ?? "");
  const continuationLikeMessage = isContinuationLikeMessage(normalizedMessage);
  const apiLikeMessage = API_RUNTIME_FACTUAL_SIGNALS.some((signal) => normalizedMessage.includes(signal)) || /\b(api|consulta|consultar|status|codigo|dados|campo)\b/.test(normalizedMessage);

  if (
    input.heuristicIntentStage === "catalog_reference" ||
    input.heuristicIntentStage === "mercado_livre" ||
    input.heuristicIntentStage === "catalog_pricing"
  ) {
    return "catalog_commerce" satisfies ConversationDomainStage;
  }

  if (input.hasCurrentCatalogContext && continuationLikeMessage) {
    return "catalog_commerce" satisfies ConversationDomainStage;
  }

  if (input.heuristicIntentStage === "lead_name_acknowledgement" || input.heuristicIntentStage === "lead_identification") {
    return "lead_qualification" satisfies ConversationDomainStage;
  }

  if (input.hasMemorySummary && input.hasLeadContext && continuationLikeMessage) {
    return "lead_qualification" satisfies ConversationDomainStage;
  }

  if (input.hasFocusedApiContext && apiLikeMessage) {
    return "api_runtime" satisfies ConversationDomainStage;
  }

  if (input.hasFocusedApiContext) {
    return "api_runtime" satisfies ConversationDomainStage;
  }

  return "general_sales" satisfies ConversationDomainStage;
}
function isContinuationLikeMessage(message: string) {
  if (!message) {
    return false;
  }

  const compact = message.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const words = compact.split(" ").filter(Boolean);
  const continuationSignals = new Set([
    "oi",
    "ola",
    "ok",
    "sim",
    "quero",
    "esse",
    "essa",
    "desse",
    "dessa",
    "dele",
    "dela",
    "gostei",
    "manda",
    "link",
    "detalhes",
    "garantia",
  ]);

  return compact.length <= 24 && words.length <= 4 && words.some((word) => continuationSignals.has(word));
}
