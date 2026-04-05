import "server-only";

import type { AgenteAssetRecord } from "@/lib/agente-assets";
import { getAgenteById, type AgenteRecord } from "@/lib/agentes";
import { buildAgenteApiRuntimeContext } from "@/lib/apis";
import { API_RUNTIME_FACTUAL_SIGNALS, buildApiFallbackReply, buildFocusedApiContext } from "@/lib/chat-api-runtime";
import { getChatChannelPolicy } from "@/lib/chat-channel-policy";
import {
  isMercadoLivreDetailIntent,
  isMercadoLivrePurchaseIntent,
  resolveMercadoLivreFlowState,
  resolveMercadoLivreHeuristicReply,
  resolveMercadoLivreHeuristicState,
  resolveMercadoLivreSearch,
} from "@/lib/chat-mercado-livre";
import {
  decideCatalogFollowUpHeuristically,
  hasRecentCatalogSnapshot,
  isCatalogLoadMoreIntent,
  isRecentCatalogReferenceAttempt,
  normalizeRecentCatalogProducts,
  resolveCatalogReferenceHeuristicReply,
  resolveRecentCatalogProductReference,
  type CatalogFollowUpDecision,
} from "@/lib/catalog-follow-up";
import type { CatalogProductReference, ConversationContext } from "@/lib/chat-context";
import { resolveConversationContextStageState } from "@/lib/chat-context-stage";
import type { ConversationDomainSupportState } from "@/lib/chat-domain-stage";
import { classifyOrchestratorRouteStage } from "@/lib/chat-intent-classifier";
import type { ConversationDomainStage, HeuristicIntentStage } from "@/lib/chat-intent-classifier";
import { buildOpenAiStageRequestPayload } from "@/lib/chat-openai-stage";
import { extractOpenAiOutputText, type OpenAIResponsesPayload } from "@/lib/chat-openai-utils";
import { resolveConversationPipelineStageState } from "@/lib/chat-pipeline-stage";
import {
  buildCatalogDecisionFromSemanticIntent,
  classifySemanticApiIntentStage,
  classifySemanticIntentStage,
  shouldBypassCatalogHeuristicFallback,
  type SemanticIntentStageResult,
} from "@/lib/chat-semantic-intent-stage";
import {
  buildAgentAssetInstruction as buildAgentAssetInstructionFromModule,
  buildAnalyticalReplyInstruction as buildAnalyticalReplyInstructionFromModule,
  buildChannelReplyInstruction as buildChannelReplyInstructionFromModule,
  buildLegacyAgentPrompt as buildLegacyAgentPromptFromModule,
  buildRuntimePrompt as buildRuntimePromptFromModule,
  buildStructuredReplyInstruction as buildStructuredReplyInstructionFromModule,
  buildSystemPrompt as buildSystemPromptFromModule,
  extractTaggedAssets as extractTaggedAssetsFromModule,
  formatHeuristicReply as formatHeuristicReplyFromModule,
  prefersStructuredReply as prefersStructuredReplyFromModule,
} from "@/lib/chat-prompt-builders";
import {
  buildCatalogPricingReply as buildCatalogPricingReplyFromModule,
  buildProductSearchCandidates as buildProductSearchCandidatesFromModule,
  isGreetingOrAckMessage as isGreetingOrAckMessageFromModule,
  isMercadoLivreListingIntent as isMercadoLivreListingIntentFromModule,
  isOutOfScopeForCatalog as isOutOfScopeForCatalogFromModule,
  maybeAskForLeadIdentification as maybeAskForLeadIdentificationFromModule,
  shouldContinueProductSearch as shouldContinueProductSearchFromModule,
  shouldSearchProducts as shouldSearchProductsFromModule,
  shouldUseMercadoLivreConnectorFallback as shouldUseMercadoLivreConnectorFallbackFromModule,
} from "@/lib/chat-sales-heuristics";
import {
  buildAgentScopedRecoveryReply as buildAgentScopedRecoveryReplyFromModule,
  extractName as extractNameFromRecoveryModule,
  extractPhone as extractPhoneFromRecoveryModule,
  heuristicReply as heuristicReplyFromModule,
  isInfraStudioFirstPartyContext as isInfraStudioFirstPartyContextFromModule,
} from "@/lib/chat-recovery-stage";
import {
  buildLeadNameAcknowledgementReply as buildLeadNameAcknowledgementReplyFromModule,
  enrichLeadContext as enrichLeadContextFromModule,
  extractName as extractNameFromModule,
  isLikelyLeadNameReply as isLikelyLeadNameReplyFromModule,
} from "@/lib/chat-lead-stage";
export { shouldRefreshSummary, summarizeConversation } from "@/lib/chat-summary-stage";
import { getPlanoProjeto, type BillingProjectPlan } from "@/lib/billing";
import { listConectoresByAgente, MERCADO_LIVRE_CONNECTOR_TYPE } from "@/lib/conectores";
import {
  type ProdutoDetalhadoMercadoLivre,
  type ProdutoPadronizado,
} from "@/lib/mercado-livre";
import { appendRuntimeErrorLog } from "@/lib/runtime-error-log";
import { getProjetoOpenAIConfig } from "@/lib/segredos";
import { buildSearchTokens, isWhatsAppChannel, normalizeText, singularizeToken } from "@/lib/chat-text-utils";
import type { ChatMessageRole } from "@/lib/chats";

