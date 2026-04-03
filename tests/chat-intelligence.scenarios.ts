import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildAmbiguousCatalogReferenceReply,
  decideCatalogFollowUpHeuristically,
  resolveCatalogReferenceHeuristicReply,
  resolveRecentCatalogProductReference,
  type CatalogFollowUpDecision,
} from "@/lib/catalog-follow-up";
import type { ConversationContext } from "@/lib/chat-context";
import { buildApiContinuationFallbackReply, buildApiFallbackReply, buildFocusedApiContext } from "@/lib/chat-api-runtime";
import { resolveConversationPipelineStageState } from "@/lib/chat-pipeline-stage";
import { buildAgentScopedRecoveryReply } from "@/lib/chat-recovery-stage";
import { buildWhatsAppMessageSequence, resolveCanonicalWhatsAppExternalIdentifier } from "@/lib/chat-service";
import { buildCatalogDecisionFromSemanticIntent } from "@/lib/chat-semantic-intent-stage";
import {
  buildProductSearchCandidates as buildProductSearchCandidatesFromModule,
  isGreetingOrAckMessage as isGreetingOrAckMessageFromModule,
  isMercadoLivreListingIntent as isMercadoLivreListingIntentFromModule,
  shouldContinueProductSearch,
  shouldSearchProducts as shouldSearchProductsFromModule,
  shouldUseMercadoLivreConnectorFallback,
} from "@/lib/chat-sales-heuristics";
import {
  buildMercadoLivreSalesReply,
  buildMercadoLivreReply,
  buildMercadoLivreSingleResultReply,
  resolveMercadoLivreFlowState,
  resolveMercadoLivreHeuristicReply,
  resolveMercadoLivreHeuristicState,
} from "@/lib/chat-mercado-livre";
import {
  createFixtureSearchDeps,
  loadApiRuntimeFixture,
  loadApiRuntimeRealEstateFixture,
  loadCatalogContextFixture,
  loadMercadoLivreFocusProductFixture,
  loadWhatsAppContextFixture,
  normalizeFixtureText,
} from "@/tests/chat-test-fixtures";

type ScenarioResult = {
  category: string;
  title: string;
  input: string;
  observations: string[];
};

const deps = createFixtureSearchDeps();
const baseContext: ConversationContext = loadCatalogContextFixture();
const whatsappContext: ConversationContext = loadWhatsAppContextFixture();
const apiRuntimeFixture = loadApiRuntimeFixture();
const apiRuntimeRealEstateFixture = loadApiRuntimeRealEstateFixture();
const mercadoLivreFocusProduct = loadMercadoLivreFocusProductFixture();

async function analyzeCatalogScenario(title: string, input: string, context: ConversationContext): Promise<ScenarioResult> {
  const decision = decideCatalogFollowUpHeuristically(input, context, deps);
  const resolved = resolveRecentCatalogProductReference(input, context);

  const observations = [
    `follow_up.kind=${decision?.kind ?? "null"}`,
    `follow_up.reason=${decision?.reason ?? "null"}`,
    `follow_up.block_new_search=${decision?.shouldBlockNewSearch ?? "null"}`,
    `resolved_refs=${resolved.map((item) => item.nome ?? item.id ?? "sem-nome").join(" | ") || "none"}`,
  ];

  if (decision?.kind === "recent_product_reference_ambiguous") {
    const reply = resolveCatalogReferenceHeuristicReply({
      context,
      agentId: "agent-1",
      agentName: "Agent",
      referencedCatalogProducts: [],
      ambiguousCatalogReferenceReply: buildAmbiguousCatalogReferenceReply(context),
      formatReply: (reply) => reply,
    });

    observations.push(`catalog_reply.mode=${reply?.mode ?? "null"}`);
    observations.push(`catalog_reply.assets=${reply?.assets.length ?? 0}`);
  }

  return { category: "catalog", title, input, observations };
}

async function analyzeSemanticCatalogPipelineScenario(
  title: string,
  input: string,
  context: ConversationContext,
  semanticIntent: "product_interest" | "product_question" | "product_rejection" | "new_search" | "generic",
): Promise<ScenarioResult> {
  const semanticDecision = buildCatalogDecisionFromSemanticIntent({
    semanticIntent: {
      intent: semanticIntent,
      confidence: 0.91,
      reason: "cenario controlado do pipeline semantico",
      usedLlm: true,
    },
    context,
    recentProducts: context.catalogo?.ultimosProdutos ?? [],
  });

  const flow = resolveMercadoLivreFlowState({
    latestUserMessage: input,
    context,
    hasMercadoLivreConnector: true,
    leadNameReplyDetected: false,
    recentCatalogProducts: context.catalogo?.ultimosProdutos ?? [],
    catalogFollowUpDecision: semanticDecision,
    detectProductSearch: () => true,
    buildProductSearchCandidates: deps.buildProductSearchCandidates,
    resolveRecentCatalogProductReference,
    isRecentCatalogReferenceAttempt: (message) => /\b(esse|essa|mandou|primeiro|segundo)\b/i.test(message),
    isMercadoLivreListingIntent: (message) => /\b(loja|catalogo|vitrine)\b/i.test(message),
    shouldUseMercadoLivreConnectorFallback: () => true,
  });

  return {
    category: "pipeline",
    title,
    input,
    observations: [
      `semantic.intent=${semanticIntent}`,
      `semantic.decision=${semanticDecision?.kind ?? "null"}`,
      `semantic.used_llm=${semanticDecision?.usedLlm ?? false}`,
      `flow.product_search=${flow.productSearchRequested}`,
      `flow.referenced=${flow.referencedCatalogProducts.map((item) => item.nome ?? item.id ?? "sem-nome").join(" | ") || "none"}`,
      `flow.current_product=${flow.currentCatalogProduct?.nome ?? "none"}`,
    ],
  };
}

