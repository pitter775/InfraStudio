import assert from "node:assert/strict";

import {
  buildAmbiguousCatalogReferenceReply,
  decideCatalogFollowUpHeuristically,
  resolveCatalogReferenceHeuristicReply,
  resolveRecentCatalogProductReference,
  type CatalogFollowUpDecision,
} from "@/lib/catalog-follow-up";
import type { ConversationContext } from "@/lib/chat-context";
import { resolveConversationContextStageState } from "@/lib/chat-context-stage";
import { resolveConversationDomainSupportState } from "@/lib/chat-domain-stage";
import { classifyConversationDomainStage, classifyHeuristicIntentStage, classifyOrchestratorRouteStage } from "@/lib/chat-intent-classifier";
import { buildOpenAiStageRequestPayload } from "@/lib/chat-openai-stage";
import { resolveConversationPipelineStageState } from "@/lib/chat-pipeline-stage";
import { shouldRefreshSummary } from "@/lib/chat-summary-stage";
import { buildChatUsageOrigin, buildChatUsageTelemetry, describeChatUsageOrigin, readChatUsageTelemetry } from "@/lib/chat-usage-metrics";
import {
  resolveMercadoLivreFlowState,
  resolveMercadoLivreHeuristicReply,
  resolveMercadoLivreHeuristicState,
} from "@/lib/chat-mercado-livre";
import {
  createFixtureSearchDeps,
  loadApiRuntimeFixture,
  loadCatalogContextFixture,
  loadMercadoLivreFixture,
  normalizeFixtureText,
} from "@/tests/chat-test-fixtures";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const deps = createFixtureSearchDeps();
const recentCatalogContext: ConversationContext = loadCatalogContextFixture();
const mercadoLivreFixture = loadMercadoLivreFixture();
const apiRuntimeFixture = loadApiRuntimeFixture();

