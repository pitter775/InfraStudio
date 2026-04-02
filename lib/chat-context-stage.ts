import "server-only";

import type { ApiRuntimeContext } from "@/lib/apis";
import type { CatalogProductReference, ConversationContext } from "@/lib/chat-context";
import type { AgenteRecord } from "@/lib/agentes";
import type { ChatMessageRole } from "@/lib/chats";

type ConversationMessage = {
  role: ChatMessageRole;
  content: string;
};

type RuntimeAssetLike = {
  key: string;
  id: string;
  nome: string;
  descricao: string;
  arquivoNome: string;
  mimeType: string;
  categoria: "image" | "file";
  publicUrl: string;
};

type FocusedApiContextLike = {
  instructions: string;
  fields: unknown[];
};

export type ConversationContextStageState = {
  systemPrompt: string;
  channelReplyInstruction: string;
  runtimePrompt: string;
  legacyAgentPrompt: string;
  structuredReplyInstruction: string;
  analyticalReplyInstruction: string;
  agentAssetInstruction: string;
  focusedApiContext: FocusedApiContextLike;
  scopedRecoveryReply: string;
  catalogPricingReply: string | null;
  leadIdentificationReply: string | null;
  leadNameAcknowledgementReply: string | null;
  lojaCta: string | null;
  hasFocusedApiContext: boolean;
  hasLeadContext: boolean;
  currentCatalogProduct: CatalogProductReference | null;
};

export function resolveConversationContextStageState(input: {
  agent: AgenteRecord;
  context?: ConversationContext;
  latestUserMessage: string;
  history: ConversationMessage[];
  apiContexts: ApiRuntimeContext[];
  runtimeAssets: RuntimeAssetLike[];
  hasMercadoLivreConnector: boolean;
  enableInfraStudioHeuristics: boolean;
  allowLeadGate: boolean;
  leadNameReplyDetected: boolean;
  extractedLeadName: string | null;
  currentCatalogProduct: CatalogProductReference | null;
  deps: {
    buildSystemPrompt: (agent: AgenteRecord | null, context?: ConversationContext, hasMercadoLivreConnector?: boolean) => string;
    buildChannelReplyInstruction: (context?: ConversationContext) => string;
    buildRuntimePrompt: (
      agent: AgenteRecord | null,
      latestUserMessage: string,
      context: ConversationContext | undefined,
      apiContexts: ApiRuntimeContext[],
    ) => string;
    buildLegacyAgentPrompt: (agent: AgenteRecord | null) => string;
    buildStructuredReplyInstruction: (context?: ConversationContext) => string;
    buildAnalyticalReplyInstruction: (message: string) => string;
    buildAgentAssetInstruction: (assets: RuntimeAssetLike[], latestUserMessage: string) => string;
    buildFocusedApiContext: (message: string, apiContexts: ApiRuntimeContext[]) => FocusedApiContextLike;
    buildAgentScopedRecoveryReply: (input: {
      message: string;
      context?: ConversationContext;
      agent: AgenteRecord | null;
      apiContexts: ApiRuntimeContext[];
      hasMercadoLivreConnector: boolean;
    }) => string;
    buildCatalogPricingReply: (history: ConversationMessage[], context?: ConversationContext) => string | null;
    maybeAskForLeadIdentification: (context: ConversationContext, history: ConversationMessage[], latestUserMessage: string) => string | null;
    buildLeadNameAcknowledgementReply: (
      leadName: string,
      hasMercadoLivreConnector: boolean,
      context?: ConversationContext,
    ) => string;
  };
}) {
  const systemPrompt = input.deps.buildSystemPrompt(input.agent, input.context, input.hasMercadoLivreConnector);
  const channelReplyInstruction = input.deps.buildChannelReplyInstruction(input.context);
  const runtimePrompt = input.deps.buildRuntimePrompt(input.agent, input.latestUserMessage, input.context, input.apiContexts);
  const legacyAgentPrompt = input.deps.buildLegacyAgentPrompt(input.agent);
  const structuredReplyInstruction = input.deps.buildStructuredReplyInstruction(input.context);
  const analyticalReplyInstruction = input.deps.buildAnalyticalReplyInstruction(input.latestUserMessage);
  const agentAssetInstruction = input.deps.buildAgentAssetInstruction(input.runtimeAssets, input.latestUserMessage);
  const focusedApiContext = input.deps.buildFocusedApiContext(input.latestUserMessage, input.apiContexts);
  const scopedRecoveryReply = input.deps.buildAgentScopedRecoveryReply({
    message: input.latestUserMessage,
    context: input.context,
    agent: input.agent,
    apiContexts: input.apiContexts,
    hasMercadoLivreConnector: input.hasMercadoLivreConnector,
  });
  const catalogPricingReply = input.enableInfraStudioHeuristics ? input.deps.buildCatalogPricingReply(input.history, input.context) : null;
  const leadIdentificationReply =
    input.enableInfraStudioHeuristics && input.allowLeadGate
      ? input.deps.maybeAskForLeadIdentification(input.context ?? {}, input.history, input.latestUserMessage)
      : null;
  const leadNameAcknowledgementReply = input.extractedLeadName
    ? input.deps.buildLeadNameAcknowledgementReply(input.extractedLeadName, input.hasMercadoLivreConnector, input.context)
    : null;
  const lojaCta =
    typeof input.agent.configuracoes?.cta_whatsapp === "string" && input.agent.configuracoes.cta_whatsapp.trim()
      ? input.agent.configuracoes.cta_whatsapp.trim()
      : null;

  return {
    systemPrompt,
    channelReplyInstruction,
    runtimePrompt,
    legacyAgentPrompt,
    structuredReplyInstruction,
    analyticalReplyInstruction,
    agentAssetInstruction,
    focusedApiContext,
    scopedRecoveryReply,
    catalogPricingReply,
    leadIdentificationReply,
    leadNameAcknowledgementReply,
    lojaCta,
    hasFocusedApiContext: focusedApiContext.fields.length > 0 || Boolean(focusedApiContext.instructions),
    hasLeadContext: Boolean(input.context?.lead?.identificado || input.context?.lead?.nome || input.context?.lead?.telefone),
    currentCatalogProduct: input.currentCatalogProduct,
  } satisfies ConversationContextStageState;
}