async function analyzeMercadoLivreScenario(title: string, input: string, context: ConversationContext, decision: CatalogFollowUpDecision | null): Promise<ScenarioResult> {
  const flow = resolveMercadoLivreFlowState({
    latestUserMessage: input,
    context,
    hasMercadoLivreConnector: true,
    leadNameReplyDetected: false,
    recentCatalogProducts: context.catalogo?.ultimosProdutos ?? [],
    catalogFollowUpDecision: decision,
    detectProductSearch: () => true,
    buildProductSearchCandidates: deps.buildProductSearchCandidates,
    resolveRecentCatalogProductReference,
    isRecentCatalogReferenceAttempt: (message) => /\b(esse|essa|mandou|primeiro|segundo)\b/i.test(message),
    isMercadoLivreListingIntent: (message) => isMercadoLivreListingIntentFromModule(message, { normalizeText: normalizeFixtureText }),
    shouldUseMercadoLivreConnectorFallback: () => true,
  });

  const heuristicState = await resolveMercadoLivreHeuristicState({
    agentId: null,
    latestUserMessage: input,
    context,
    hasMercadoLivreConnector: true,
    leadNameReplyDetected: false,
    hasReferencedCatalogReply: flow.referencedCatalogProducts.length > 0,
    productSearchRequested: flow.productSearchRequested,
    genericMercadoLivreListingRequested: flow.genericMercadoLivreListingRequested,
    mercadoLivreListingProducts: [],
    mercadoLivreProducts: [],
    resolvedProductSearchTerm: flow.productSearchTerm,
    productSearchTerm: flow.productSearchTerm,
    loadMoreCatalogRequested: flow.loadMoreCatalogRequested,
    referencedCatalogProducts: flow.referencedCatalogProducts,
    currentCatalogProduct: flow.currentCatalogProduct,
    catalogFollowUpDecision: decision,
    lojaCta: null,
    deps: {
      normalizeText: normalizeFixtureText,
      isWhatsAppChannel: () => true,
    },
  });

  const mlReply = resolveMercadoLivreHeuristicReply({
    context,
    latestUserMessage: input,
    agentId: "agent-1",
    agentName: "Agent",
    selectedProductSalesReply: heuristicState.selectedProductSalesReply,
    salesFocusProduct: heuristicState.salesFocusProduct,
    selectedCatalogProduct: heuristicState.selectedCatalogProduct,
    mercadoLivreListingReply: heuristicState.mercadoLivreListingReply,
    mercadoLivreListingProductsForAssets: [],
    directMercadoLivreReply: heuristicState.directMercadoLivreReply,
    mercadoLivreProductsForAssets: [],
    currentProductForMetadata: heuristicState.currentProductForMetadata,
    mercadoLivreNoResultsReply: heuristicState.mercadoLivreNoResultsReply,
    formatReply: (reply) => reply,
    deps: {
      normalizeText: normalizeFixtureText,
      isWhatsAppChannel: () => true,
    },
  });

  const stageState = resolveConversationPipelineStageState({
    leadNameAcknowledgementReply: null,
    hasCatalogReferenceHeuristicReply: flow.referencedCatalogProducts.length > 0 || Boolean(heuristicState.ambiguousCatalogReferenceReply),
    hasMercadoLivreHeuristicReply: Boolean(mlReply),
    catalogPricingReply: null,
    leadIdentificationReply: null,
    hasValidAgent: true,
    hasOpenAiKey: true,
    hasFocusedApiContext: false,
    latestUserMessage: input,
    hasMemorySummary: Boolean(context.memoria?.resumo),
    hasCurrentCatalogContext: Boolean(context.catalogo?.produtoAtual || (context.catalogo?.ultimosProdutos?.length ?? 0) > 0),
    hasMercadoLivreContext: Boolean(heuristicState.salesFocusProduct || heuristicState.selectedProductSalesReply),
    hasLeadContext: Boolean(context.lead?.identificado || context.lead?.nome || context.lead?.telefone),
  });

  return {
    category: "mercado_livre",
    title,
    input,
    observations: [
      `flow.reused_previous_search_for_listing=${flow.reusedPreviousCatalogSearchForListing}`,
      `flow.product_search=${flow.productSearchRequested}`,
      `flow.product_term=${flow.productSearchTerm || "none"}`,
      `flow.referenced=${flow.referencedCatalogProducts.map((item) => item.nome ?? item.id ?? "sem-nome").join(" | ") || "none"}`,
      `ml.ambiguous_reply=${heuristicState.ambiguousCatalogReferenceReply ? "yes" : "no"}`,
      `ml.reply.mode=${mlReply?.mode ?? "null"}`,
      `classifier.heuristic_stage=${stageState.heuristicIntentStage}`,
      `classifier.route_stage=${stageState.orchestratorRouteStage}`,
      `classifier.domain_stage=${stageState.conversationDomainStage}`,
      `domain.max_output_tokens=${stageState.domainSupportState.maxOutputTokens}`,
      `domain.recent_message_window=${stageState.domainSupportState.recentMessageWindow}`,
    ],
  };
}

async function analyzeMercadoLivreCommercialScenario(title: string, input: string, context: ConversationContext): Promise<ScenarioResult> {
  const decision: CatalogFollowUpDecision = {
    kind: "recent_product_reference",
    confidence: 0.94,
    reason: "pipeline semantico manteve o produto atual em foco",
    matchedProducts: [context.catalogo!.ultimosProdutos![1]!],
    usedLlm: true,
    shouldBlockNewSearch: true,
  };

  const flow = resolveMercadoLivreFlowState({
    latestUserMessage: input,
    context,
    hasMercadoLivreConnector: true,
    leadNameReplyDetected: false,
    recentCatalogProducts: context.catalogo?.ultimosProdutos ?? [],
    catalogFollowUpDecision: decision,
    detectProductSearch: () => true,
    buildProductSearchCandidates: deps.buildProductSearchCandidates,
    resolveRecentCatalogProductReference,
    isRecentCatalogReferenceAttempt: (message) => /\b(esse|essa|mandou|primeiro|segundo)\b/i.test(message),
    isMercadoLivreListingIntent: (message) => /\b(loja|catalogo|vitrine)\b/i.test(message),
    shouldUseMercadoLivreConnectorFallback: () => true,
  });

  const state = await resolveMercadoLivreHeuristicState({
    agentId: "agent-1",
    latestUserMessage: input,
    context,
    hasMercadoLivreConnector: true,
    leadNameReplyDetected: false,
    hasReferencedCatalogReply: true,
    productSearchRequested: flow.productSearchRequested,
    genericMercadoLivreListingRequested: flow.genericMercadoLivreListingRequested,
    mercadoLivreListingProducts: [],
    mercadoLivreProducts: [],
    resolvedProductSearchTerm: flow.productSearchTerm,
    productSearchTerm: flow.productSearchTerm,
    loadMoreCatalogRequested: flow.loadMoreCatalogRequested,
    referencedCatalogProducts: flow.referencedCatalogProducts,
    currentCatalogProduct: flow.currentCatalogProduct,
    catalogFollowUpDecision: decision,
    lojaCta: null,
    deps: {
      normalizeText: normalizeFixtureText,
      isWhatsAppChannel: () => true,
    },
  });

  return {
    category: "mercado_livre",
    title,
    input,
    observations: [
      `flow.product_search=${flow.productSearchRequested}`,
      `flow.current_product=${flow.currentCatalogProduct?.nome ?? "none"}`,
      `sales.reply_present=${state.selectedProductSalesReply ? "yes" : "no"}`,
      `sales.probe_present=${/o que mais pesa para voce/i.test(state.selectedProductSalesReply ?? "") ? "yes" : "no"}`,
      `sales.uses_description=${/No anuncio ele aparece assim:|Pelo anuncio/i.test(state.selectedProductSalesReply ?? "") ? "yes" : "no"}`,
    ],
  };
}

