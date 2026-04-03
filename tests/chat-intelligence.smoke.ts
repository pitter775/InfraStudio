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
import { buildSystemPrompt } from "@/lib/chat-prompt-builders";
import { buildAgentScopedRecoveryReply } from "@/lib/chat-recovery-stage";
import { isLikelyLeadNameReply } from "@/lib/chat-lead-stage";
import { buildWhatsAppMessageSequence, resolveCanonicalWhatsAppExternalIdentifier, sanitizeWhatsAppCustomerFacingReply } from "@/lib/chat-service";
import { buildCatalogDecisionFromSemanticIntent, shouldBypassCatalogHeuristicFallback } from "@/lib/chat-semantic-intent-stage";
import { shouldRefreshSummary } from "@/lib/chat-summary-stage";
import { buildChatUsageOrigin, buildChatUsageTelemetry, describeChatUsageOrigin, readChatUsageTelemetry } from "@/lib/chat-usage-metrics";
import {
  buildMercadoLivreSalesReply,
  buildMercadoLivreListingReply,
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
  loadMercadoLivreFixture,
  loadWhatsAppContextFixture,
  normalizeFixtureText,
} from "@/tests/chat-test-fixtures";
import { buildApiFallbackReply, buildFocusedApiContext } from "@/lib/chat-api-runtime";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const deps = createFixtureSearchDeps();
const recentCatalogContext: ConversationContext = loadCatalogContextFixture();
const whatsappContext: ConversationContext = loadWhatsAppContextFixture();
const mercadoLivreFixture = loadMercadoLivreFixture();
const mercadoLivreFocusProduct = loadMercadoLivreFocusProductFixture();
const apiRuntimeFixture = loadApiRuntimeFixture();
const apiRuntimeRealEstateFixture = loadApiRuntimeRealEstateFixture();