type ConversationMessage = {
  role: ChatMessageRole;
  content: string;
};

type ReplyAsset = {
  id: string;
  nome: string;
  descricao: string;
  arquivoNome: string;
  mimeType: string;
  categoria: "image" | "file";
  publicUrl: string;
  targetUrl?: string | null;
  whatsappText?: string | null;
};

type RuntimeReplyAsset = ReplyAsset & {
  key: string;
};

type SalesReplyMetadata = {
  provider: string;
  model: string;
  agenteId: string | null;
  agenteNome: string | null;
  billingControl?: {
    status: "ativo" | "bloqueado";
    limiteTokens: number | null;
    tokensConsumidos: number;
    alerta80: boolean;
    alerta100: boolean;
    bloqueado: boolean;
    permitirExcedente: boolean;
    excedenteTokens: number;
    excedenteCusto: number;
  } | null;
  routeStage?: string | null;
  heuristicStage?: HeuristicIntentStage | null;
  domainStage?: ConversationDomainStage | null;
  catalogoProdutoAtual?: CatalogProductReference | null;
  debugRequest?: {
    domainStage?: ConversationDomainStage;
    hasSummary: boolean;
    hasRuntimePrompt: boolean;
    allowIcons: boolean;
    structuredResponse: boolean;
    historyLength: number;
    recentMessageWindow?: number;
    maxOutputTokens?: number;
    requestPayload: unknown;
  };
};

type SalesReplyResult = {
  reply: string;
  assets: ReplyAsset[];
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  metadata: SalesReplyMetadata;
};

type HeuristicPipelineState = {
  openai: Awaited<ReturnType<typeof getProjetoOpenAIConfig>>;
  recentCatalogProducts: CatalogProductReference[];
  semanticIntentStage: SemanticIntentStageResult | null;
  catalogFollowUpHeuristicDecision: CatalogFollowUpDecision | null;
  catalogFollowUpDecision: CatalogFollowUpDecision | null;
  loadMoreCatalogRequested: boolean;
  genericMercadoLivreListingRequested: boolean;
  productSearchRequested: boolean;
  productSearchCandidates: string[];
  productSearchTerm: string;
  referencedCatalogProducts: CatalogProductReference[];
  currentCatalogProduct: CatalogProductReference | null;
};

type TraceBase = {
  projetoId: string | null;
  agenteId: string | null;
  payload: {
    lockedToAgent: boolean;
    resolvedAgentId: string | null;
    resolvedAgentProjetoId: string | null;
    resolvedAgentAtivo: boolean | null;
    channelKind: string | null | undefined;
    latestUserMessage: string;
  };
};

function buildRuntimeReplyAssets(assets: AgenteAssetRecord[]) {
  return assets.slice(0, 12).map((asset, index) => ({
    key: `asset_${index + 1}`,
    id: asset.id,
    nome: asset.nome,
    descricao: asset.descricao,
    arquivoNome: asset.arquivoNome,
    mimeType: asset.mimeType,
    categoria: asset.categoria,
    publicUrl: asset.publicUrl,
  }));
}