async function analyzeAgentTestFocusedProductScenario(title: string, input: string): Promise<ScenarioResult> {
  const reply = buildMercadoLivreSalesReply(
    mercadoLivreFocusProduct,
    input,
    { channel: { kind: "admin_agent_test" } } as ConversationContext,
    null,
    {
      normalizeText: normalizeFixtureText,
      isWhatsAppChannel: () => false,
    },
  );

  const repeatedNameCount = (reply.match(/Jogo De Sopeira Com Consumes Ceramica Decorada Vintage Branco/gi) ?? []).length;

  return {
    category: "mercado_livre",
    title,
    input,
    observations: [
      `agent_test.reply_mentions_material=${/ceramica esmaltada/i.test(reply) ? "yes" : "no"}`,
      `agent_test.reply_mentions_state=${/bom estado geral|sem trincas|sem quebras/i.test(reply) ? "yes" : "no"}`,
      `agent_test.reply_mentions_usage=${/uso a mesa|dia a dia|servir sopas e caldos/i.test(reply) ? "yes" : "no"}`,
      `agent_test.reply_avoids_restart=${/Sigo por aqui no contexto|Me diga o ponto exato que voce quer validar/i.test(reply) ? "no" : "yes"}`,
      `agent_test.reply_avoids_relisting=${/buscar opcoes parecidas|mostrar mais detalhes/i.test(reply) ? "no" : "yes"}`,
      `agent_test.reply_product_name_repetitions=${repeatedNameCount}`,
    ],
  };
}

async function analyzeAgentTestPostSingleProductDeliveryScenario(title: string): Promise<ScenarioResult> {
  const agentTestContext: ConversationContext = {
    ...baseContext,
    channel: { kind: "admin_agent_test" },
    catalogo: {
      ...baseContext.catalogo!,
      ultimaBusca: "sopeira",
      produtoAtual: baseContext.catalogo?.ultimosProdutos?.[1],
      ultimosProdutos: [baseContext.catalogo?.ultimosProdutos?.[1]].filter(Boolean) as NonNullable<ConversationContext["catalogo"]>["ultimosProdutos"],
    },
  };

  const singleProductReply = buildMercadoLivreSingleResultReply(
    mercadoLivreFocusProduct,
    agentTestContext,
    null,
    {
      normalizeText: normalizeFixtureText,
      isWhatsAppChannel: () => false,
    },
  );

  const followUpReply = buildMercadoLivreSalesReply(
    mercadoLivreFocusProduct,
    "gostei vc sabe o material dele",
    agentTestContext,
    null,
    {
      normalizeText: normalizeFixtureText,
      isWhatsAppChannel: () => false,
    },
  );

  const repeatedNameCount = (followUpReply.match(/Jogo De Sopeira Com Consumes Ceramica Decorada Vintage Branco/gi) ?? []).length;

  return {
    category: "mercado_livre",
    title,
    input: "preciso de uma sopeira -> [produto unico entregue] -> gostei vc sabe o material dele",
    observations: [
      `agent_test.single_product_delivery_is_commercial=${/Encontrei um produto que combina com a busca/i.test(singleProductReply) ? "yes" : "no"}`,
      `agent_test.single_product_delivery_uses_description=${/No anuncio ele aparece assim:/i.test(singleProductReply) ? "yes" : "no"}`,
      `agent_test.follow_up_mentions_material=${/ceramica esmaltada/i.test(followUpReply) ? "yes" : "no"}`,
      `agent_test.follow_up_mentions_state=${/bom estado geral|sem trincas|sem quebras/i.test(followUpReply) ? "yes" : "no"}`,
      `agent_test.follow_up_avoids_restart=${/Sigo por aqui no contexto|Me diga o ponto exato que voce quer validar/i.test(followUpReply) ? "no" : "yes"}`,
      `agent_test.follow_up_avoids_relisting=${/Acredito que voce esteja falando|buscar opcoes parecidas|mostrar mais detalhes/i.test(followUpReply) ? "no" : "yes"}`,
      `agent_test.follow_up_product_name_repetitions=${repeatedNameCount}`,
    ],
  };
}