const tests: TestCase[] = [
  {
    name: "whatsapp entrega lista com introducao e um produto por mensagem",
    run: () => {
      const sequence = buildWhatsAppMessageSequence(
        "Encontrei algumas opcoes para voce.",
        [          
          {
            nome: "Produto 1",
            targetUrl: "https://example.com/produto",
            descricao: "Detalhe do produto",
            whatsappText: "Texto extra",
          },
          {
            nome: "Produto 2",
            targetUrl: "https://example.com/produto-2",
            descricao: "Detalhe do produto 2",
          },
        ],
        "Me diga se gostou de algum.",
      );

      assert.equal(sequence.length, 3);
      assert.match(sequence[0] ?? "", /Encontrei algumas opcoes para voce\./i);
      assert.match(sequence[1] ?? "", /\*1\. Produto 1\*/i);
      assert.match(sequence[1] ?? "", /https:\/\/example\.com\/produto/i);
      assert.match(sequence[2] ?? "", /\*2\. Produto 2\*/i);
      assert.match(sequence[2] ?? "", /https:\/\/example\.com\/produto-2/i);
    },
  },
  {
    name: "whatsapp preserva frase humana na introducao da lista",
    run: () => {
      const reply = buildMercadoLivreReply(mercadoLivreFixture.listingProducts, whatsappContext, {
        normalizeText: normalizeFixtureText,
        isWhatsAppChannel: () => true,
      });

      const sequence = buildWhatsAppMessageSequence(reply ?? "", mercadoLivreFixture.listingProducts.map((produto) => ({
        nome: produto.nome,
        targetUrl: produto.link,
        descricao: "",
        whatsappText: `Se esse estilo fizer sentido para voce, eu posso te explicar melhor este item.`,
      })));

      assert.ok(sequence[0]);
      assert.match(sequence[0] ?? "", /me diga se gostou de algum|traga mais opcoes/i);
      assert.equal(sequence.length, 4);
    },
  },
  {
    name: "whatsapp remove promessas de verificar status da resposta ao cliente",
    run: () => {
      const sanitized = sanitizeWhatsAppCustomerFacingReply(
        "Vou verificar o status para voce. Esse produto tem bom acabamento e pode combinar com o que voce procura.",
      );

      assert.doesNotMatch(sanitized, /vou verificar|status/i);
      assert.match(sanitized, /bom acabamento/i);
    },
  },
  {
    name: "sanitizacao remove vazamento de instrucao de estilo com acento e pontuacao solta",
    run: () => {
      const sanitized = sanitizeWhatsAppCustomerFacingReply(
        "Encontrei um produto interessante para voce, de forma natural, simpática e acolhedora, .",
      );

      assert.doesNotMatch(sanitized, /de forma natural|simpática e acolhedora|simpatica e acolhedora/i);
      assert.doesNotMatch(sanitized, /,\s*\./);
      assert.match(sanitized, /Encontrei um produto interessante para voce/i);
    },
  },
  {
    name: "recovery do agente usa fallback factual da API sem depender de palavra gatilho estreita",
    run: () => {
      const reply = buildAgentScopedRecoveryReply({
        message: "qual o preco do produto?",
        context: {
          channel: { kind: "external_widget" },
        } as ConversationContext,
        agent: null,
        apiContexts: apiRuntimeFixture.apis,
        hasMercadoLivreConnector: false,
      });

      assert.match(reply, /preco|250/i);
    },
  },
  {
    name: "recovery do agente no mercado livre transforma busca inicial em busca guiada sem formulario generico",
    run: () => {
      const reply = buildAgentScopedRecoveryReply({
        message: "preciso de uma sopeira",
        context: {
          channel: { kind: "admin_agent_test" },
        } as ConversationContext,
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

      assert.match(reply, /busca de .*sopeira/i);
      assert.doesNotMatch(reply, /me diga o produto, modelo, marca, cor ou sku/i);
    },
  },
  {
    name: "recovery do agente no mercado livre recupera typo simples sem cair em fallback seco",
    run: () => {
      const reply = buildAgentScopedRecoveryReply({
        message: "vc tem soperia",
        context: {
          channel: { kind: "admin_agent_test" },
        } as ConversationContext,
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

      assert.match(reply, /busca de .*sopeira/i);
      assert.doesNotMatch(reply, /me diga o produto, modelo, marca, cor ou sku/i);
    },
  },
  {
    name: "recovery do agente no mercado livre trata presente como brief comercial e nao como pedido de sku",
    run: () => {
      const reply = buildAgentScopedRecoveryReply({
        message: "Presente",
        context: {
          channel: { kind: "admin_agent_test" },
        } as ConversationContext,
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

      assert.match(reply, /para quem e|qual estilo|faixa de valor/i);
      assert.doesNotMatch(reply, /me diga o produto, modelo, marca, cor ou sku/i);
    },
  },
  {
    name: "recovery do agente sustenta follow-up analitico de API como vale a pena",
    run: () => {
      const reply = buildAgentScopedRecoveryReply({
        message: "sim preciso saber se vale apena",
        context: {
          channel: { kind: "external_widget" },
        } as ConversationContext,
        agent: {
          id: "agent-1",
          nome: "Agente do Imovel",
          slug: null,
          projetoId: "proj-1",
          modeloId: null,
          apiIds: [],
          configuracoes: { runtime: { overview: { objetivo: "Qualificar leads e conduzir o atendimento com contexto do negocio." } } },
          arquivos: [],
          promptBase: "",
          createdAt: "",
          updatedAt: "",
          ativo: true,
          descricao: null,
        } as never,
        apiContexts: apiRuntimeFixture.apis,
        hasMercadoLivreConnector: false,
      });

      assert.match(reply, /Conclusao|Motivos|Proximo passo/i);
      assert.doesNotMatch(reply, /Me diga o ponto exato que voce quer validar/i);
    },
  },
  {
    name: "fallback de API sustenta follow-up analitico longo sem perder integridade",
    run: () => {
      const message =
        "entendi, mas eu preciso saber com mais clareza se vale a pena entrar nisso agora, considerando risco, cartorio, matricula, custo total e se existe algum ponto que possa atrapalhar depois";

      const focused = buildFocusedApiContext(message, apiRuntimeFixture.apis, {
        normalizeText: normalizeFixtureText,
        buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
        singularizeToken: (value) => value,
      });
      const reply = buildApiFallbackReply(message, apiRuntimeFixture.apis, {
        normalizeText: normalizeFixtureText,
        buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
        singularizeToken: (value) => value,
      });

      assert.ok(focused.fields.length > 0);
      assert.ok(reply);
      assert.match(reply ?? "", /Conclusao|Motivos|Proximo passo/i);
    },
  },
  {
    name: "fallback de API de imovel responde com mais empatia em vale a pena",
    run: () => {
      const reply = buildApiFallbackReply("sera que vale apena", apiRuntimeRealEstateFixture.apis, {
        normalizeText: normalizeFixtureText,
        buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
        singularizeToken: (value) => value,
      });

      assert.ok(reply);
      assert.match(reply ?? "", /Faz sentido olhar isso com mais calma/i);
      assert.match(reply ?? "", /Motivos/i);
      assert.match(reply ?? "", /riscos|cartorio|matricula/i);
    },
  },
  {
    name: "resposta direta de data do leilao formata data com icone",
    run: () => {
      const reply = buildApiFallbackReply("me passa a data do leilao", apiRuntimeRealEstateFixture.apis, {
        normalizeText: normalizeFixtureText,
        buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
        singularizeToken: (value) => value,
      });

      assert.ok(reply);
      assert.match(reply ?? "", /📅/);
      assert.match(reply ?? "", /27\/03\/2026/);
      assert.doesNotMatch(reply ?? "", /2026-03-27T16:00:00Z/);
    },
  },
  {
    name: "analise de imovel em vale a pena inclui data normalizada quando disponivel",
    run: () => {
      const reply = buildApiFallbackReply("sera que vale apena", apiRuntimeRealEstateFixture.apis, {
        normalizeText: normalizeFixtureText,
        buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
        singularizeToken: (value) => value,
      });

      assert.ok(reply);
      assert.match(reply ?? "", /📅/);
      assert.match(reply ?? "", /27\/03\/2026/);
    },
  },
  {
    name: "fallback de API de imovel segura follow-up curto sem depender de frase fixa",
    run: () => {
      const messages = [
        "sim segue",
        "pode continuar",
        "quero entender melhor isso",
      ];

      for (const message of messages) {
        const reply = buildAgentScopedRecoveryReply({
          message,
          context: {
            channel: { kind: "external_widget" },
          } as ConversationContext,
          agent: {
            id: "agent-1",
            nome: "Agente do Imovel",
            slug: null,
            projetoId: "proj-1",
            modeloId: null,
            apiIds: [],
            configuracoes: { runtime: { overview: { objetivo: "Qualificar leads e conduzir o atendimento com contexto do negocio." } } },
            arquivos: [],
            promptBase: "",
            createdAt: "",
            updatedAt: "",
            ativo: true,
            descricao: null,
          } as never,
          apiContexts: apiRuntimeRealEstateFixture.apis,
          hasMercadoLivreConnector: false,
        });

        assert.match(reply, /Faz sentido olhar isso com mais calma|Leitura inicial|Motivos|riscos|cartorio|matricula/i);
        assert.doesNotMatch(reply, /Me diga o ponto exato que voce quer validar/i);
      }
    },
  },
  {
    name: "contexto focado de API permanece ativo em follow-up curto sem frase fixa",
    run: () => {
      const focused = buildFocusedApiContext("sim segue", apiRuntimeRealEstateFixture.apis, {
        normalizeText: normalizeFixtureText,
        buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
        singularizeToken: (value) => value,
      });

      assert.ok(focused.fields.length > 0);
      assert.match(focused.instructions, /continuidade curta|contexto factual/i);
    },
  },
  {
    name: "whatsapp usa telefone canonico do contexto e ignora identificador lid",
    run: () => {
      const externalId = resolveCanonicalWhatsAppExternalIdentifier({
        identificadorExterno: "270570709065941@lid",
        identificador: "270570709065941@lid",
        context: {
          whatsapp: {
            remetente: "270570709065941@lid",
            remoteJid: "270570709065941@lid",
            remotePhone: "5511978510655",
            rawContact: {
              number: "5511978510655",
            },
          },
        },
      });

      assert.equal(externalId, "5511978510655");
    },
  },
  {
    name: "whatsapp contexto base mantem telefone canonico para continuidade da conversa",
    run: () => {
      const firstId = resolveCanonicalWhatsAppExternalIdentifier({
        identificadorExterno: "270570709065941@lid",
        identificador: "270570709065941@lid",
        context: whatsappContext,
      });

      const secondId = resolveCanonicalWhatsAppExternalIdentifier({
        identificadorExterno: "5511978510655@c.us",
        identificador: "5511978510655@c.us",
        context: whatsappContext,
      });

      assert.equal(firstId, "5511978510655");
      assert.equal(secondId, "5511978510655");
    },
  },
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
    name: "semantic stage segura interesse no produto em foco sem voltar para referencia de catalogo",
    run: () => {
      const decision = buildCatalogDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "product_interest",
          confidence: 0.93,
          reason: "demonstrou interesse no produto atual",
          usedLlm: true,
        },
        context: recentCatalogContext,
        recentProducts: recentCatalogContext.catalogo?.ultimosProdutos ?? [],
      });

      assert.ok(decision);
      assert.equal(decision?.kind, "non_catalog_message");
      assert.equal(decision?.matchedProducts[0]?.id, "MLB2");
      assert.equal(decision?.usedLlm, true);
      assert.equal(decision?.shouldBlockNewSearch, true);
    },
  },
  {
    name: "pergunta tecnica com produto em foco prioriza mercado livre em vez de catalog reference",
    async run() {
      const semanticDecision = buildCatalogDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "product_question",
          confidence: 0.92,
          reason: "pergunta tecnica sobre o produto em foco",
          usedLlm: true,
        },
        context: recentCatalogContext,
        recentProducts: recentCatalogContext.catalogo?.ultimosProdutos ?? [],
      });

      const flow = resolveMercadoLivreFlowState({
        latestUserMessage: "gostei vc sabe o material dele",
        context: recentCatalogContext,
        hasMercadoLivreConnector: true,
        leadNameReplyDetected: false,
        recentCatalogProducts: recentCatalogContext.catalogo?.ultimosProdutos ?? [],
        catalogFollowUpDecision: semanticDecision,
        detectProductSearch: () => false,
        buildProductSearchCandidates: deps.buildProductSearchCandidates,
        resolveRecentCatalogProductReference,
        isRecentCatalogReferenceAttempt: (message) => /\b(esse|essa|mandou|primeiro|segundo)\b/i.test(message),
        isMercadoLivreListingIntent: () => false,
        shouldUseMercadoLivreConnectorFallback: () => false,
      });

      const heuristicState = await resolveMercadoLivreHeuristicState({
        agentId: null,
        latestUserMessage: "gostei vc sabe o material dele",
        context: recentCatalogContext,
        hasMercadoLivreConnector: true,
        leadNameReplyDetected: false,
        hasReferencedCatalogReply: false,
        productSearchRequested: flow.productSearchRequested,
        genericMercadoLivreListingRequested: flow.genericMercadoLivreListingRequested,
        mercadoLivreListingProducts: [],
        mercadoLivreProducts: [],
        resolvedProductSearchTerm: flow.productSearchTerm,
        productSearchTerm: flow.productSearchTerm,
        loadMoreCatalogRequested: flow.loadMoreCatalogRequested,
        referencedCatalogProducts: flow.referencedCatalogProducts,
        currentCatalogProduct: flow.currentCatalogProduct,
        catalogFollowUpDecision: semanticDecision,
        lojaCta: null,
        deps: {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => false,
        },
      });

      const mercadoLivreReply = resolveMercadoLivreHeuristicReply({
        context: recentCatalogContext,
        latestUserMessage: "gostei vc sabe o material dele",
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
          isWhatsAppChannel: () => false,
        },
      });

      const shouldBypassCatalogReferenceReply =
        Boolean(flow.currentCatalogProduct) &&
        (semanticDecision?.kind === "non_catalog_message");
      const catalogReferenceReply = shouldBypassCatalogReferenceReply
        ? null
        : resolveCatalogReferenceHeuristicReply({
            context: recentCatalogContext,
            agentId: "agent-1",
            agentName: "Agent",
            referencedCatalogProducts: flow.referencedCatalogProducts,
            ambiguousCatalogReferenceReply: buildAmbiguousCatalogReferenceReply(recentCatalogContext),
            formatReply: (reply) => reply,
          });

      const stageState = resolveConversationPipelineStageState({
        leadNameAcknowledgementReply: null,
        hasCatalogReferenceHeuristicReply: Boolean(catalogReferenceReply),
        hasMercadoLivreHeuristicReply: Boolean(mercadoLivreReply),
        catalogPricingReply: null,
        leadIdentificationReply: null,
        hasValidAgent: true,
        hasOpenAiKey: true,
        hasFocusedApiContext: false,
        latestUserMessage: "gostei vc sabe o material dele",
        hasMemorySummary: false,
        hasCurrentCatalogContext: true,
        hasMercadoLivreContext: true,
        hasLeadContext: false,
        semanticCatalogIntentStage: {
          intent: "product_question",
          confidence: 0.92,
          reason: "pergunta tecnica sobre o produto em foco",
          usedLlm: true,
        },
      });

      assert.equal(semanticDecision?.kind, "non_catalog_message");
      assert.equal(Boolean(catalogReferenceReply), false);
      assert.equal(mercadoLivreReply?.mode, "mercado_livre_product_sales");
      assert.equal(stageState.heuristicIntentStage, "mercado_livre");
      assert.doesNotMatch(mercadoLivreReply?.reply ?? "", /Acredito que voce esteja falando|buscar opcoes parecidas|mostrar mais detalhes/i);
    },
  },
  {
    name: "semantic stage transforma rejeicao em continuidade de vitrine",
    run: () => {
      const decision = buildCatalogDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "product_rejection",
          confidence: 0.81,
          reason: "nao gostou do produto em foco",
          usedLlm: true,
        },
        context: recentCatalogContext,
        recentProducts: recentCatalogContext.catalogo?.ultimosProdutos ?? [],
      });

      assert.ok(decision);
      assert.equal(decision?.kind, "load_more_results");
      assert.equal(decision?.shouldBlockNewSearch, true);
    },
  },
  {
    name: "semantic stage libera nova busca quando a intencao e nova exploracao",
    run: () => {
      const decision = buildCatalogDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "new_search",
          confidence: 0.88,
          reason: "quer procurar outro produto",
          usedLlm: true,
        },
        context: recentCatalogContext,
        recentProducts: recentCatalogContext.catalogo?.ultimosProdutos ?? [],
      });

      assert.ok(decision);
      assert.equal(decision?.kind, "new_product_search");
      assert.equal(decision?.shouldBlockNewSearch, false);
    },
  },
  {
    name: "semantic stage forte com contexto de catalogo reduz fallback heuristico",
    run: () => {
      const shouldBypass = shouldBypassCatalogHeuristicFallback({
        semanticIntent: {
          intent: "product_question",
          confidence: 0.91,
          reason: "quer tirar duvida sobre o item em foco",
          usedLlm: true,
        },
        context: recentCatalogContext,
      });

      assert.equal(shouldBypass, true);
    },
  },
  {
    name: "resposta de assunto nao pode ser tratada como nome do lead",
    run: () => {
      const history = [
        { role: "assistant" as const, content: "Qual e o seu nome?" },
        { role: "user" as const, content: "Automacao" },
      ];

      const isNameReply = isLikelyLeadNameReply("Automacao", history, {
        normalizeText: normalizeFixtureText,
        extractName: (message: string) => message,
      });

      assert.equal(isNameReply, false);
    },
  },
  {
    name: "prompt de imoveis nao mistura identidade da infrastudio",
    run: () => {
      const prompt = buildSystemPrompt(
        {
          id: "agent-real-estate",
          nome: "Nexo Leiloes",
          slug: null,
          projetoId: "proj-real-estate",
          modeloId: null,
          apiIds: [],
          configuracoes: {},
          arquivos: [],
          promptBase: "",
          createdAt: "",
          updatedAt: "",
          ativo: true,
          descricao: "Assistente de leiloes imobiliarios",
        } as never,
        {
          projeto: { nome: "Nexo Leiloes", slug: "nexo-leiloes" },
          channel: { kind: "external_widget" },
        } as ConversationContext,
        false,
      );

      assert.doesNotMatch(prompt, /Voce e o agente comercial inicial da InfraStudio|Foque em automacao, IA, integracoes, sistemas sob medida/i);
      assert.doesNotMatch(prompt, /priorize descobrir e confirmar o primeiro nome/i);
      assert.match(prompt, /leiloes imobiliarios|imoveis|risco|matricula|cartorio/i);
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
    name: "copy de listagem mercado livre no whatsapp nao exige a palavra mais",
    run: () => {
      const reply = buildMercadoLivreReply(mercadoLivreFixture.listingProducts, recentCatalogContext, {
        normalizeText: normalizeFixtureText,
        isWhatsAppChannel: () => true,
      });

      assert.ok(reply);
      assert.doesNotMatch(reply ?? "", /me responda "mais"|basta responder "mais"/i);
      assert.match(reply ?? "", /me diga se gostou de algum|traga mais opcoes/i);
    },
  },
  {
    name: "copy de vitrine unica no whatsapp convida continuidade livre",
    run: () => {
      const reply = buildMercadoLivreListingReply([mercadoLivreFixture.listingProducts[0]!], recentCatalogContext, {
        normalizeText: normalizeFixtureText,
        isWhatsAppChannel: () => true,
      });

      assert.ok(reply);
      assert.doesNotMatch(reply ?? "", /me responda "mais"|basta responder "mais"/i);
      assert.match(reply ?? "", /se gostar desse estilo/i);
    },
  },
  {
    name: "copy de resultado unico nao prende o usuario a palavra gatilho",
    run: () => {
      const reply = buildMercadoLivreSingleResultReply(mercadoLivreFixture.detailedProducts[0]!, recentCatalogContext, null, {
        normalizeText: normalizeFixtureText,
        isWhatsAppChannel: () => true,
      });

      assert.doesNotMatch(reply, /me responda "mais"|basta responder "mais"/i);
      assert.match(reply, /ou seguir com este item por aqui/i);
    },
  },
  {
    name: "resposta comercial usa descricao detalhada e puxa conversa de venda",
    run: () => {
      const reply = buildMercadoLivreSingleResultReply(mercadoLivreFixture.detailedProducts[0]!, recentCatalogContext, null, {
        normalizeText: normalizeFixtureText,
        isWhatsAppChannel: () => true,
      });

      assert.match(reply, /No anuncio ele aparece assim:/i);
      assert.match(reply, /seguir com este item por aqui|vale fechar agora|te ajudo a decidir/i);
    },
  },
  {
    name: "produto unico com interesse do cliente deve puxar conversa comercial e nao relistar",
    run: () => {
      const reply = resolveMercadoLivreHeuristicReply({
        context: recentCatalogContext,
        latestUserMessage: "gostei desse produto",
        agentId: "agent-1",
        agentName: "Agent",
        selectedProductSalesReply: buildMercadoLivreSalesReply(
          mercadoLivreFixture.detailedProducts[0]!,
          "gostei desse produto",
          recentCatalogContext,
          null,
          {
            normalizeText: normalizeFixtureText,
            isWhatsAppChannel: () => true,
          },
        ),
        salesFocusProduct: mercadoLivreFixture.detailedProducts[0]!,
        selectedCatalogProduct: null,
        mercadoLivreListingReply: null,
        mercadoLivreListingProductsForAssets: [],
        directMercadoLivreReply: null,
        mercadoLivreProductsForAssets: [],
        currentProductForMetadata: null,
        mercadoLivreNoResultsReply: null,
        formatReply: (reply) => reply,
        deps: {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => true,
        },
      });

      assert.equal(reply?.mode, "mercado_livre_product_sales");
      assert.doesNotMatch(reply?.reply ?? "", /encontrei um produto da loja/i);
      assert.match(reply?.reply ?? "", /seguir com voce nesse|te ajudo a decidir|No anuncio ele aparece assim:/i);
    },
  },
  {
    name: "produto em foco decidido pelo pipeline gera fala comercial consultiva",
    run: () => {
      const reply = buildMercadoLivreSalesReply(
        mercadoLivreFixture.detailedProducts[0]!,
        "acho que combina comigo",
        recentCatalogContext,
        null,
        {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => true,
        },
      );

      assert.match(reply, /o que mais pesa para voce/i);
      assert.match(reply, /No anuncio ele aparece assim:|Pelo anuncio/i);
    },
  },
  {
    name: "resposta comercial de garantia fica mais consultiva e menos seca",
    run: () => {
      const reply = buildMercadoLivreSalesReply(
        mercadoLivreFixture.detailedProducts[0]!,
        "tem garantia?",
        recentCatalogContext,
        null,
        {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => true,
        },
      );

      assert.match(reply, /No anuncio ele aparece assim:/i);
      assert.match(reply, /resumir o estado geral do anuncio|decidir com seguranca/i);
      assert.doesNotMatch(reply, /condicao, estoque e frete para voce decidir melhor/i);
    },
  },
  {
    name: "resposta comercial de interesse puxa batida de martelo do produto",
    run: () => {
      const reply = buildMercadoLivreSalesReply(
        mercadoLivreFixture.detailedProducts[0]!,
        "gostei desse produto",
        recentCatalogContext,
        null,
        {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => true,
        },
      );

      assert.match(reply, /bater o martelo|mais importam para voce/i);
    },
  },
  {
    name: "produto em foco evita reapresentar o mesmo item em follow-up de detalhe",
    run: () => {
      const reply = buildMercadoLivreSalesReply(
        mercadoLivreFocusProduct,
        "qual o material completo desse jogo",
        { channel: { kind: "admin_agent_test" } } as ConversationContext,
        null,
        {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => false,
        },
        {
          productAlreadyInFocus: true,
        },
      );

      assert.doesNotMatch(reply, /\*\*Boa escolha\.\*\*/i);
      assert.doesNotMatch(reply, /Boa escolha\./i);
      assert.match(reply, /Sobre esse item|ceramica|porcelana/i);
    },
  },
  {
    name: "agent test chat responde pergunta tecnica do produto em foco sem relistar nem reiniciar",
    run: () => {
      const reply = buildMercadoLivreSalesReply(
        mercadoLivreFocusProduct,
        "ela e resistente vc sabe o material dela",
        { channel: { kind: "admin_agent_test" } } as ConversationContext,
        null,
        {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => false,
        },
      );

      assert.match(reply, /ceramica esmaltada/i);
      assert.match(reply, /bom estado geral|sem trincas|sem quebras/i);
      assert.doesNotMatch(reply, /buscar opcoes parecidas|mostrar mais detalhes/i);
      assert.doesNotMatch(reply, /Sigo por aqui no contexto|Me diga o ponto exato que voce quer validar/i);
    },
  },
  {
    name: "agent test chat evita loop de repeticao do produto em pergunta tecnica",
    run: () => {
      const reply = buildMercadoLivreSalesReply(
        mercadoLivreFocusProduct,
        "serve para uso diario?",
        { channel: { kind: "admin_agent_test" } } as ConversationContext,
        null,
        {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => false,
        },
      );

      const repeatedNameCount = (reply.match(/Jogo De Sopeira Com Consumes Ceramica Decorada Vintage Branco/gi) ?? []).length;
      assert.ok(repeatedNameCount <= 1);
      assert.match(reply, /uso a mesa|dia a dia|servir sopas e caldos/i);
    },
  },
  {
    name: "apos entregar produto unico o follow-up tecnico nao relista nem reinicia",
    run: () => {
      const reply = buildMercadoLivreSalesReply(
        mercadoLivreFocusProduct,
        "gostei vc sabe o material dele",
        {
          ...recentCatalogContext,
          channel: { kind: "admin_agent_test" },
          catalogo: {
            ...recentCatalogContext.catalogo!,
            ultimaBusca: "sopeira",
            produtoAtual: recentCatalogContext.catalogo?.ultimosProdutos?.[1],
            ultimosProdutos: [recentCatalogContext.catalogo?.ultimosProdutos?.[1]].filter(Boolean) as NonNullable<ConversationContext["catalogo"]>["ultimosProdutos"],
          },
        },
        null,
        {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => false,
        },
      );

      assert.match(reply, /ceramica esmaltada|bom estado geral/i);
      assert.doesNotMatch(reply, /Acredito que voce esteja falando|buscar opcoes parecidas|mostrar mais detalhes/i);
      assert.doesNotMatch(reply, /Sigo por aqui no contexto|Me diga o ponto exato que voce quer validar/i);
    },
  },
  {
    name: "follow-up de detalhes com pronome mantem o mesmo produto em foco",
    run: async () => {
      const focusContext: ConversationContext = {
        ...recentCatalogContext,
        channel: { kind: "admin_agent_test" },
        catalogo: {
          ...recentCatalogContext.catalogo!,
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
        latestUserMessage: "vc tem mais detalhes dele",
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

      assert.ok(state.selectedProductSalesReply);
      assert.match(state.selectedProductSalesReply ?? "", /jogo de jantar|41 pecas|2990/i);
      assert.doesNotMatch(state.selectedProductSalesReply ?? "", /bules inox|meridional|290/i);
      assert.equal(state.salesFocusProduct?.nome, "Jogo De Jantar Porcelana Floral Filete Dourado 41 Pecas Branco Florido");
    },
  },
  {
    name: "follow-up de detalhes do produto em foco nao repete card nem link sem necessidade",
    run: () => {
      const reply = resolveMercadoLivreHeuristicReply({
        context: { channel: { kind: "admin_agent_test" } } as ConversationContext,
        latestUserMessage: "Queria mais detalhes",
        agentId: "agent-1",
        agentName: "Reliquia de familia",
        selectedProductSalesReply: "Boa escolha. Ele e de ceramica esmaltada e esta em bom estado geral.",
        salesFocusProduct: mercadoLivreFocusProduct,
        selectedCatalogProduct: recentCatalogContext.catalogo?.ultimosProdutos?.[1] ?? null,
        mercadoLivreListingReply: null,
        mercadoLivreListingProductsForAssets: [],
        directMercadoLivreReply: null,
        mercadoLivreProductsForAssets: [],
        currentProductForMetadata: recentCatalogContext.catalogo?.ultimosProdutos?.[1] ?? null,
        mercadoLivreNoResultsReply: null,
        formatReply: (value) => value,
        deps: {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => false,
        },
      });

      assert.ok(reply);
      assert.equal(reply?.assets.length, 0);
    },
  },
  {
    name: "pedido explicito de link ou imagem pode repetir asset do produto em foco",
    run: () => {
      const reply = resolveMercadoLivreHeuristicReply({
        context: { channel: { kind: "admin_agent_test" } } as ConversationContext,
        latestUserMessage: "me manda o link desse produto",
        agentId: "agent-1",
        agentName: "Reliquia de familia",
        selectedProductSalesReply: "Boa escolha. Posso te mandar o link sim.",
        salesFocusProduct: mercadoLivreFocusProduct,
        selectedCatalogProduct: recentCatalogContext.catalogo?.ultimosProdutos?.[1] ?? null,
        mercadoLivreListingReply: null,
        mercadoLivreListingProductsForAssets: [],
        directMercadoLivreReply: null,
        mercadoLivreProductsForAssets: [],
        currentProductForMetadata: recentCatalogContext.catalogo?.ultimosProdutos?.[1] ?? null,
        mercadoLivreNoResultsReply: null,
        formatReply: (value) => value,
        deps: {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => false,
        },
      });

      assert.ok(reply);
      assert.ok((reply?.assets.length ?? 0) >= 1);
    },
  },
  {
    name: "follow-up misto de interesse e pergunta factual mantem produto em foco e evita fallback seco",
    run: () => {
      const flow = resolveMercadoLivreFlowState({
        latestUserMessage: "Esse mesmo eu gostei dele e frete gratis",
        context: {
          ...recentCatalogContext,
          channel: { kind: "admin_agent_test" },
          catalogo: {
            ...recentCatalogContext.catalogo!,
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
            ],
          },
        },
        hasMercadoLivreConnector: true,
        leadNameReplyDetected: false,
        recentCatalogProducts: recentCatalogContext.catalogo?.ultimosProdutos ?? [],
        catalogFollowUpDecision: null,
        detectProductSearch: () => true,
        buildProductSearchCandidates: deps.buildProductSearchCandidates,
        resolveRecentCatalogProductReference,
        isRecentCatalogReferenceAttempt: () => false,
        isMercadoLivreListingIntent: () => false,
        shouldUseMercadoLivreConnectorFallback: () => true,
        deps: {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => false,
        },
      });

      assert.equal(flow.productSearchRequested, false);
      assert.equal(flow.currentCatalogProduct?.nome, "Jogo De Jantar Porcelana Floral Filete Dourado 41 Pecas Branco Florido");
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
    name: "classificador de dominio usa semantic api follow-up para manter contexto factual",
    run: () => {
      const stage = classifyConversationDomainStage({
        heuristicIntentStage: "none",
        hasFocusedApiContext: true,
        latestUserMessage: "e os riscos?",
        hasMemorySummary: false,
        hasCurrentCatalogContext: false,
        hasLeadContext: false,
        semanticApiIntentStage: {
          intent: "api_follow_up",
          confidence: 0.91,
          reason: "continuidade curta sobre a mesma consulta estruturada",
          usedLlm: true,
        },
      });

      assert.equal(stage, "api_runtime");
    },
  },
  {
    name: "classificador de dominio evita sequestrar conversa generica quando semantic api marcar generic",
    run: () => {
      const stage = classifyConversationDomainStage({
        heuristicIntentStage: "none",
        hasFocusedApiContext: true,
        latestUserMessage: "quero ver outros produtos",
        hasMemorySummary: false,
        hasCurrentCatalogContext: false,
        hasLeadContext: false,
        semanticApiIntentStage: {
          intent: "generic",
          confidence: 0.88,
          reason: "mensagem fora do contexto da consulta de API atual",
          usedLlm: true,
        },
      });

      assert.equal(stage, "general_sales");
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
    name: "classificador de dominio prioriza catalogo ativo sobre lead em continuidade curta no whatsapp",
    run: () => {
      const stage = classifyConversationDomainStage({
        heuristicIntentStage: "none",
        hasFocusedApiContext: false,
        latestUserMessage: "sim",
        hasMemorySummary: true,
        hasCurrentCatalogContext: true,
        hasLeadContext: true,
        semanticCatalogIntentStage: null,
      });

      assert.equal(stage, "catalog_commerce");
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
    name: "classificador de dominio usa semantic catalog intent para manter contexto comercial",
    run: () => {
      const stage = classifyConversationDomainStage({
        heuristicIntentStage: "none",
        hasFocusedApiContext: false,
        latestUserMessage: "tem garantia?",
        hasCurrentCatalogContext: true,
        semanticCatalogIntentStage: {
          intent: "product_question",
          confidence: 0.89,
          reason: "duvida sobre o item atual",
          usedLlm: true,
        },
      });

      assert.equal(stage, "catalog_commerce");
    },
  },
  {
    name: "classificador de dominio nao sequestra catalogo quando semantic catalog marcar generic",
    run: () => {
      const stage = classifyConversationDomainStage({
        heuristicIntentStage: "none",
        hasFocusedApiContext: false,
        latestUserMessage: "oi",
        hasCurrentCatalogContext: true,
        semanticCatalogIntentStage: {
          intent: "generic",
          confidence: 0.87,
          reason: "mensagem neutra fora da decisao de compra",
          usedLlm: true,
        },
      });

      assert.equal(stage, "general_sales");
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