async function buildHeuristicPipelineState(input: {
  projectId: string | null;
  latestUserMessage: string;
  history: ConversationMessage[];
  context?: ConversationContext;
  hasMercadoLivreConnector: boolean;
  leadNameReplyDetected: boolean;
}) {
  const recentCatalogProducts = normalizeRecentCatalogProducts(input.context);
  const openai = await getProjetoOpenAIConfig(input.projectId);
  const isGreetingOrAckMessage = (message: string) => isGreetingOrAckMessageFromModule(message, { normalizeText });
  const buildProductSearchCandidates = (message: string) =>
    buildProductSearchCandidatesFromModule(message, { normalizeText, isGreetingOrAckMessage });
  const shouldSearchProducts = (message: string) => shouldSearchProductsFromModule(message, { normalizeText });
  const semanticIntentStage =
    input.hasMercadoLivreConnector &&
    !input.leadNameReplyDetected &&
    (hasRecentCatalogSnapshot(input.context) || Boolean(input.context?.catalogo?.produtoAtual))
      ? await classifySemanticIntentStage({
          openai,
          message: input.latestUserMessage,
          context: input.context,
          recentProducts: recentCatalogProducts,
        })
      : null;
  const semanticCatalogDecision = buildCatalogDecisionFromSemanticIntent({
    semanticIntent: semanticIntentStage,
    context: input.context,
    recentProducts: recentCatalogProducts,
  });
  const fallbackCatalogDecision =
    input.hasMercadoLivreConnector &&
    !input.leadNameReplyDetected &&
    !shouldBypassCatalogHeuristicFallback({
      semanticIntent: semanticIntentStage,
      context: input.context,
    })
      ? decideCatalogFollowUpHeuristically(input.latestUserMessage, input.context, {
          buildProductSearchCandidates,
          shouldSearchProducts,
          isMercadoLivrePurchaseIntent: (message) => isMercadoLivrePurchaseIntent(message, { normalizeText, isWhatsAppChannel }),
          isMercadoLivreDetailIntent: (message) => isMercadoLivreDetailIntent(message, { normalizeText, isWhatsAppChannel }),
        })
      : null;
  const catalogFollowUpHeuristicDecision = semanticCatalogDecision ?? fallbackCatalogDecision;
  const catalogFollowUpDecision =
    catalogFollowUpHeuristicDecision?.kind === "recent_product_reference_ambiguous"
      ? catalogFollowUpHeuristicDecision
      : catalogFollowUpHeuristicDecision;
  const flowState = resolveMercadoLivreFlowState({
    latestUserMessage: input.latestUserMessage,
    context: input.context,
    hasMercadoLivreConnector: input.hasMercadoLivreConnector,
    leadNameReplyDetected: input.leadNameReplyDetected,
    recentCatalogProducts,
    catalogFollowUpDecision: catalogFollowUpDecision ?? null,
    detectProductSearch: () =>
      shouldContinueProductSearchFromModule(input.history, input.latestUserMessage, input.context, {
        normalizeText,
        isGreetingOrAckMessage,
        shouldSearchProducts,
        buildProductSearchCandidates,
      }),
    buildProductSearchCandidates,
    resolveRecentCatalogProductReference,
    isRecentCatalogReferenceAttempt,
    isMercadoLivreListingIntent: (message) => isMercadoLivreListingIntentFromModule(message, { normalizeText }),
    shouldUseMercadoLivreConnectorFallback: () =>
      shouldUseMercadoLivreConnectorFallbackFromModule(input.history, input.latestUserMessage, input.context, {
        normalizeText,
        isGreetingOrAckMessage,
        buildProductSearchCandidates,
        shouldSearchProducts,
        isLikelyLeadNameReply: (message, history, deps) =>
          isLikelyLeadNameReplyFromModule(message, history as ConversationMessage[], deps),
        extractName: (message) => extractNameFromModule(message, normalizeText),
      }),
  });

  return {
    openai,
    recentCatalogProducts,
    semanticIntentStage,
    catalogFollowUpHeuristicDecision,
    catalogFollowUpDecision,
    ...flowState,
  } satisfies HeuristicPipelineState;
}

function buildZeroUsageReply(
  reply: string,
  assets: ReplyAsset[],
  metadata: SalesReplyResult["metadata"],
): SalesReplyResult {
  return {
    reply,
    assets,
    usage: { inputTokens: 0, outputTokens: 0 },
    metadata,
  };
}

function buildBillingControlMetadata(current: BillingProjectPlan | null): SalesReplyMetadata["billingControl"] {
  if (!current) {
    return null;
  }

  return {
    status: current.cicloAtual?.bloqueado || current.plano.bloqueado ? "bloqueado" : "ativo",
    limiteTokens: current.cicloAtual?.limiteTokensTotal ?? current.plano.limiteTokensTotalMensal,
    tokensConsumidos: current.consumoAtual.totalTokens,
    alerta80: current.cicloAtual?.alerta80 === true,
    alerta100: current.cicloAtual?.alerta100 === true,
    bloqueado: current.cicloAtual?.bloqueado === true || current.plano.bloqueado,
    permitirExcedente: current.cicloAtual?.permitirExcedente === true || current.plano.permitirExcedente,
    excedenteTokens: current.cicloAtual?.excedenteTokens ?? 0,
    excedenteCusto: current.cicloAtual?.excedenteCusto ?? 0,
  };
}

function withBillingControl(result: SalesReplyResult, current: BillingProjectPlan | null): SalesReplyResult {
  return {
    ...result,
    metadata: {
      ...result.metadata,
      billingControl: buildBillingControlMetadata(current),
    },
  };
}