async function analyzeAgentTestConversationDiagnosticScenario(title: string): Promise<ScenarioResult> {
  const agentTestContext: ConversationContext = {
    ...baseContext,
    channel: { kind: "admin_agent_test" },
    catalogo: {
      ...baseContext.catalogo!,
      ultimaBusca: "sopeira",
      produtoAtual: baseContext.catalogo?.ultimosProdutos?.[1],
    },
  };
  const initialSearchCandidates = buildProductSearchCandidatesFromModule("preciso de uma sopeira", {
    normalizeText: normalizeFixtureText,
    isGreetingOrAckMessage: (message) => isGreetingOrAckMessageFromModule(message, { normalizeText: normalizeFixtureText }),
  });
  const typoSearchCandidates = buildProductSearchCandidatesFromModule("vc tem soperia", {
    normalizeText: normalizeFixtureText,
    isGreetingOrAckMessage: (message) => isGreetingOrAckMessageFromModule(message, { normalizeText: normalizeFixtureText }),
  });
  const initialSearchDetected = shouldSearchProductsFromModule("preciso de uma sopeira", { normalizeText: normalizeFixtureText });
  const listingFlow = resolveMercadoLivreFlowState({
    latestUserMessage: "exiba seus produtos pra mim",
    context: agentTestContext,
    hasMercadoLivreConnector: true,
    leadNameReplyDetected: false,
    recentCatalogProducts: agentTestContext.catalogo?.ultimosProdutos ?? [],
    catalogFollowUpDecision: null,
    detectProductSearch: () => shouldSearchProductsFromModule("exiba seus produtos pra mim", { normalizeText: normalizeFixtureText }),
    buildProductSearchCandidates: deps.buildProductSearchCandidates,
    resolveRecentCatalogProductReference,
    isRecentCatalogReferenceAttempt: (message) => /\b(esse|essa|mandou|primeiro|segundo)\b/i.test(message),
    isMercadoLivreListingIntent: (message) => isMercadoLivreListingIntentFromModule(message, { normalizeText: normalizeFixtureText }),
    shouldUseMercadoLivreConnectorFallback: () => true,
  });
  const listingReply = buildMercadoLivreReply(loadCatalogProductsFromContext(baseContext), agentTestContext, {
    normalizeText: normalizeFixtureText,
    isWhatsAppChannel: () => false,
  });
  const likeReply = buildMercadoLivreSingleResultReply(mercadoLivreFocusProduct, agentTestContext, null, {
    normalizeText: normalizeFixtureText,
    isWhatsAppChannel: () => false,
  });
  const detailsReply = buildMercadoLivreSalesReply(
    mercadoLivreFocusProduct,
    "qro mais detalhes",
    agentTestContext,
    null,
    {
      normalizeText: normalizeFixtureText,
      isWhatsAppChannel: () => false,
    },
  );
  const recoveryReply = buildAgentScopedRecoveryReply({
    message: "preciso de uma sopeira",
    context: agentTestContext,
    agent: {
      id: "agent-ml",
      nome: "Reliquia de familia",
      slug: null,
      projetoId: "proj-ml",
      modeloId: null,
      apiIds: [],
      configuracoes: {},
      arquivos: [],
      promptBase: "",
      createdAt: "",
      updatedAt: "",
      ativo: true,
      descricao: null,
    } as never,
    apiContexts: [],
    hasMercadoLivreConnector: true,
  });

  return {
    category: "mercado_livre",
    title,
    input: "oi -> preciso de uma sopeira -> vc tem soperia -> exiba seus produtos pra mim -> gostei da sopeira -> qro mais detalhes",
    observations: [
      `agent_test.initial_search_detected=${initialSearchDetected ? "yes" : "no"}`,
      `agent_test.initial_search_candidates=${initialSearchCandidates.join(" | ") || "none"}`,
      `agent_test.typo_search_candidates=${typoSearchCandidates.join(" | ") || "none"}`,
      `agent_test.typo_recovers_sopeira=${typoSearchCandidates.some((item) => /sopeira/i.test(item)) ? "yes" : "no"}`,
      `agent_test.listing_intent_detected=${isMercadoLivreListingIntentFromModule("exiba seus produtos pra mim", { normalizeText: normalizeFixtureText }) ? "yes" : "no"}`,
      `agent_test.listing_reuses_previous_search=${listingFlow.reusedPreviousCatalogSearchForListing ? "yes" : "no"}`,
      `agent_test.listing_product_search=${listingFlow.productSearchRequested ? "yes" : "no"}`,
      `agent_test.listing_referenced_count=${listingFlow.referencedCatalogProducts.length}`,
      `agent_test.listing_generic=${/Separei alguns produtos da loja logo abaixo/i.test(listingReply ?? "") ? "yes" : "no"}`,
      `agent_test.ml_recovery_guided_search=${/busca de .*sopeira/i.test(recoveryReply) ? "yes" : "no"}`,
      `agent_test.ml_recovery_generic_form=${/me diga o produto, modelo, marca, cor ou sku/i.test(recoveryReply) ? "yes" : "no"}`,
      `agent_test.like_reply_loops=${/mostrar mais detalhes ou buscar opcoes parecidas/i.test(likeReply ?? "") ? "yes" : "no"}`,
      `agent_test.details_reply_is_rich=${/ceramica esmaltada|bom estado geral|uso a mesa|servir sopas e caldos/i.test(detailsReply) ? "yes" : "no"}`,
      `agent_test.details_reply_loops=${/mostrar mais detalhes ou buscar opcoes parecidas/i.test(detailsReply) ? "yes" : "no"}`,
    ],
  };
}

async function analyzeAgentTestShoppingBriefScenario(title: string): Promise<ScenarioResult> {
  const reply = buildAgentScopedRecoveryReply({
    message: "Presente",
    context: {
      ...baseContext,
      channel: { kind: "admin_agent_test" },
    },
    agent: {
      id: "agent-ml",
      nome: "Reliquia de familia",
      slug: null,
      projetoId: "proj-ml",
      modeloId: null,
      apiIds: [],
      configuracoes: {},
      arquivos: [],
      promptBase: "",
      createdAt: "",
      updatedAt: "",
      ativo: true,
      descricao: null,
    } as never,
    apiContexts: [],
    hasMercadoLivreConnector: true,
  });

  return {
    category: "mercado_livre",
    title,
    input: "Presente",
    observations: [
      `agent_test.shopping_brief_consultive=${/para quem e|qual estilo|faixa de valor/i.test(reply) ? "yes" : "no"}`,
      `agent_test.shopping_brief_avoids_sku_form=${/me diga o produto, modelo, marca, cor ou sku/i.test(reply) ? "no" : "yes"}`,
    ],
  };
}

async function analyzeAgentTestSameProductDetailsScenario(title: string): Promise<ScenarioResult> {
  const focusContext: ConversationContext = {
    ...baseContext,
    channel: { kind: "admin_agent_test" },
    catalogo: {
      ...baseContext.catalogo!,
      ultimaBusca: "jogo de jantar completo",
      produtoAtual: {
        id: "MLB1",
        nome: "Jogo De Jantar Porcelana Floral Filete Dourado 41 Pecas Branco Florido",
        descricao: "R$ 2990",
        preco: 2990,
        link: "https://produto.mercadolivre.com.br/MLB-4574498811-jogo-de-jantar-porcelana-floral-filete-dourado-41-pecas-branco-florido-_JM",
        imagem: "https://example.com/jantar.jpg",
        cardIndex: 0,
      },
      ultimosProdutos: [
        {
          id: "MLB1",
          nome: "Jogo De Jantar Porcelana Floral Filete Dourado 41 Pecas Branco Florido",
          descricao: "R$ 2990",
          preco: 2990,
          link: "https://produto.mercadolivre.com.br/MLB-4574498811-jogo-de-jantar-porcelana-floral-filete-dourado-41-pecas-branco-florido-_JM",
          imagem: "https://example.com/jantar.jpg",
          cardIndex: 0,
        },
        {
          id: "MLB3",
          nome: "Conjunto Bules Inox Meridional Com Bandeja Vintage Prateado",
          descricao: "R$ 290",
          preco: 290,
          link: "https://produto.mercadolivre.com.br/MLB-123-bules-_JM",
          imagem: "https://example.com/bules.jpg",
          cardIndex: 1,
        },
      ],
    },
  };

  const state = await resolveMercadoLivreHeuristicState({
    agentId: null,
    latestUserMessage: "Vc tem mais detalhes dele",
    context: focusContext,
    hasMercadoLivreConnector: true,
    leadNameReplyDetected: false,
    hasReferencedCatalogReply: false,
    productSearchRequested: false,
    genericMercadoLivreListingRequested: false,
    mercadoLivreListingProducts: [],
    mercadoLivreProducts: [],
    resolvedProductSearchTerm: "",
    productSearchTerm: "",
    loadMoreCatalogRequested: false,
    referencedCatalogProducts: [],
    currentCatalogProduct: focusContext.catalogo?.produtoAtual ?? null,
    catalogFollowUpDecision: null,
    lojaCta: null,
    deps: {
      normalizeText: normalizeFixtureText,
      isWhatsAppChannel: () => false,
    },
  });

  const reply = state.selectedProductSalesReply ?? "";
  const heuristicReply = resolveMercadoLivreHeuristicReply({
    context: focusContext,
    latestUserMessage: "Vc tem mais detalhes dele",
    agentId: "agent-1",
    agentName: "Reliquia de familia",
    selectedProductSalesReply: state.selectedProductSalesReply,
    salesFocusProduct: state.salesFocusProduct,
    selectedCatalogProduct: state.selectedCatalogProduct,
    mercadoLivreListingReply: state.mercadoLivreListingReply,
    mercadoLivreListingProductsForAssets: [],
    directMercadoLivreReply: state.directMercadoLivreReply,
    mercadoLivreProductsForAssets: [],
    currentProductForMetadata: state.currentProductForMetadata,
    mercadoLivreNoResultsReply: state.mercadoLivreNoResultsReply,
    formatReply: (value) => value,
    deps: {
      normalizeText: normalizeFixtureText,
      isWhatsAppChannel: () => false,
    },
  });

  return {
    category: "mercado_livre",
    title,
    input: "Gostei do jogo de jantar completo -> Vc tem mais detalhes dele",
    observations: [
      `agent_test.same_product_details_reply_present=${reply ? "yes" : "no"}`,
      `agent_test.same_product_mentions_jantar=${/jogo de jantar|41 pecas|2990/i.test(reply) ? "yes" : "no"}`,
      `agent_test.same_product_avoids_other_item=${/bules inox|meridional|290/i.test(reply) ? "no" : "yes"}`,
      `agent_test.same_product_focus_name=${state.salesFocusProduct?.nome ?? "none"}`,
      `agent_test.same_product_avoids_repeated_card=${(heuristicReply?.assets.length ?? 0) === 0 ? "yes" : "no"}`,
    ],
  };
}