const tests: TestCase[] = [
  {
    name: "follow-up escolhe a sopeira ja mostrada",
    run: () => {
      const decision = decideCatalogFollowUpHeuristically("gostei da sopeira que mandou", recentCatalogContext, deps);
      assert.ok(decision);
      assert.equal(decision.kind, "recent_product_reference");
      assert.equal(decision.matchedProducts[0]?.id, "MLB2");
      assert.equal(decision.shouldBlockNewSearch, true);
    },
  },
  {
    name: "referencia com typo ainda encontra sopeira pelo contexto",
    run: () => {
      const products = resolveRecentCatalogProductReference("gostei da dopeira que mandou", recentCatalogContext);
      assert.equal(products.length, 1);
      assert.equal(products[0]?.id, "MLB2");
    },
  },
  {
    name: "saudacao curta nao vira busca nova",
    run: () => {
      const decision = decideCatalogFollowUpHeuristically("oi", recentCatalogContext, deps);
      assert.ok(decision);
      assert.equal(decision.kind, "non_catalog_message");
      assert.equal(decision.shouldBlockNewSearch, true);
    },
  },
  {
    name: "pedido de mais opcoes continua o lote anterior",
    run: () => {
      const decision = decideCatalogFollowUpHeuristically("quero mais opcoes", recentCatalogContext, deps);
      assert.ok(decision);
      assert.equal(decision.kind, "load_more_results");
    },
  },
  {
    name: "referencia por preco encontra o item certo",
    run: () => {
      const products = resolveRecentCatalogProductReference("quero o de 250", recentCatalogContext);
      assert.equal(products.length, 1);
      assert.equal(products[0]?.id, "MLB2");
    },
  },
  {
    name: "referencia por cor compartilhada volta ambigua",
    run: () => {
      const decision = decideCatalogFollowUpHeuristically("quero o amarelo", recentCatalogContext, deps);
      assert.ok(decision);
      assert.equal(decision.kind, "recent_product_reference_ambiguous");
      assert.equal(decision.matchedProducts.length, 2);
    },
  },
  {
    name: "snapshot antigo bloqueia resolucao textual de catalogo recente",
    run: () => {
      const staleContext: ConversationContext = {
        ...recentCatalogContext,
        memoria: { mensagem_count: 50 },
        catalogo: {
          ...recentCatalogContext.catalogo!,
          snapshotTurnId: 1,
          snapshotCreatedAt: "2024-01-01T00:00:00.000Z",
        },
      };

      const products = resolveRecentCatalogProductReference("gostei da sopeira", staleContext);
      assert.equal(products.length, 0);
    },
  },
  {
    name: "fixtures carregam laboratorio base de catalogo api e mercado livre",
    run: () => {
      assert.equal(recentCatalogContext.catalogo?.ultimosProdutos?.length, 3);
      assert.equal(mercadoLivreFixture.listingProducts.length, 3);
      assert.equal(mercadoLivreFixture.detailedProducts[0]?.garantia, "90 dias");
      assert.equal(apiRuntimeFixture.apis.length, 2);
      assert.equal(apiRuntimeFixture.apis[0]?.campos[1]?.valor, "disponivel");
    },
  },
  {
    name: "telemetria de uso classifica origem com canal provider rota e dominio",
    run: () => {
      const origin = buildChatUsageOrigin({
        channelKind: "whatsapp",
        provider: "openai",
        routeStage: "openai",
        domainStage: "catalog_commerce",
      });

      assert.equal(origin, "chat:whatsapp:openai:openai:catalog_commerce");
      assert.equal(describeChatUsageOrigin(origin), "whatsapp / openai / openai / catalog_commerce");
    },
  },
  {
    name: "telemetria de uso preserva tokens e permite leitura do metadata salvo",
    run: () => {
      const usageTelemetry = buildChatUsageTelemetry({
        channelKind: "web",
        provider: "heuristic",
        model: "catalog_reference",
        routeStage: "heuristic",
        heuristicStage: "catalog_reference",
        domainStage: "catalog_commerce",
        inputTokens: 12,
        outputTokens: 34,
        estimatedCostUsd: 0.0123,
      });

      const parsed = readChatUsageTelemetry({ usageTelemetry });
      assert.ok(parsed);
      assert.equal(parsed.billingOrigin, "chat:web:heuristic:heuristic:catalog_commerce");
      assert.equal(parsed.totalTokens, 46);
      assert.equal(parsed.estimatedCostUsd, 0.0123);
      assert.equal(parsed.heuristicStage, "catalog_reference");
    },
  },
  {
    name: "flow state segura referencia recente e bloqueia busca nova",
    run: () => {
      const decision: CatalogFollowUpDecision = {
        kind: "recent_product_reference",
        confidence: 0.9,
        reason: "referencia resolvida",
        matchedProducts: [recentCatalogContext.catalogo!.ultimosProdutos![1]!],
        usedLlm: false,
        shouldBlockNewSearch: true,
      };

      const flow = resolveMercadoLivreFlowState({
        latestUserMessage: "gostei da sopeira",
        context: recentCatalogContext,
        hasMercadoLivreConnector: true,
        leadNameReplyDetected: false,
        recentCatalogProducts: recentCatalogContext.catalogo!.ultimosProdutos ?? [],
        catalogFollowUpDecision: decision,
        detectProductSearch: () => true,
        buildProductSearchCandidates: deps.buildProductSearchCandidates,
        resolveRecentCatalogProductReference,
        isRecentCatalogReferenceAttempt: () => true,
        isMercadoLivreListingIntent: () => false,
        shouldUseMercadoLivreConnectorFallback: () => true,
      });

      assert.equal(flow.productSearchRequested, false);
      assert.equal(flow.referencedCatalogProducts.length, 1);
      assert.equal(flow.referencedCatalogProducts[0]?.id, "MLB2");
    },
  },
  {
    name: "flow state libera nova busca legitima",
    run: () => {
      const decision: CatalogFollowUpDecision = {
        kind: "new_product_search",
        confidence: 0.8,
        reason: "nova busca",
        matchedProducts: [],
        usedLlm: false,
        shouldBlockNewSearch: false,
      };

      const flow = resolveMercadoLivreFlowState({
        latestUserMessage: "tem prato azul?",
        context: recentCatalogContext,
        hasMercadoLivreConnector: true,
        leadNameReplyDetected: false,
        recentCatalogProducts: recentCatalogContext.catalogo!.ultimosProdutos ?? [],
        catalogFollowUpDecision: decision,
        detectProductSearch: () => true,
        buildProductSearchCandidates: deps.buildProductSearchCandidates,
        resolveRecentCatalogProductReference,
        isRecentCatalogReferenceAttempt: () => false,
        isMercadoLivreListingIntent: () => false,
        shouldUseMercadoLivreConnectorFallback: () => true,
      });

      assert.equal(flow.productSearchRequested, true);
      assert.deepEqual(flow.productSearchCandidates, ["prato azul"]);
      assert.equal(flow.productSearchTerm, "prato azul");
    },
  },
  {
    name: "heuristic state entende referencia ambigua sem chamar API",
    run: async () => {
      const state = await resolveMercadoLivreHeuristicState({
        agentId: null,
        latestUserMessage: "a que mandou",
        context: recentCatalogContext,
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
        currentCatalogProduct: recentCatalogContext.catalogo?.produtoAtual ?? null,
        catalogFollowUpDecision: {
          kind: "recent_product_reference_ambiguous",
          confidence: 0.5,
          reason: "ambiguo",
          matchedProducts: [],
          usedLlm: false,
          shouldBlockNewSearch: true,
        },
        lojaCta: null,
        deps: {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => false,
        },
      });

      assert.ok(state.ambiguousCatalogReferenceReply);
      assert.ok(state.ambiguousCatalogReferenceReply?.includes("numero do card"));
    },
  },
  {
    name: "heuristic reply comercial devolve metadata e trace do produto",
    run: () => {
      const reply = resolveMercadoLivreHeuristicReply({
        context: recentCatalogContext,
        latestUserMessage: "gostei dessa",
        agentId: "agent-1",
        agentName: "Agent",
        selectedProductSalesReply: "Boa escolha. Seguem detalhes.",
        salesFocusProduct: {
          id: "MLB2",
          nome: "Jogo de Sopeira Completo",
          preco: 250,
          link: "https://example.com/sopeira",
          imagem: "https://example.com/sopeira.jpg",
          publicadoEm: null,
          descricao: "Sopeira amarela",
          atributos: [],
          pertenceALoja: true,
        },
        selectedCatalogProduct: recentCatalogContext.catalogo?.produtoAtual ?? null,
        mercadoLivreListingReply: null,
        mercadoLivreListingProductsForAssets: [],
        directMercadoLivreReply: null,
        mercadoLivreProductsForAssets: [],
        currentProductForMetadata: null,
        mercadoLivreNoResultsReply: null,
        formatReply: (reply) => reply,
        deps: {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => false,
        },
      });

      assert.ok(reply);
      assert.equal(reply?.mode, "mercado_livre_product_sales");
      assert.equal(reply?.metadata.catalogoProdutoAtual?.id, "MLB2");
      assert.equal(reply?.tracePayload?.productId, "MLB2");
    },
  },
  {
    name: "heuristic reply de sem resultado responde corretamente",
    run: () => {
      const reply = resolveMercadoLivreHeuristicReply({
        context: recentCatalogContext,
        latestUserMessage: "tem prato azul?",
        agentId: "agent-1",
        agentName: "Agent",
        selectedProductSalesReply: null,
        salesFocusProduct: null,
        selectedCatalogProduct: null,
        mercadoLivreListingReply: null,
        mercadoLivreListingProductsForAssets: [],
        directMercadoLivreReply: null,
        mercadoLivreProductsForAssets: [],
        currentProductForMetadata: null,
        mercadoLivreNoResultsReply: 'Nao encontrei resultados para "prato azul".',
        formatReply: (reply) => reply,
        deps: {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => false,
        },
      });

      assert.ok(reply);
      assert.equal(reply?.mode, "mercado_livre_no_results");
      assert.equal(reply?.assets.length, 0);
    },
  },
  {
    name: "catalog reference heuristic reply devolve item atual e trace",
    run: () => {
      const reply = resolveCatalogReferenceHeuristicReply({
        context: recentCatalogContext,
        agentId: "agent-1",
        agentName: "Agent",
        referencedCatalogProducts: [recentCatalogContext.catalogo!.ultimosProdutos![1]!],
        ambiguousCatalogReferenceReply: null,
        formatReply: (reply) => reply,
      });

      assert.ok(reply);
      assert.equal(reply?.mode, "catalog_reference_resolution");
      assert.equal(reply?.metadata.catalogoProdutoAtual?.id, "MLB2");
      assert.equal(reply?.tracePayload?.matchedCount, 1);
    },
  },
  {
    name: "catalog reference heuristic reply ambiguo devolve cards recentes",
    run: () => {
      const reply = resolveCatalogReferenceHeuristicReply({
        context: recentCatalogContext,
        agentId: "agent-1",
        agentName: "Agent",
        referencedCatalogProducts: [],
        ambiguousCatalogReferenceReply: buildAmbiguousCatalogReferenceReply(recentCatalogContext),
        formatReply: (reply) => reply,
      });

      assert.ok(reply);
      assert.equal(reply?.mode, "catalog_reference_ambiguous");
      assert.ok((reply?.assets.length ?? 0) > 0);
      assert.equal(reply?.tracePayload?.recentCount, 3);
    },
  },
  {
    name: "classificador heuristico prioriza nome do lead antes dos outros caminhos",
    run: () => {
      const stage = classifyHeuristicIntentStage({
        leadNameAcknowledgementReply: "Prazer, Carlos.",
        hasCatalogReferenceHeuristicReply: true,
        hasMercadoLivreHeuristicReply: true,
        catalogPricingReply: "Tabela de preco",
        leadIdentificationReply: "Qual seu nome?",
      });

      assert.equal(stage, "lead_name_acknowledgement");
    },
  },
  {
    name: "classificador heuristico prioriza catalogo antes de Mercado Livre",
    run: () => {
      const stage = classifyHeuristicIntentStage({
        leadNameAcknowledgementReply: null,
        hasCatalogReferenceHeuristicReply: true,
        hasMercadoLivreHeuristicReply: true,
        catalogPricingReply: null,
        leadIdentificationReply: null,
      });

      assert.equal(stage, "catalog_reference");
    },
  },
  {
    name: "classificador heuristico devolve none quando nao ha caminho ativo",
    run: () => {
      const stage = classifyHeuristicIntentStage({
        leadNameAcknowledgementReply: null,
        hasCatalogReferenceHeuristicReply: false,
        hasMercadoLivreHeuristicReply: false,
        catalogPricingReply: null,
        leadIdentificationReply: null,
      });

      assert.equal(stage, "none");
    },
  },
  {
    name: "classificador de rota envia para guardrail quando nao ha chave openai",
    run: () => {
      const stage = classifyOrchestratorRouteStage({
        hasValidAgent: true,
        heuristicIntentStage: "none",
        hasOpenAiKey: false,
      });

      assert.equal(stage, "guardrail_no_openai");
    },
  },
  {
    name: "classificador de rota prioriza heuristica antes de openai",
    run: () => {
      const stage = classifyOrchestratorRouteStage({
        hasValidAgent: true,
        heuristicIntentStage: "catalog_reference",
        hasOpenAiKey: true,
      });

      assert.equal(stage, "catalog_reference");
    },
  },
  {
    name: "classificador de rota cai em openai quando nao ha heuristica",
    run: () => {
      const stage = classifyOrchestratorRouteStage({
        hasValidAgent: true,
        heuristicIntentStage: "none",
        hasOpenAiKey: true,
      });

      assert.equal(stage, "openai");
    },
  },
  {
    name: "classificador de rota bloqueia agente invalido antes das demais fases",
    run: () => {
      const stage = classifyOrchestratorRouteStage({
        hasValidAgent: false,
        heuristicIntentStage: "catalog_reference",
        hasOpenAiKey: true,
      });

      assert.equal(stage, "inactive_or_invalid_agent");
    },
  },
  {
    name: "classificador de dominio entende catalogo comercial",
    run: () => {
      const stage = classifyConversationDomainStage({
        heuristicIntentStage: "catalog_reference",
        hasFocusedApiContext: false,
        latestUserMessage: "gostei dessa",
        hasMemorySummary: false,
        hasCurrentCatalogContext: true,
        hasLeadContext: false,
      });

      assert.equal(stage, "catalog_commerce");
    },
  },
  {
    name: "classificador de dominio entende api runtime sem heuristica",
    run: () => {
      const stage = classifyConversationDomainStage({
        heuristicIntentStage: "none",
        hasFocusedApiContext: true,
        latestUserMessage: "qual o status",
        hasMemorySummary: false,
        hasCurrentCatalogContext: false,
        hasLeadContext: false,
      });

      assert.equal(stage, "api_runtime");
    },
  },
  {
    name: "classificador de dominio entende lead qualification",
    run: () => {
      const stage = classifyConversationDomainStage({
        heuristicIntentStage: "lead_identification",
        hasFocusedApiContext: false,
        latestUserMessage: "sou carlos",
        hasMemorySummary: true,
        hasCurrentCatalogContext: false,
        hasLeadContext: true,
      });

      assert.equal(stage, "lead_qualification");
    },
  },
  {
    name: "classificador de dominio usa memoria de lead para continuidade curta",
    run: () => {
      const stage = classifyConversationDomainStage({
        heuristicIntentStage: "none",
        hasFocusedApiContext: false,
        latestUserMessage: "sim",
        hasMemorySummary: true,
        hasCurrentCatalogContext: false,
        hasLeadContext: true,
      });

      assert.equal(stage, "lead_qualification");
    },
  },
  {
    name: "classificador de dominio usa contexto de catalogo para continuidade curta",
    run: () => {
      const stage = classifyConversationDomainStage({
        heuristicIntentStage: "none",
        hasFocusedApiContext: false,
        latestUserMessage: "garantia",
        hasMemorySummary: false,
        hasCurrentCatalogContext: true,
        hasLeadContext: false,
      });

      assert.equal(stage, "catalog_commerce");
    },
  },
  {
    name: "suporte de dominio amplia resposta comercial de catalogo",
    run: () => {
      const support = resolveConversationDomainSupportState({
        domainStage: "catalog_commerce",
        hasMercadoLivreContext: true,
        hasFocusedApiContext: false,
        hasLeadContext: false,
      });

      assert.equal(support.maxOutputTokens, 260);
      assert.equal(support.recentMessageWindow, 4);
      assert.match(support.instruction, /catalogo e comercio/i);
    },
  },
  {
    name: "suporte de dominio enxuga resposta de qualificacao",
    run: () => {
      const support = resolveConversationDomainSupportState({
        domainStage: "lead_qualification",
        hasMercadoLivreContext: false,
        hasFocusedApiContext: false,
        hasLeadContext: true,
      });

      assert.equal(support.maxOutputTokens, 180);
      assert.equal(support.recentMessageWindow, 3);
      assert.match(support.instruction, /qualificacao de lead/i);
    },
  },
  {
    name: "pipeline stage combina heuristica dominio rota e suporte",
    run: () => {
      const stageState = resolveConversationPipelineStageState({
        leadNameAcknowledgementReply: null,
        hasCatalogReferenceHeuristicReply: false,
        hasMercadoLivreHeuristicReply: true,
        catalogPricingReply: null,
        leadIdentificationReply: null,
        hasValidAgent: true,
        hasOpenAiKey: true,
        hasFocusedApiContext: false,
        hasMercadoLivreContext: true,
        hasLeadContext: false,
        latestUserMessage: "gostei da sopeira",
        hasMemorySummary: false,
        hasCurrentCatalogContext: true,
      });

      assert.equal(stageState.heuristicIntentStage, "mercado_livre");
      assert.equal(stageState.conversationDomainStage, "catalog_commerce");
      assert.equal(stageState.orchestratorRouteStage, "mercado_livre");
      assert.equal(stageState.domainSupportState.maxOutputTokens, 260);
    },
  },
  {
    name: "builder openai monta payload com dominio e historico recente",
    run: () => {
      const domainSupportState = resolveConversationDomainSupportState({
        domainStage: "catalog_commerce",
        hasMercadoLivreContext: true,
        hasFocusedApiContext: false,
        hasLeadContext: false,
      });

      const payload = buildOpenAiStageRequestPayload({
        model: "gpt-test",
        context: recentCatalogContext,
        history: [
          { role: "user", content: "oi" },
          { role: "assistant", content: "te mostrei 3 opcoes" },
          { role: "user", content: "gostei da sopeira" },
        ],
        domainSupportState,
        systemPrompt: "Sistema",
        channelReplyInstruction: "Canal",
        runtimePrompt: "Runtime",
        legacyAgentPrompt: "",
        structuredReplyInstruction: "Estrutura",
        analyticalReplyInstruction: "",
        agentAssetInstruction: "",
        focusedApiContextInstructions: "",
        mercadoLivrePromptContext: "ML contexto",
        mercadoLivreDetailPromptContext: "",
      });

      assert.equal(payload.requestPayload.max_output_tokens, 260);
      assert.equal(payload.recentMessageWindow, 4);
      assert.match(payload.requestPayload.instructions, /Dominio atual: catalogo e comercio/i);
      assert.equal(Array.isArray(payload.requestPayload.input), true);
    },
  },
  {
    name: "summary stage refresca a cada 4 mensagens",
    run: () => {
      assert.equal(shouldRefreshSummary(3), false);
      assert.equal(shouldRefreshSummary(4), true);
      assert.equal(shouldRefreshSummary(8), true);
    },
  },
  {
    name: "context stage consolida prompts e sinais do fluxo",
    run: () => {
      const state = resolveConversationContextStageState({
        agent: {
          id: "agent-1",
          nome: "Agent",
          slug: null,
          descricao: "Atendimento",
          ativo: true,
          projetoId: "proj-1",
          modeloId: null,
          apiIds: [],
          configuracoes: { cta_whatsapp: "Chama no WhatsApp" },
          arquivos: [],
          promptBase: "",
          createdAt: "",
        },
        context: recentCatalogContext,
        latestUserMessage: "gostei da sopeira",
        history: [
          { role: "assistant", content: "te mostrei 3 opcoes" },
          { role: "user", content: "gostei da sopeira" },
        ],
        apiContexts: [],
        runtimeAssets: [],
        hasMercadoLivreConnector: true,
        enableInfraStudioHeuristics: true,
        allowLeadGate: true,
        leadNameReplyDetected: false,
        extractedLeadName: null,
        currentCatalogProduct: recentCatalogContext.catalogo?.produtoAtual ?? null,
        deps: {
          buildSystemPrompt: () => "system",
          buildChannelReplyInstruction: () => "channel",
          buildRuntimePrompt: () => "runtime",
          buildLegacyAgentPrompt: () => "legacy",
          buildStructuredReplyInstruction: () => "structured",
          buildAnalyticalReplyInstruction: () => "analytical",
          buildAgentAssetInstruction: () => "assets",
          buildFocusedApiContext: () => ({ instructions: "", fields: [] }),
          buildAgentScopedRecoveryReply: () => "recovery",
          buildCatalogPricingReply: () => "pricing",
          maybeAskForLeadIdentification: () => "lead",
          buildLeadNameAcknowledgementReply: () => "name",
        },
      });

      assert.equal(state.systemPrompt, "system");
      assert.equal(state.scopedRecoveryReply, "recovery");
      assert.equal(state.catalogPricingReply, "pricing");
      assert.equal(state.lojaCta, "Chama no WhatsApp");
      assert.equal(state.hasFocusedApiContext, false);
    },
  },
];

async function main() {
  for (const testCase of tests) {
    await testCase.run();
    console.log(`PASS ${testCase.name}`);
  }

  console.log(`\n${tests.length} smoke tests passed.`);
}

main().catch((error) => {
  console.error("Smoke tests failed.");
  console.error(error);
  process.exit(1);
});