async function resolveHeuristicStageReply(input: {
  heuristicIntentStage: HeuristicIntentStage;
  conversationDomainStage: ConversationDomainStage;
  leadNameAcknowledgementReply: string | null;
  extractedLeadName: string | null;
  catalogReferenceHeuristicReply: ReturnType<typeof resolveCatalogReferenceHeuristicReply>;
  mercadoLivreHeuristicReply: ReturnType<typeof resolveMercadoLivreHeuristicReply>;
  catalogPricingReply: string | null;
  leadIdentificationReply: string | null;
  context?: ConversationContext;
  traceBase: TraceBase;
  resourceTrace: Record<string, unknown>;
  agentId: string | null;
  agentName: string | null;
}) {
  if (input.heuristicIntentStage === "lead_name_acknowledgement" && input.leadNameAcknowledgementReply) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Nome do lead reconhecido e confirmado antes de outras heuristicas.",
      ...input.traceBase,
      payload: {
        ...input.traceBase.payload,
        ...input.resourceTrace,
        mode: "lead_name_acknowledgement",
        extractedLeadName: input.extractedLeadName,
      },
    });
    return buildZeroUsageReply(formatHeuristicReplyFromModule(input.leadNameAcknowledgementReply, input.context), [], {
      provider: "heuristic",
      model: "lead_name_acknowledgement",
      agenteId: input.agentId,
      agenteNome: input.agentName,
      routeStage: "heuristic",
      heuristicStage: input.heuristicIntentStage,
      domainStage: input.conversationDomainStage,
    });
  }

  if (input.heuristicIntentStage === "catalog_reference" && input.catalogReferenceHeuristicReply) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: input.catalogReferenceHeuristicReply.logMessage,
      ...input.traceBase,
      payload: {
        ...input.traceBase.payload,
        ...input.resourceTrace,
        mode: input.catalogReferenceHeuristicReply.mode,
        ...input.catalogReferenceHeuristicReply.tracePayload,
      },
    });
    return buildZeroUsageReply(
      input.catalogReferenceHeuristicReply.reply,
      input.catalogReferenceHeuristicReply.assets,
      {
        ...input.catalogReferenceHeuristicReply.metadata,
        routeStage: "heuristic",
        heuristicStage: input.heuristicIntentStage,
        domainStage: input.conversationDomainStage,
      },
    );
  }

  if (input.heuristicIntentStage === "mercado_livre" && input.mercadoLivreHeuristicReply) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: input.mercadoLivreHeuristicReply.logMessage,
      ...input.traceBase,
      payload: {
        ...input.traceBase.payload,
        ...input.resourceTrace,
        mode: input.mercadoLivreHeuristicReply.mode,
        ...input.mercadoLivreHeuristicReply.tracePayload,
      },
    });
    return buildZeroUsageReply(
      input.mercadoLivreHeuristicReply.reply,
      input.mercadoLivreHeuristicReply.assets,
      {
        ...input.mercadoLivreHeuristicReply.metadata,
        routeStage: "heuristic",
        heuristicStage: input.heuristicIntentStage,
        domainStage: input.conversationDomainStage,
      },
    );
  }

  if (input.heuristicIntentStage === "catalog_pricing" && input.catalogPricingReply) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Resposta heuristica de precificacao do catalogo acionada.",
      ...input.traceBase,
      payload: { ...input.traceBase.payload, ...input.resourceTrace, mode: "catalog_pricing" },
    });
    return buildZeroUsageReply(formatHeuristicReplyFromModule(input.catalogPricingReply, input.context), [], {
      provider: "heuristic",
      model: "catalog_pricing",
      agenteId: input.agentId,
      agenteNome: input.agentName,
      routeStage: "heuristic",
      heuristicStage: input.heuristicIntentStage,
      domainStage: input.conversationDomainStage,
    });
  }

  if (input.heuristicIntentStage === "lead_identification" && input.leadIdentificationReply) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Resposta heuristica para identificar nome do lead acionada.",
      ...input.traceBase,
      payload: { ...input.traceBase.payload, ...input.resourceTrace, mode: "lead_identification" },
    });
    return buildZeroUsageReply(formatHeuristicReplyFromModule(input.leadIdentificationReply, input.context), [], {
      provider: "heuristic",
      model: "lead_identification",
      agenteId: input.agentId,
      agenteNome: input.agentName,
      routeStage: "heuristic",
      heuristicStage: input.heuristicIntentStage,
      domainStage: input.conversationDomainStage,
    });
  }

  return null;
}