async function analyzeMercadoLivreListingCopyScenario(title: string, context: ConversationContext): Promise<ScenarioResult> {
  const reply = buildMercadoLivreReply(loadCatalogProductsFromContext(context), context, {
    normalizeText: normalizeFixtureText,
    isWhatsAppChannel: () => true,
  });

  return {
    category: "mercado_livre",
    title,
    input: "[listagem enviada]",
    observations: [
      `listing.reply=${reply ?? "null"}`,
      `listing.requires_exact_word=${/me responda "mais"|basta responder "mais"/i.test(reply ?? "") ? "yes" : "no"}`,
      `listing.invites_free_follow_up=${/me diga se gostou|se gostar desse estilo|traga mais opcoes/i.test(reply ?? "") ? "yes" : "no"}`,
    ],
  };
}

async function analyzePipelineScenario(
  title: string,
  input: string,
  options?: {
    context?: ConversationContext;
    hasFocusedApiContext?: boolean;
    hasCatalogReferenceHeuristicReply?: boolean;
    hasMercadoLivreHeuristicReply?: boolean;
    leadNameAcknowledgementReply?: string | null;
    leadIdentificationReply?: string | null;
    catalogPricingReply?: string | null;
    hasMercadoLivreContext?: boolean;
  },
): Promise<ScenarioResult> {
  const context = options?.context ?? baseContext;
  const stageState = resolveConversationPipelineStageState({
    leadNameAcknowledgementReply: options?.leadNameAcknowledgementReply ?? null,
    hasCatalogReferenceHeuristicReply: options?.hasCatalogReferenceHeuristicReply ?? false,
    hasMercadoLivreHeuristicReply: options?.hasMercadoLivreHeuristicReply ?? false,
    catalogPricingReply: options?.catalogPricingReply ?? null,
    leadIdentificationReply: options?.leadIdentificationReply ?? null,
    hasValidAgent: true,
    hasOpenAiKey: true,
    hasFocusedApiContext: options?.hasFocusedApiContext ?? false,
    latestUserMessage: input,
    hasMemorySummary: Boolean(context.memoria?.resumo),
    hasCurrentCatalogContext: Boolean(context.catalogo?.produtoAtual || (context.catalogo?.ultimosProdutos?.length ?? 0) > 0),
    hasMercadoLivreContext: options?.hasMercadoLivreContext ?? false,
    hasLeadContext: Boolean(context.lead?.identificado || context.lead?.nome || context.lead?.telefone),
  });

  return {
    category: "pipeline",
    title,
    input,
    observations: [
      `classifier.heuristic_stage=${stageState.heuristicIntentStage}`,
      `classifier.route_stage=${stageState.orchestratorRouteStage}`,
      `classifier.domain_stage=${stageState.conversationDomainStage}`,
      `domain.max_output_tokens=${stageState.domainSupportState.maxOutputTokens}`,
      `domain.recent_message_window=${stageState.domainSupportState.recentMessageWindow}`,
    ],
  };
}

async function analyzeSearchFallbackScenario(title: string, input: string, context: ConversationContext): Promise<ScenarioResult> {
  const continueSearch = shouldContinueProductSearch(
    [
      { role: "assistant", content: "Encontrei algumas opcoes parecidas na loja logo abaixo." },
      { role: "user", content: input },
    ],
    input,
    context,
    {
      normalizeText: normalizeFixtureText,
      isGreetingOrAckMessage: () => false,
      shouldSearchProducts: () => false,
      buildProductSearchCandidates: deps.buildProductSearchCandidates,
    },
  );
  const connectorFallback = shouldUseMercadoLivreConnectorFallback(
    [{ role: "user", content: input }],
    input,
    context,
    {
      normalizeText: normalizeFixtureText,
      isGreetingOrAckMessage: () => false,
      buildProductSearchCandidates: deps.buildProductSearchCandidates,
      shouldSearchProducts: () => false,
      isLikelyLeadNameReply: () => false,
      extractName: () => null,
    },
  );

  return {
    category: "pipeline",
    title,
    input,
    observations: [
      `search.continue=${continueSearch}`,
      `search.connector_fallback=${connectorFallback}`,
      `context.last_search=${context.catalogo?.ultimaBusca || "none"}`,
    ],
  };
}

