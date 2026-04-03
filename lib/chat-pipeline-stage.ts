import "server-only";

import { resolveConversationDomainSupportState, type ConversationDomainSupportState } from "@/lib/chat-domain-stage";
import type { ApiSemanticIntentStageResult } from "@/lib/chat-semantic-intent-stage";
import {
  classifyConversationDomainStage,
  classifyHeuristicIntentStage,
  classifyOrchestratorRouteStage,
  type ConversationDomainStage,
  type HeuristicIntentStage,
  type OrchestratorRouteStage,
} from "@/lib/chat-intent-classifier";

export type PipelineStageState = {
  heuristicIntentStage: HeuristicIntentStage;
  conversationDomainStage: ConversationDomainStage;
  orchestratorRouteStage: OrchestratorRouteStage;
  domainSupportState: ConversationDomainSupportState;
};

export function resolveConversationPipelineStageState(input: {
  leadNameAcknowledgementReply: string | null;
  hasCatalogReferenceHeuristicReply: boolean;
  hasMercadoLivreHeuristicReply: boolean;
  catalogPricingReply: string | null;
  leadIdentificationReply: string | null;
  hasValidAgent: boolean;
  hasOpenAiKey: boolean;
  hasFocusedApiContext: boolean;
  hasMercadoLivreContext: boolean;
  hasLeadContext: boolean;
  latestUserMessage?: string;
  hasMemorySummary?: boolean;
  hasCurrentCatalogContext?: boolean;
  semanticApiIntentStage?: ApiSemanticIntentStageResult | null;
}) {
  const heuristicIntentStage = classifyHeuristicIntentStage({
    leadNameAcknowledgementReply: input.leadNameAcknowledgementReply,
    hasCatalogReferenceHeuristicReply: input.hasCatalogReferenceHeuristicReply,
    hasMercadoLivreHeuristicReply: input.hasMercadoLivreHeuristicReply,
    catalogPricingReply: input.catalogPricingReply,
    leadIdentificationReply: input.leadIdentificationReply,
  });
  const conversationDomainStage = classifyConversationDomainStage({
    heuristicIntentStage,
    hasFocusedApiContext: input.hasFocusedApiContext,
    latestUserMessage: input.latestUserMessage,
    hasMemorySummary: input.hasMemorySummary,
    hasCurrentCatalogContext: input.hasCurrentCatalogContext,
    hasLeadContext: input.hasLeadContext,
    semanticApiIntentStage: input.semanticApiIntentStage,
  });
  const orchestratorRouteStage = classifyOrchestratorRouteStage({
    hasValidAgent: input.hasValidAgent,
    heuristicIntentStage,
    hasOpenAiKey: input.hasOpenAiKey,
  });
  const domainSupportState = resolveConversationDomainSupportState({
    domainStage: conversationDomainStage,
    hasMercadoLivreContext: input.hasMercadoLivreContext,
    hasFocusedApiContext: input.hasFocusedApiContext,
    hasLeadContext: input.hasLeadContext,
  });

  return {
    heuristicIntentStage,
    conversationDomainStage,
    orchestratorRouteStage,
    domainSupportState,
  } satisfies PipelineStageState;
}