async function resolveOpenAiStageReply(input: {
  openai: Awaited<ReturnType<typeof getProjetoOpenAIConfig>>;
  context?: ConversationContext;
  history: ConversationMessage[];
  domainSupportState: ConversationDomainSupportState;
  runtimePrompt: string;
  systemPrompt: string;
  channelReplyInstruction: string;
  legacyAgentPrompt: string;
  structuredReplyInstruction: string;
  analyticalReplyInstruction: string;
  agentAssetInstruction: string;
  focusedApiContextInstructions: string;
  mercadoLivrePromptContext: string;
  mercadoLivreDetailPromptContext: string;
  runtimeAssets: RuntimeReplyAsset[];
  traceBase: TraceBase;
  resourceTrace: Record<string, unknown>;
  scopedRecoveryReply: string;
  apiFallbackReply?: string | null;
  agentId: string | null;
  agentName: string | null;
}) {
  try {
    const { hasSummary, recentMessageWindow, requestPayload } = buildOpenAiStageRequestPayload({
      model: input.openai.model,
      context: input.context,
      history: input.history,
      domainSupportState: input.domainSupportState,
      systemPrompt: input.systemPrompt,
      channelReplyInstruction: input.channelReplyInstruction,
      runtimePrompt: input.runtimePrompt,
      legacyAgentPrompt: input.legacyAgentPrompt,
      structuredReplyInstruction: input.structuredReplyInstruction,
      analyticalReplyInstruction: input.analyticalReplyInstruction,
      agentAssetInstruction: input.agentAssetInstruction,
      focusedApiContextInstructions: input.focusedApiContextInstructions,
      mercadoLivrePromptContext: input.mercadoLivrePromptContext,
      mercadoLivreDetailPromptContext: input.mercadoLivreDetailPromptContext,
    });

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
      console.error("[chat] openai response failed", payload.error?.message ?? payload);
      await appendRuntimeErrorLog({
        source: "chat_orchestrator.guardrail",
        message: "OpenAI retornou erro. Resposta bloqueada por fail-closed.",
        ...input.traceBase,
        payload: {
          ...input.traceBase.payload,
          ...input.resourceTrace,
          mode: "fail_closed_after_openai_error",
          openaiError: payload.error?.message ?? null,
          openaiStatus: response.status,
          hasApiFallbackReply: Boolean(input.apiFallbackReply),
        },
      });
      return buildZeroUsageReply(input.apiFallbackReply || input.scopedRecoveryReply, [], {
        provider: "agent_scoped_recovery",
        model: input.apiFallbackReply ? "fail_closed_after_openai_error_api_fallback" : "fail_closed_after_openai_error",
        agenteId: input.agentId,
        agenteNome: input.agentName,
        routeStage: "openai",
        heuristicStage: null,
        domainStage: input.domainSupportState.domainStage,
      });
    }

    const resolvedReply = extractTaggedAssetsFromModule(outputText, input.runtimeAssets);
    return {
      reply: resolvedReply.reply,
      assets: resolvedReply.assets,
      usage: {
        inputTokens: payload.usage?.input_tokens ?? 0,
        outputTokens: payload.usage?.output_tokens ?? 0,
      },
      metadata: {
        provider: "openai",
        model: payload.model ?? input.openai.model,
        agenteId: input.agentId,
        agenteNome: input.agentName,
        routeStage: "openai",
        heuristicStage: null,
        domainStage: input.domainSupportState.domainStage,
        debugRequest: {
          domainStage: input.domainSupportState.domainStage,
          hasSummary,
          hasRuntimePrompt: Boolean(input.runtimePrompt),
          allowIcons: input.context?.ui?.allow_icons !== false,
          structuredResponse: input.context?.ui?.structured_response !== false,
          historyLength: input.history.length,
          recentMessageWindow,
          maxOutputTokens: input.domainSupportState.maxOutputTokens,
          requestPayload,
        },
      },
    } satisfies SalesReplyResult;
  } catch (error) {
    console.error("[chat] failed to call openai", error);
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.guardrail",
      message: "Excecao ao chamar OpenAI. Resposta bloqueada por fail-closed.",
      ...input.traceBase,
        payload: {
          ...input.traceBase.payload,
          ...input.resourceTrace,
          mode: "fail_closed_after_exception",
          error: error instanceof Error ? error.message : "unknown",
          hasApiFallbackReply: Boolean(input.apiFallbackReply),
        },
      });
    return buildZeroUsageReply(input.apiFallbackReply || input.scopedRecoveryReply, [], {
      provider: "agent_scoped_recovery",
      model: input.apiFallbackReply ? "fail_closed_after_exception_api_fallback" : "fail_closed_after_exception",
      agenteId: input.agentId,
      agenteNome: input.agentName,
      routeStage: "openai",
      heuristicStage: null,
      domainStage: input.domainSupportState.domainStage,
    });
  }
}

async function resolveGuardrailStageReply(input: {
  stage: "inactive_or_invalid_agent" | "guardrail_no_openai" | "unexpected_route_fallback";
  conversationDomainStage?: ConversationDomainStage | null;
  lockedToAgent?: boolean;
  traceBase: TraceBase;
  resourceTrace?: Record<string, unknown>;
  scopedRecoveryReply?: string;
  apiFallbackReply?: string | null;
  agentId: string | null;
  agentName: string | null;
}) {
  if (input.stage === "inactive_or_invalid_agent") {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.guardrail",
      message: input.lockedToAgent ? "Agente travado invalido ou inativo no orquestrador." : "Orquestrador sem agente valido. Fallback automatico bloqueado.",
      ...input.traceBase,
    });
    return buildZeroUsageReply("", [], {
      provider: "guardrail",
      model: "inactive_or_invalid_agent",
      agenteId: null,
      agenteNome: null,
      routeStage: "inactive_or_invalid_agent",
      heuristicStage: null,
      domainStage: input.conversationDomainStage ?? null,
    });
  }

  if (input.stage === "guardrail_no_openai") {
    await appendRuntimeErrorLog({
        source: "chat_orchestrator.guardrail",
        message: "OpenAI indisponivel. Resposta bloqueada por fail-closed.",
        ...input.traceBase,
        payload: {
          ...input.traceBase.payload,
          ...(input.resourceTrace ?? {}),
          mode: "fail_closed_no_openai_key",
          hasApiFallbackReply: Boolean(input.apiFallbackReply),
        },
      });
    return buildZeroUsageReply(input.apiFallbackReply || input.scopedRecoveryReply || "", [], {
      provider: "agent_scoped_recovery",
      model: input.apiFallbackReply ? "fail_closed_no_openai_key_api_fallback" : "fail_closed_no_openai_key",
      agenteId: input.agentId,
      agenteNome: input.agentName,
      routeStage: "guardrail_no_openai",
      heuristicStage: null,
      domainStage: input.conversationDomainStage ?? null,
    });
  }

  return buildZeroUsageReply(input.scopedRecoveryReply ?? "", [], {
    provider: "agent_scoped_recovery",
    model: "unexpected_route_fallback",
    agenteId: input.agentId,
    agenteNome: input.agentName,
    routeStage: "guardrail_no_openai",
    heuristicStage: null,
    domainStage: input.conversationDomainStage ?? null,
  });
}