async function analyzeWhatsAppScenario(title: string, context: ConversationContext): Promise<ScenarioResult> {
  const canonicalId = resolveCanonicalWhatsAppExternalIdentifier({
    identificadorExterno: "270570709065941@lid",
    identificador: "270570709065941@lid",
    context,
  });
  const listingReply = buildMercadoLivreReply(loadCatalogProductsFromContext(context), context, {
    normalizeText: normalizeFixtureText,
    isWhatsAppChannel: () => true,
  });
  const sequence = buildWhatsAppMessageSequence(
    listingReply ?? "",
    loadCatalogProductsFromContext(context).map((item) => ({
      nome: item.nome,
      targetUrl: item.link,
      descricao: item.descricao,
      whatsappText: "Se esse estilo fizer sentido para voce, eu posso te explicar melhor este item.",
    })),
  );

  return {
    category: "whatsapp",
    title,
    input: "[mensagem inicial: vc tem jogo de jantar?]",
    observations: [
      `whatsapp.canonical_external_id=${canonicalId ?? "null"}`,
      `whatsapp.sequence_length=${sequence.length}`,
      `whatsapp.intro_has_follow_up=${/me diga se gostou de algum|traga mais opcoes/i.test(sequence[0] ?? "") ? "yes" : "no"}`,
      `whatsapp.first_product_has_link=${/(https?:\/\/)/i.test(sequence[1] ?? "") ? "yes" : "no"}`,
      `whatsapp.first_product_has_support=${/explicar melhor este item/i.test(sequence[1] ?? "") ? "yes" : "no"}`,
    ],
  };
}

async function analyzeApiLongContextScenario(title: string, input: string): Promise<ScenarioResult> {
  const focused = buildFocusedApiContext(input, apiRuntimeFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  });
  const reply = buildApiFallbackReply(input, apiRuntimeFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  });

  return {
    category: "api",
    title,
    input,
    observations: [
      `api.focused_fields=${focused.fields.length}`,
      `api.has_instructions=${focused.instructions ? "yes" : "no"}`,
      `api.reply_kind=${/Conclusao|Motivos|Proximo passo/i.test(reply ?? "") ? "analytical" : reply ? "direct" : "null"}`,
      `api.reply_mentions_risk=${/risco|riscos/i.test(reply ?? "") ? "yes" : "no"}`,
      `api.reply_mentions_next_step=${/Proximo passo/i.test(reply ?? "") ? "yes" : "no"}`,
    ],
  };
}

async function analyzeApiRealEstateScenario(title: string, input: string): Promise<ScenarioResult> {
  const focused = buildFocusedApiContext(input, apiRuntimeRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  });
  const reply = buildApiFallbackReply(input, apiRuntimeRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  });

  return {
    category: "api",
    title,
    input,
    observations: [
      `api.real_estate_fields=${focused.fields.length}`,
      `api.real_estate_reply_kind=${/Leitura inicial|Motivos|Proximo passo/i.test(reply ?? "") ? "analytical" : reply ? "direct" : "null"}`,
      `api.real_estate_reply_empathy=${/Faz sentido olhar isso com mais calma/i.test(reply ?? "") ? "yes" : "no"}`,
      `api.real_estate_mentions_risk=${/riscos|cartorio|matricula/i.test(reply ?? "") ? "yes" : "no"}`,
      `api.real_estate_mentions_date=${/📅|27\/03\/2026/i.test(reply ?? "") ? "yes" : "no"}`,
      `api.real_estate_avoids_restart=${/Sigo por aqui no contexto|Me diga o ponto exato que voce quer validar/i.test(reply ?? "") ? "no" : "yes"}`,
      `api.real_estate_avoids_raw_iso_date=${/2026-03-27T16:00:00Z/i.test(reply ?? "") ? "no" : "yes"}`,
    ],
  };
}

async function analyzeApiDateThenAnalysisScenario(title: string): Promise<ScenarioResult> {
  const dateReply = buildApiFallbackReply("existe algum processo desse imovel e me passa as datas do leilao", apiRuntimeRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  });

  const analysisReply = buildApiFallbackReply("sera que vale apena", apiRuntimeRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  });

  const focusedContinuation = buildFocusedApiContext("sim segue", apiRuntimeRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  });

  const continuationReply = buildApiContinuationFallbackReply(apiRuntimeRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  });

  return {
    category: "api",
    title,
    input: "datas do leilao -> sera que vale apena -> sim segue",
    observations: [
      `api.date_reply_has_icon=${/📅/.test(dateReply ?? "") ? "yes" : "no"}`,
      `api.date_reply_has_normalized_date=${/27\/03\/2026/.test(dateReply ?? "") ? "yes" : "no"}`,
      `api.analysis_reply_empathy=${/Faz sentido olhar isso com mais calma/i.test(analysisReply ?? "") ? "yes" : "no"}`,
      `api.analysis_reply_mentions_date=${/📅|27\/03\/2026/i.test(analysisReply ?? "") ? "yes" : "no"}`,
      `api.continuation_context_fields=${focusedContinuation.fields.length}`,
      `api.continuation_reply_contextual=${/Faz sentido olhar isso com mais calma|Leitura inicial|Motivos/i.test(continuationReply ?? "") ? "yes" : "no"}`,
      `api.continuation_avoids_restart=${/Sigo por aqui no contexto|Me diga o ponto exato que voce quer validar/i.test(continuationReply ?? "") ? "no" : "yes"}`,
    ],
  };
}

async function analyzeExternalWidgetApiSequenceScenario(title: string): Promise<ScenarioResult> {
  const messages = [
    "existe algum processo desse imovel e me passa as datas do leilao",
    "sera que vale apena",
    "sim segue",
  ];

  const replies = [
    buildApiFallbackReply(messages[0], apiRuntimeRealEstateFixture.apis, {
      normalizeText: normalizeFixtureText,
      buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
      singularizeToken: (value) => value,
    }),
    buildApiFallbackReply(messages[1], apiRuntimeRealEstateFixture.apis, {
      normalizeText: normalizeFixtureText,
      buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
      singularizeToken: (value) => value,
    }),
    buildApiContinuationFallbackReply(apiRuntimeRealEstateFixture.apis, {
      normalizeText: normalizeFixtureText,
      buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
      singularizeToken: (value) => value,
    }),
  ];

  const restartCount = replies.filter((reply) => /Sigo por aqui no contexto|Me diga o ponto exato que voce quer validar/i.test(reply ?? "")).length;
  const empatheticCount = replies.filter((reply) => /Faz sentido olhar isso com mais calma/i.test(reply ?? "")).length;
  const normalizedDateCount = replies.filter((reply) => /27\/03\/2026/.test(reply ?? "")).length;

  return {
    category: "api",
    title,
    input: messages.join(" -> "),
    observations: [
      `api.sequence_restart_count=${restartCount}`,
      `api.sequence_empathy_count=${empatheticCount}`,
      `api.sequence_normalized_date_count=${normalizedDateCount}`,
      `api.sequence_all_contextual=${restartCount === 0 ? "yes" : "no"}`,
    ],
  };
}

async function analyzeApiContinuationRecoveryScenario(title: string, inputs: string[]): Promise<ScenarioResult> {
  const observations = inputs.map((input) => {
    const reply = buildApiContinuationFallbackReply(apiRuntimeRealEstateFixture.apis, {
      normalizeText: normalizeFixtureText,
      buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
      singularizeToken: (value) => value,
    });

    return `${input} => ${/Faz sentido olhar isso com mais calma|Leitura inicial|Motivos/i.test(reply ?? "") ? "contextual" : "generic"}`;
  });

  return {
    category: "api",
    title,
    input: inputs.join(" | "),
    observations,
  };
}

async function analyzeApiFocusedContinuationScenario(title: string, input: string): Promise<ScenarioResult> {
  const focused = buildFocusedApiContext(input, apiRuntimeRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  });

  const stageState = resolveConversationPipelineStageState({
    leadNameAcknowledgementReply: null,
    hasCatalogReferenceHeuristicReply: false,
    hasMercadoLivreHeuristicReply: false,
    catalogPricingReply: null,
    leadIdentificationReply: null,
    hasValidAgent: true,
    hasOpenAiKey: true,
    hasFocusedApiContext: focused.fields.length > 0 || Boolean(focused.instructions),
    latestUserMessage: input,
    hasMemorySummary: true,
    semanticApiIntentStage: null,
    semanticCatalogIntentStage: null,
    hasCurrentCatalogContext: false,
    hasMercadoLivreContext: false,
    hasLeadContext: false,
  });

  return {
    category: "api",
    title,
    input,
    observations: [
      `api.focused_fields=${focused.fields.length}`,
      `api.focused_has_continuation_instruction=${/continuidade curta|contexto factual/i.test(focused.instructions) ? "yes" : "no"}`,
      `classifier.domain_stage=${stageState.conversationDomainStage}`,
      `classifier.route_stage=${stageState.orchestratorRouteStage}`,
    ],
  };
}

async function main() {
  const scenarios: ScenarioResult[] = [];

  scenarios.push(await analyzeCatalogScenario("Contexto normal: item recente resolvido", "gostei da sopeira que mandou", baseContext));
  scenarios.push(await analyzeCatalogScenario("Fora da normalidade: typo forte", "gostei da dopeira que mandou", baseContext));
  scenarios.push(await analyzeCatalogScenario("Fora da normalidade: mensagem curta neutra", "oi", baseContext));
  scenarios.push(await analyzeCatalogScenario("Fora da normalidade: ambiguidade por cor", "quero o amarelo", baseContext));
  scenarios.push(await analyzeCatalogScenario("Catalogo: referencia por preco curto", "quero o de 250", baseContext));
  scenarios.push(
    await analyzeSemanticCatalogPipelineScenario(
      "Pipeline semantico: pergunta sobre produto em foco continua na venda",
      "tem garantia?",
      baseContext,
      "product_question",
    ),
  );
  scenarios.push(
    await analyzeSemanticCatalogPipelineScenario(
      "Pipeline semantico: rejeicao do produto atual pede nova vitrine",
      "nao gostei desse",
      baseContext,
      "product_rejection",
    ),
  );

  scenarios.push(
    await analyzeMercadoLivreScenario(
      "Fluxo ML: detalhe do produto em foco",
      "tem garantia?",
      baseContext,
      {
        kind: "recent_product_reference",
        confidence: 0.9,
        reason: "produto atual em foco",
        matchedProducts: [baseContext.catalogo!.ultimosProdutos![1]!],
        usedLlm: false,
        shouldBlockNewSearch: true,
      },
    ),
  );

  scenarios.push(
    await analyzeMercadoLivreScenario(
      "Fluxo ML fora da normalidade: busca nova legitima",
      "tem prato azul?",
      baseContext,
      {
        kind: "new_product_search",
        confidence: 0.8,
        reason: "nova busca legitima",
        matchedProducts: [],
        usedLlm: false,
        shouldBlockNewSearch: false,
      },
    ),
  );
  scenarios.push(
    await analyzeMercadoLivreScenario(
      "Fluxo ML: vitrine reaproveita busca anterior em vez de abrir lista generica",
      "exiba seus produtos pra mim",
      {
        ...baseContext,
        channel: { kind: "admin_agent_test" },
        catalogo: {
          ...baseContext.catalogo!,
          ultimaBusca: "sopeira",
        },
      },
      null,
    ),
  );

  scenarios.push(
    await analyzeMercadoLivreScenario(
      "Fluxo ML fora da normalidade: referencia vaga sem produto cravado",
      "a que mandou",
      baseContext,
      {
        kind: "recent_product_reference_ambiguous",
        confidence: 0.5,
        reason: "ambiguo",
        matchedProducts: [],
        usedLlm: false,
        shouldBlockNewSearch: true,
      },
    ),
  );
  scenarios.push(await analyzeMercadoLivreCommercialScenario("Fluxo ML: produto em foco vira conversa consultiva", "acho que combina comigo", baseContext));
  scenarios.push(await analyzeAgentTestFocusedProductScenario("Agent test: pergunta tecnica sobre produto em foco nao entra em loop", "ela e resistente vc sabe o material dela"));
  scenarios.push(await analyzeAgentTestFocusedProductScenario("Agent test: pergunta de uso diario mantem venda consultiva", "serve para uso diario?"));
  scenarios.push(await analyzeAgentTestPostSingleProductDeliveryScenario("Agent test: apos entregar produto unico o follow-up tecnico nao se perde"));
  scenarios.push(await analyzeAgentTestSameProductDetailsScenario("Agent test: pedir mais detalhes depois do produto escolhido mantem o mesmo item"));
  scenarios.push(await analyzeAgentTestShoppingBriefScenario("Agent test: contexto curto de compra vira brief comercial"));
  scenarios.push(await analyzeAgentTestConversationDiagnosticScenario("Agent test: diagnostico do papo real de sopeira"));
  scenarios.push(await analyzeMercadoLivreListingCopyScenario("Fluxo ML: copy humana apos envio de lista", baseContext));
  scenarios.push(await analyzeWhatsAppScenario("WhatsApp: identidade canonica e lista inicial com frase humana", whatsappContext));
  scenarios.push(
    await analyzePipelineScenario("WhatsApp: continuidade curta apos lista continua no catalogo em vez de reiniciar atendimento", "sim", {
      context: whatsappContext,
      hasMercadoLivreContext: true,
    }),
  );

  const staleContext: ConversationContext = {
    ...baseContext,
    memoria: { mensagem_count: 50 },
    catalogo: {
      ...baseContext.catalogo,
      snapshotTurnId: 1,
      snapshotCreatedAt: "2024-01-01T00:00:00.000Z",
    },
  };
  scenarios.push(await analyzeCatalogScenario("Fora da normalidade: snapshot antigo demais", "gostei da sopeira", staleContext));

  const apiContext: ConversationContext = {
    ...baseContext,
    catalogo: undefined,
    memoria: { mensagem_count: 18, resumo: '{"objetivo":"consultar dados","lead":null,"restricoes":"usa api","proximo_passo":"validar status"}' },
  };
  scenarios.push(
    await analyzePipelineScenario("Pipeline: pergunta factual com sinal de API", "qual o status do processo?", {
      context: apiContext,
      hasFocusedApiContext: true,
    }),
  );
  scenarios.push(
    await analyzeApiLongContextScenario(
      "Pipeline: follow-up analitico longo de API mantem contexto e conclusao",
      "entendi, mas eu preciso saber com mais clareza se vale a pena entrar nisso agora, considerando risco, cartorio, matricula, custo total e se existe algum ponto que possa atrapalhar depois",
    ),
  );
  scenarios.push(
    await analyzeApiRealEstateScenario(
      "Pipeline: API de imovel responde vale a pena com mais empatia e contexto",
      "sera que vale apena",
    ),
  );
  scenarios.push(await analyzeApiDateThenAnalysisScenario("Pipeline: data do leilao -> vale a pena -> continuidade curta mantem contexto"));
  scenarios.push(await analyzeExternalWidgetApiSequenceScenario("Pipeline: sequencia completa do widget externo evita reinicio generico"));
  scenarios.push(
    await analyzeApiContinuationRecoveryScenario(
      "Pipeline: follow-up curto de API nao depende de frase fixa",
      ["sim segue", "pode continuar", "quero entender melhor isso"],
    ),
  );
  scenarios.push(
    await analyzeApiFocusedContinuationScenario(
      "Pipeline: follow-up curto de API mantem contexto factual ativo",
      "sim segue",
    ),
  );
  scenarios.push(
    await analyzePipelineScenario("Pipeline: continuidade curta de lead com memoria", "sim", {
      context: {
        ...apiContext,
        lead: { identificado: true, nome: "Carlos", telefone: "11999999999" },
      },
    }),
  );
  scenarios.push(
    await analyzePipelineScenario("Pipeline: detalhe curto com catalogo vivo", "garantia", {
      context: baseContext,
      hasCatalogReferenceHeuristicReply: false,
      hasMercadoLivreHeuristicReply: false,
      hasMercadoLivreContext: true,
    }),
  );
  scenarios.push(
    await analyzePipelineScenario("Pipeline: identificacao explicita de lead", "meu nome e Carlos", {
      context: { ...baseContext, catalogo: undefined, memoria: { mensagem_count: 4, resumo: null } },
      leadIdentificationReply: "Qual seu nome?",
    }),
  );
  scenarios.push(
    await analyzePipelineScenario("Pipeline: resposta comercial de catalogo sem referencia textual forte", "quero esse", {
      context: baseContext,
      hasMercadoLivreHeuristicReply: true,
      hasMercadoLivreContext: true,
    }),
  );
  scenarios.push(
    await analyzeSearchFallbackScenario("Pipeline: continuidade comercial curta nao dispara busca solta", "gostei desse", {
      ...baseContext,
      catalogo: {
        ...baseContext.catalogo!,
        ultimaBusca: "",
      },
    }),
  );

  await persistScenarioHistory(scenarios);

  console.log("\nChat Intelligence Scenario Report\n");
  for (const scenario of scenarios) {
    console.log(`Scenario: ${scenario.title}`);
    console.log(`Input: ${scenario.input}`);
    for (const observation of scenario.observations) {
      console.log(`- ${observation}`);
    }
    console.log("");
  }

  console.log(`${scenarios.length} scenarios analyzed.`);
}