export async function generateSalesReply(history: ConversationMessage[], context?: ConversationContext) {
  const latestUserMessage = [...history].reverse().find((item) => item.role === "user")?.content ?? "";
  const channelPolicy = getChatChannelPolicy(context);
  const enableInfraStudioHeuristics = isInfraStudioFirstPartyContextFromModule(context);
  const projectId = context?.admin?.projetoId ?? context?.projeto?.id ?? null;
  const agentId = context?.admin?.agenteId ?? context?.agente?.id ?? null;
  const lockedToAgent = context?.agente?.locked === true;
  const [resolvedAgent, billingProjectPlan] = await Promise.all([
    agentId ? getAgenteById(agentId) : Promise.resolve(null),
    projectId ? getPlanoProjeto(projectId) : Promise.resolve(null),
  ]);
  const agent =
    resolvedAgent && resolvedAgent.ativo && (!projectId || resolvedAgent.projetoId === projectId) ? resolvedAgent : null;

  const traceBase = {
    projetoId: projectId,
    agenteId: agent?.id ?? agentId ?? null,
    payload: {
      lockedToAgent,
      resolvedAgentId: resolvedAgent?.id ?? null,
      resolvedAgentProjetoId: resolvedAgent?.projetoId ?? null,
      resolvedAgentAtivo: resolvedAgent?.ativo ?? null,
      channelKind: context?.channel?.kind ?? null,
      latestUserMessage: latestUserMessage.slice(0, 280),
    },
  };
  const initialRouteStage = classifyOrchestratorRouteStage({
    hasValidAgent: Boolean(agent),
    heuristicIntentStage: "none",
    hasOpenAiKey: false,
  });

  if (initialRouteStage === "inactive_or_invalid_agent" || !agent) {
    return withBillingControl(await resolveGuardrailStageReply({
      stage: "inactive_or_invalid_agent",
      conversationDomainStage: null,
      lockedToAgent,
      traceBase,
      agentId: null,
      agentName: null,
    }), billingProjectPlan);
  }
  const activeAgent: AgenteRecord = agent;
  const runtimeAssets = buildRuntimeReplyAssets(activeAgent.arquivos ?? []);
  const apiContexts = await buildAgenteApiRuntimeContext(activeAgent.id, (context ?? {}) as Record<string, unknown>);
  const mercadoLivreConnectors = await listConectoresByAgente(activeAgent.id, MERCADO_LIVRE_CONNECTOR_TYPE);
  const hasMercadoLivreConnector = mercadoLivreConnectors.length > 0;
  const leadNameReplyDetected = isLikelyLeadNameReplyFromModule(latestUserMessage, history, {
    normalizeText,
    extractName: (message) => extractNameFromModule(message, normalizeText),
  });
  const extractedLeadName = leadNameReplyDetected ? extractNameFromModule(latestUserMessage, normalizeText) : null;
  const {
    openai,
    recentCatalogProducts,
    semanticIntentStage,
    catalogFollowUpDecision,
    loadMoreCatalogRequested,
    genericMercadoLivreListingRequested,
    productSearchRequested,
    productSearchCandidates,
    productSearchTerm,
    referencedCatalogProducts,
    currentCatalogProduct,
  } = await buildHeuristicPipelineState({
    projectId,
    latestUserMessage,
    history,
    context,
    hasMercadoLivreConnector,
    leadNameReplyDetected,
  });
  const mercadoLivreSearch =
    agent?.id && hasMercadoLivreConnector
      ? await resolveMercadoLivreSearch({
          agentId: agent.id,
          context,
          genericListingRequested: genericMercadoLivreListingRequested,
          productSearchRequested,
          productSearchCandidates,
          productSearchTerm,
          recentCatalogProducts,
          loadMoreCatalogRequested,
          deps: {
            normalizeText,
            isWhatsAppChannel,
          },
        })
      : {
          listingProducts: [] as ProdutoPadronizado[],
          products: [] as ProdutoPadronizado[],
          listingProductsForAssets: [] as Array<ProdutoPadronizado | ProdutoDetalhadoMercadoLivre>,
          productsForAssets: [] as Array<ProdutoPadronizado | ProdutoDetalhadoMercadoLivre>,
          resolvedProductSearchTerm: productSearchTerm,
        };
  const mercadoLivreListingProducts = mercadoLivreSearch.listingProducts;
  const mercadoLivreProducts = mercadoLivreSearch.products;
  const mercadoLivreListingProductsForAssets = mercadoLivreSearch.listingProductsForAssets;
  const mercadoLivreProductsForAssets = mercadoLivreSearch.productsForAssets;
  const resolvedProductSearchTerm = mercadoLivreSearch.resolvedProductSearchTerm;
  const {
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
    hasFocusedApiContext,
    hasLeadContext,
  } = resolveConversationContextStageState({
    agent: activeAgent,
    context,
    latestUserMessage,
    history,
    apiContexts,
    runtimeAssets,
    hasMercadoLivreConnector,
    enableInfraStudioHeuristics,
    allowLeadGate: channelPolicy.allowLeadGate,
    leadNameReplyDetected,
    extractedLeadName,
    currentCatalogProduct,
    deps: {
      buildSystemPrompt: buildSystemPromptFromModule,
      buildChannelReplyInstruction: buildChannelReplyInstructionFromModule,
      buildRuntimePrompt: buildRuntimePromptFromModule,
      buildLegacyAgentPrompt: buildLegacyAgentPromptFromModule,
      buildStructuredReplyInstruction: buildStructuredReplyInstructionFromModule,
      buildAnalyticalReplyInstruction: buildAnalyticalReplyInstructionFromModule,
      buildAgentAssetInstruction: buildAgentAssetInstructionFromModule,
      buildFocusedApiContext: (message, runtimeApiContexts) =>
        buildFocusedApiContext(message, runtimeApiContexts, {
          normalizeText,
          buildSearchTokens,
          singularizeToken,
        }),
      buildAgentScopedRecoveryReply: buildAgentScopedRecoveryReplyFromModule,
      buildCatalogPricingReply: (history, runtimeContext) =>
        buildCatalogPricingReplyFromModule(history, runtimeContext, {
          normalizeText,
          prefersStructuredReply: prefersStructuredReplyFromModule,
        }),
      maybeAskForLeadIdentification: (runtimeContext, history, latestMessage) =>
        maybeAskForLeadIdentificationFromModule(runtimeContext, history, latestMessage, {
          normalizeText,
          isOutOfScopeForCatalog: (messages) => isOutOfScopeForCatalogFromModule(messages, { normalizeText }),
          isWhatsAppChannel,
        }),
      buildLeadNameAcknowledgementReply: (name, connector, runtimeContext) =>
        buildLeadNameAcknowledgementReplyFromModule(name, connector, runtimeContext, isWhatsAppChannel),
    },
  });
  const semanticApiIntentStage = hasFocusedApiContext
    ? await classifySemanticApiIntentStage({
        openai,
        message: latestUserMessage,
        context,
        focusedApiContextInstructions: focusedApiContext.instructions,
      })
    : null;
  const apiFallbackReply = buildApiFallbackReply(latestUserMessage, apiContexts, {
    normalizeText,
    buildSearchTokens,
    singularizeToken,
  });
  const resourceTrace = {
    apiNames: apiContexts.map((item) => item.nome),
    apiErrors: apiContexts.filter((item) => item.erro).map((item) => ({ nome: item.nome, erro: item.erro })),
    hasApiFallbackReply: Boolean(apiFallbackReply),
    mercadoLivreRequested: productSearchRequested,
    mercadoLivreLoadMoreRequested: loadMoreCatalogRequested,
    mercadoLivreConnectorActive: hasMercadoLivreConnector,
    mercadoLivreListingRequested: genericMercadoLivreListingRequested,
    mercadoLivreTerm: resolvedProductSearchTerm || null,
    mercadoLivreCandidates: productSearchCandidates,
    mercadoLivreListingCount: mercadoLivreListingProducts.length,
    mercadoLivreCount: mercadoLivreProducts.length,
    semanticIntentStage: semanticIntentStage
      ? {
          intent: semanticIntentStage.intent,
          confidence: semanticIntentStage.confidence,
          reason: semanticIntentStage.reason,
          usedLlm: semanticIntentStage.usedLlm,
        }
      : null,
    semanticApiIntentStage: semanticApiIntentStage
      ? {
          intent: semanticApiIntentStage.intent,
          confidence: semanticApiIntentStage.confidence,
          reason: semanticApiIntentStage.reason,
          usedLlm: semanticApiIntentStage.usedLlm,
        }
      : null,
    catalogFollowUpDecision: catalogFollowUpDecision
      ? {
          kind: catalogFollowUpDecision.kind,
          confidence: catalogFollowUpDecision.confidence,
          reason: catalogFollowUpDecision.reason,
          usedLlm: catalogFollowUpDecision.usedLlm,
          matchedProductIds: catalogFollowUpDecision.matchedProducts.map((item: CatalogProductReference) => item.id ?? item.link ?? item.nome ?? null),
        }
      : null,
  };
  const {
    selectedCatalogProduct,
    selectedProductSalesReply,
    salesFocusProduct,
    ambiguousCatalogReferenceReply,
    mercadoLivreListingReply,
    mercadoLivrePromptContext,
    mercadoLivreDetailPromptContext,
    directMercadoLivreReply,
    mercadoLivreNoResultsReply,
    currentProductForMetadata,
  } = await resolveMercadoLivreHeuristicState({
    agentId: agent?.id ?? null,
    latestUserMessage,
    context,
    hasMercadoLivreConnector,
    leadNameReplyDetected,
    hasReferencedCatalogReply: referencedCatalogProducts.length > 0,
    productSearchRequested,
    genericMercadoLivreListingRequested,
    mercadoLivreListingProducts,
    mercadoLivreProducts,
    resolvedProductSearchTerm,
    productSearchTerm,
    loadMoreCatalogRequested,
    referencedCatalogProducts,
    currentCatalogProduct,
    catalogFollowUpDecision,
    lojaCta,
    deps: {
      normalizeText,
      isWhatsAppChannel,
    },
  });
  const mercadoLivreHeuristicReply = resolveMercadoLivreHeuristicReply({
    context,
    latestUserMessage,
    agentId: activeAgent.id ?? null,
    agentName: activeAgent.nome ?? null,
    selectedProductSalesReply,
    salesFocusProduct,
    selectedCatalogProduct,
    mercadoLivreListingReply,
    mercadoLivreListingProductsForAssets,
    directMercadoLivreReply,
    mercadoLivreProductsForAssets,
    currentProductForMetadata,
    mercadoLivreNoResultsReply,
    formatReply: formatHeuristicReplyFromModule,
    deps: {
      normalizeText,
      isWhatsAppChannel,
    },
  });
  const shouldBypassCatalogReferenceReply =
    Boolean(currentCatalogProduct) &&
    Boolean(semanticIntentStage) &&
    (semanticIntentStage?.intent === "product_interest" || semanticIntentStage?.intent === "product_question");
  const catalogReferenceHeuristicReply = shouldBypassCatalogReferenceReply
    ? null
    : resolveCatalogReferenceHeuristicReply({
    context,
    agentId: activeAgent.id ?? null,
    agentName: activeAgent.nome ?? null,
    referencedCatalogProducts,
    ambiguousCatalogReferenceReply,
    formatReply: formatHeuristicReplyFromModule,
  });
  const {
    heuristicIntentStage,
    conversationDomainStage,
    orchestratorRouteStage,
    domainSupportState,
  } = resolveConversationPipelineStageState({
    leadNameAcknowledgementReply,
    hasCatalogReferenceHeuristicReply: Boolean(catalogReferenceHeuristicReply),
    hasMercadoLivreHeuristicReply: Boolean(mercadoLivreHeuristicReply),
    catalogPricingReply,
    leadIdentificationReply,
    hasValidAgent: Boolean(agent),
    hasOpenAiKey: Boolean(openai.apiKey),
    hasFocusedApiContext,
    latestUserMessage,
    hasMemorySummary: Boolean(context?.memoria?.resumo),
    hasCurrentCatalogContext: Boolean(currentCatalogProduct || recentCatalogProducts.length > 0),
    semanticApiIntentStage,
    semanticCatalogIntentStage: semanticIntentStage,
    hasMercadoLivreContext: Boolean(
      mercadoLivrePromptContext ||
        mercadoLivreDetailPromptContext ||
        salesFocusProduct ||
        selectedCatalogProduct ||
        currentProductForMetadata,
    ),
    hasLeadContext,
  });

  if (leadIdentificationReply && leadNameReplyDetected) {
    await appendRuntimeErrorLog({
      source: "chat_orchestrator.trace",
      message: "Resposta de nome do lead priorizada antes do conector Mercado Livre.",
      ...traceBase,
      payload: { ...traceBase.payload, ...resourceTrace, mode: "lead_name_priority", domain: conversationDomainStage },
    });
  }
  const heuristicStageReply = await resolveHeuristicStageReply({
    heuristicIntentStage,
    conversationDomainStage,
    leadNameAcknowledgementReply,
    extractedLeadName,
    catalogReferenceHeuristicReply,
    mercadoLivreHeuristicReply,
    catalogPricingReply,
    leadIdentificationReply,
    context,
    traceBase,
    resourceTrace,
    agentId: activeAgent.id ?? null,
    agentName: activeAgent.nome ?? null,
  });
  if (heuristicStageReply) {
    return withBillingControl(heuristicStageReply, billingProjectPlan);
  }

  if (orchestratorRouteStage === "guardrail_no_openai") {
    return withBillingControl(await resolveGuardrailStageReply({
      stage: "guardrail_no_openai",
      conversationDomainStage,
      traceBase,
        resourceTrace,
        scopedRecoveryReply,
        apiFallbackReply,
        agentId: activeAgent.id ?? null,
        agentName: activeAgent.nome ?? null,
      }), billingProjectPlan);
  }

  if (orchestratorRouteStage === "openai") {
    return withBillingControl(await resolveOpenAiStageReply({
      openai,
      context,
      history,
      domainSupportState,
      runtimePrompt,
      systemPrompt,
      channelReplyInstruction,
      legacyAgentPrompt,
      structuredReplyInstruction,
      analyticalReplyInstruction,
      agentAssetInstruction,
      focusedApiContextInstructions: focusedApiContext.instructions,
      mercadoLivrePromptContext,
      mercadoLivreDetailPromptContext,
      runtimeAssets,
      traceBase,
        resourceTrace,
        scopedRecoveryReply,
        apiFallbackReply,
        agentId: activeAgent.id ?? null,
        agentName: activeAgent.nome ?? null,
      }), billingProjectPlan);
  }

  return withBillingControl(await resolveGuardrailStageReply({
    stage: "unexpected_route_fallback",
    conversationDomainStage,
    traceBase,
      resourceTrace,
      scopedRecoveryReply,
      apiFallbackReply,
      agentId: activeAgent.id ?? null,
      agentName: activeAgent.nome ?? null,
    }), billingProjectPlan);
}

function extractPhone(message: string) {
  return extractPhoneFromRecoveryModule(message);
}

function extractName(message: string) {
  return extractNameFromRecoveryModule(message);
}

export function enrichLeadContext(
  currentContext: Record<string, unknown> | null,
  history: ConversationMessage[],
  latestUserMessage: string,
) {
  return enrichLeadContextFromModule(currentContext, history, latestUserMessage, {
    normalizeText,
  });
}