async function persistScenarioHistory(scenarios: ScenarioResult[]) {
  const timestamp = new Date().toISOString();
  const safeTimestamp = timestamp.replace(/[:.]/g, "-");
  const historyFilePath = path.resolve(process.cwd(), "analises", `analise-chat-test-${safeTimestamp}.md`);
  const categorySummary = summarizeByCategory(scenarios);
  const tokenEstimate = estimateScenarioTokenUsage(scenarios);
  const body = [
    "# Chat Test History",
    "",
    "Este arquivo registra uma execucao isolada do runner de cenarios da inteligencia do chat.",
    "",
    `## Execucao ${timestamp}`,
    "",
    "## Resumo",
    "",
    ...categorySummary.map((item) => `- ${item}`),
    `- estimativa_tokens_total: ${tokenEstimate.totalTokens}`,
    `- estimativa_tokens_input: ${tokenEstimate.inputTokens}`,
    `- estimativa_tokens_observacoes: ${tokenEstimate.observationTokens}`,
    "",
    ...scenarios.flatMap((scenario) => [
      `### [${scenario.category}] ${scenario.title}`,
      `Input: \`${scenario.input}\``,
      `Estimativa de tokens: ${estimateTextTokens(`${scenario.title}\n${scenario.input}\n${scenario.observations.join("\n")}`)}`,
      ...scenario.observations.map((observation) => `- ${observation}`),
      "",
    ]),
  ].join("\n");

  await writeFile(historyFilePath, `${body}\n`, "utf8");
  console.log(`History file: ${historyFilePath}`);
}

function summarizeByCategory(scenarios: ScenarioResult[]) {
  const counts = new Map<string, number>();

  for (const scenario of scenarios) {
    counts.set(scenario.category, (counts.get(scenario.category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([category, count]) => `${category}: ${count} cenarios`);
}

function loadCatalogProductsFromContext(context: ConversationContext) {
  return (context.catalogo?.ultimosProdutos ?? []).map((item) => ({
    id: item.id ?? "",
    nome: item.nome ?? "Produto",
    preco: Number(item.preco ?? 0),
    link: item.link ?? "",
    imagem: item.imagem ?? "",
    publicadoEm: null,
    descricao: item.descricao ?? "",
    atributos: [],
    pertenceALoja: true,
  }));
}

function estimateScenarioTokenUsage(scenarios: ScenarioResult[]) {
  let inputTokens = 0;
  let observationTokens = 0;

  for (const scenario of scenarios) {
    inputTokens += estimateTextTokens(`${scenario.title}\n${scenario.input}`);
    observationTokens += estimateTextTokens(scenario.observations.join("\n"));
  }

  return {
    inputTokens,
    observationTokens,
    totalTokens: inputTokens + observationTokens,
  };
}

function estimateTextTokens(text: string) {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.length / 4));
}

main().catch((error) => {
  console.error("Scenario runner failed.");
  console.error(error);
  process.exit(1);
});



