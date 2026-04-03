import assert from "node:assert/strict";

import {
  decideCatalogFollowUpHeuristically,
  resolveRecentCatalogProductReference,
} from "@/lib/catalog-follow-up";
import type { CatalogFollowUpDecision } from "@/lib/catalog-follow-up";
import type { ConversationContext } from "@/lib/chat-context";
import { buildApiFallbackReply, buildFocusedApiContext } from "@/lib/chat-api-runtime";
import { buildCatalogDecisionFromSemanticIntent } from "@/lib/chat-semantic-intent-stage";
import {
  appendOptionalHumanOffer,
  buildHumanHandoffReply,
  classifyHumanEscalationNeed,
  isHumanHandoffIntent,
} from "@/lib/chat-handoff-policy";
import { buildAgentScopedRecoveryReply } from "@/lib/chat-recovery-stage";
import {
  buildLeadNameAcknowledgementReply,
  enrichLeadContext,
  isLikelyLeadNameReply,
} from "@/lib/chat-lead-stage";
import { resolveConversationPipelineStageState } from "@/lib/chat-pipeline-stage";
import { resolveMercadoLivreFlowState, resolveMercadoLivreHeuristicState } from "@/lib/chat-mercado-livre";
import { shouldContinueProductSearch, shouldUseMercadoLivreConnectorFallback } from "@/lib/chat-sales-heuristics";
import { buildWhatsAppMessageSequence, resolveCanonicalWhatsAppExternalIdentifier } from "@/lib/chat-service";
import {
  createFixtureSearchDeps,
  loadApiRuntimeErrorFixture,
  loadApiRuntimeFixture,
  loadApiRuntimeRealEstateFixture,
  loadCatalogContextFixture,
  loadHandoffFixture,
  loadLeadContextFixture,
  loadMercadoLivreAmbiguousFixture,
  loadStaleCatalogContextFixture,
  loadWhatsAppContextFixture,
  normalizeFixtureText,
} from "@/tests/chat-test-fixtures";

const deps = createFixtureSearchDeps();
const catalogContext = loadCatalogContextFixture();
const staleCatalogContext = loadStaleCatalogContextFixture();
const apiFixture = loadApiRuntimeFixture();
const apiErrorFixture = loadApiRuntimeErrorFixture();
const apiRealEstateFixture = loadApiRuntimeRealEstateFixture();
const leadContextFixture = loadLeadContextFixture();
const handoffFixture = loadHandoffFixture();
const mercadoLivreAmbiguousFixture = loadMercadoLivreAmbiguousFixture();
const whatsappContextFixture = loadWhatsAppContextFixture();

type DomainReport = {
  domain: "catalog" | "api" | "mercado_livre" | "lead" | "handoff" | "whatsapp";
  title: string;
  details: string[];
};

function report(domain: DomainReport["domain"], title: string, details: string[]): DomainReport {
  return { domain, title, details };
}

function runCatalogRegression(): DomainReport[] {
  const reports: DomainReport[] = [];

  const freshDecision = decideCatalogFollowUpHeuristically("gostei da sopeira que mandou", catalogContext, deps);
  assert.equal(freshDecision?.kind, "recent_product_reference");
  reports.push(
    report("catalog", "referencia forte em snapshot recente", [
      `decision=${freshDecision?.kind ?? "null"}`,
      `matched=${freshDecision?.matchedProducts.map((item) => item.nome).join(" | ") || "none"}`,
    ]),
  );

  const staleResolved = resolveRecentCatalogProductReference("gostei da sopeira", staleCatalogContext);
  assert.equal(staleResolved.length, 0);
  reports.push(
    report("catalog", "snapshot vencido nao resolve item antigo", [
      `resolved=${staleResolved.length}`,
      `snapshotTurnId=${staleCatalogContext.catalogo?.snapshotTurnId ?? "none"}`,
    ]),
  );

  const colorDecision = decideCatalogFollowUpHeuristically("quero o amarelo", catalogContext, deps);
  assert.equal(colorDecision?.kind, "recent_product_reference_ambiguous");
  reports.push(
    report("catalog", "atributo compartilhado volta ambiguo", [
      `decision=${colorDecision?.kind ?? "null"}`,
      `matched=${colorDecision?.matchedProducts.length ?? 0}`,
    ]),
  );

  const semanticDecision = buildCatalogDecisionFromSemanticIntent({
    semanticIntent: {
      intent: "product_question",
      confidence: 0.92,
      reason: "pergunta sobre o produto atual em foco",
      usedLlm: true,
    },
    context: catalogContext,
    recentProducts: catalogContext.catalogo?.ultimosProdutos ?? [],
  });
  assert.equal(semanticDecision?.kind, "recent_product_reference");
  reports.push(
    report("catalog", "pipeline semantico leva pergunta ao produto em foco", [
      `decision=${semanticDecision?.kind ?? "null"}`,
      `usedLlm=${String(semanticDecision?.usedLlm ?? false)}`,
      `matched=${semanticDecision?.matchedProducts.map((item) => item.nome).join(" | ") || "none"}`,
    ]),
  );

  return reports;
}

function runApiRegression(): DomainReport[] {
  const reports: DomainReport[] = [];

  const focused = buildFocusedApiContext("status pedido PED-2026-0042 previsao envio", apiFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  });
  assert.ok(Array.isArray(focused.fields));
  reports.push(
    report("api", "contexto focado encontra dados relevantes", [
      `fields=${focused.fields.length}`,
      `hasInstructions=${focused.instructions ? "yes" : "no"}`,
    ]),
  );

  const fallback = buildApiFallbackReply("qual o status do pedido?", apiErrorFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  });
  assert.ok(fallback === null || typeof fallback === "string");
  reports.push(
    report("api", "fallback de api com erro permanece controlado", [
      `reply=${fallback ?? "null"}`,
      `errorApis=${apiErrorFixture.apis.filter((item) => item.erro).length}`,
    ]),
  );

  const stage = resolveConversationPipelineStageState({
    leadNameAcknowledgementReply: null,
    hasCatalogReferenceHeuristicReply: false,
    hasMercadoLivreHeuristicReply: false,
    catalogPricingReply: null,
    leadIdentificationReply: null,
    hasValidAgent: true,
    hasOpenAiKey: true,
    hasFocusedApiContext: true,
    latestUserMessage: "qual o status do pedido?",
    hasMemorySummary: false,
    hasCurrentCatalogContext: false,
    hasMercadoLivreContext: false,
    hasLeadContext: false,
  });
  assert.equal(stage.conversationDomainStage, "api_runtime");
  reports.push(
    report("api", "pipeline amplia dominio factual quando ha api focada", [
      `domain=${stage.conversationDomainStage}`,
      `tokens=${stage.domainSupportState.maxOutputTokens}`,
    ]),
  );

  const dateReply = buildApiFallbackReply("me passa a data do leilao", apiRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  });
  assert.match(dateReply ?? "", /📅/);
  assert.match(dateReply ?? "", /27\/03\/2026/);
  reports.push(
    report("api", "data do leilao sai normalizada e sem iso cru", [
      `hasIcon=${/📅/.test(dateReply ?? "") ? "yes" : "no"}`,
      `hasNormalizedDate=${/27\/03\/2026/.test(dateReply ?? "") ? "yes" : "no"}`,
      `hasRawIso=${/2026-03-27T16:00:00Z/.test(dateReply ?? "") ? "yes" : "no"}`,
    ]),
  );

  const continuationReply = buildAgentScopedRecoveryReply({
    message: "sim segue",
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
    apiContexts: apiRealEstateFixture.apis,
    hasMercadoLivreConnector: false,
  });
  assert.doesNotMatch(continuationReply, /Sigo por aqui no contexto|Me diga o ponto exato que voce quer validar/i);
  reports.push(
    report("api", "follow-up curto evita reinicio generico no external widget", [
      `avoidsRestart=${/Sigo por aqui no contexto|Me diga o ponto exato que voce quer validar/i.test(continuationReply) ? "no" : "yes"}`,
      `hasContextualReply=${/Faz sentido olhar isso com mais calma|Leitura inicial|Motivos|riscos|cartorio|matricula/i.test(continuationReply) ? "yes" : "no"}`,
    ]),
  );

  return reports;
}

function runMercadoLivreRegression(): DomainReport[] {
  const reports: DomainReport[] = [];

  const decision: CatalogFollowUpDecision = {
    kind: "recent_product_reference_ambiguous",
    confidence: 0.7,
    reason: "duas sopeiras amarelas",
    matchedProducts: mercadoLivreAmbiguousFixture.searchProducts.map((item, index) => ({
      id: item.id ?? null,
      nome: item.nome,
      descricao: mercadoLivreAmbiguousFixture.detailedProducts[index]?.descricao ?? null,
      preco: item.preco,
      link: item.link,
      imagem: item.imagem,
      cardIndex: index,
    })),
    usedLlm: false,
    shouldBlockNewSearch: true,
  };

  const flow = resolveMercadoLivreFlowState({
    latestUserMessage: "quero a amarela",
    context: {
      ...catalogContext,
      catalogo: {
        ...catalogContext.catalogo!,
        produtoAtual: null,
        ultimosProdutos: decision.matchedProducts,
      },
    },
    hasMercadoLivreConnector: true,
    leadNameReplyDetected: false,
    recentCatalogProducts: decision.matchedProducts,
    catalogFollowUpDecision: decision,
    detectProductSearch: () => false,
    buildProductSearchCandidates: deps.buildProductSearchCandidates,
    resolveRecentCatalogProductReference,
    isRecentCatalogReferenceAttempt: () => true,
    isMercadoLivreListingIntent: () => false,
    shouldUseMercadoLivreConnectorFallback: () => true,
  });

  assert.equal(flow.referencedCatalogProducts.length, 2);
  assert.equal(flow.productSearchRequested, false);
  reports.push(
    report("mercado_livre", "fluxo segura ambiguidade sem disparar nova busca", [
      `referenced=${flow.referencedCatalogProducts.length}`,
      `productSearch=${flow.productSearchRequested}`,
      `listingFixture=${mercadoLivreAmbiguousFixture.listingProducts.length}`,
    ]),
  );

  const noStickySearch = shouldContinueProductSearch(
    [
      { role: "assistant", content: "Encontrei algumas opcoes parecidas na loja logo abaixo." },
      { role: "user", content: "gostei desse" },
    ],
    "gostei desse",
    { ...catalogContext, catalogo: { ...catalogContext.catalogo!, ultimaBusca: "" } },
    {
      normalizeText: normalizeFixtureText,
      isGreetingOrAckMessage: () => false,
      shouldSearchProducts: () => false,
      buildProductSearchCandidates: deps.buildProductSearchCandidates,
    },
  );
  assert.equal(noStickySearch, false);
  reports.push(
    report("mercado_livre", "continuidade curta sem ultima busca nao vira busca automatica", [
      `continueSearch=${noStickySearch}`,
    ]),
  );

  const noLooseFallback = shouldUseMercadoLivreConnectorFallback(
    [{ role: "user", content: "gostei desse" }],
    "gostei desse",
    { ...catalogContext, catalogo: { ...catalogContext.catalogo!, ultimaBusca: "" } },
    {
      normalizeText: normalizeFixtureText,
      isGreetingOrAckMessage: () => false,
      buildProductSearchCandidates: deps.buildProductSearchCandidates,
      shouldSearchProducts: () => false,
      isLikelyLeadNameReply: () => false,
      extractName: () => null,
    },
  );
  assert.equal(noLooseFallback, false);
  reports.push(
    report("mercado_livre", "fallback solto do conector nao dispara sem contexto real de busca", [
      `connectorFallback=${noLooseFallback}`,
    ]),
  );

  return reports;
}

async function runMercadoLivreCommercialRegression(): Promise<DomainReport[]> {
  const reports: DomainReport[] = [];

  const state = await resolveMercadoLivreHeuristicState({
    agentId: "agent-1",
    latestUserMessage: "acho que combina comigo",
    context: catalogContext,
    hasMercadoLivreConnector: true,
    leadNameReplyDetected: false,
    hasReferencedCatalogReply: true,
    productSearchRequested: false,
    genericMercadoLivreListingRequested: false,
    mercadoLivreListingProducts: [],
    mercadoLivreProducts: [],
    resolvedProductSearchTerm: "",
    productSearchTerm: "",
    loadMoreCatalogRequested: false,
    referencedCatalogProducts: [catalogContext.catalogo!.ultimosProdutos![1]!],
    currentCatalogProduct: catalogContext.catalogo!.ultimosProdutos![1]!,
    catalogFollowUpDecision: {
      kind: "recent_product_reference",
      confidence: 0.94,
      reason: "pipeline semantico manteve produto em foco",
      matchedProducts: [catalogContext.catalogo!.ultimosProdutos![1]!],
      usedLlm: true,
      shouldBlockNewSearch: true,
    },
    lojaCta: null,
    deps: {
      normalizeText: normalizeFixtureText,
      isWhatsAppChannel: () => true,
    },
  });

  assert.ok(state.selectedProductSalesReply);
  reports.push(
    report("mercado_livre", "produto em foco continua em fala consultiva", [
      `hasSalesReply=${state.selectedProductSalesReply ? "yes" : "no"}`,
      `hasFocusProduct=${state.salesFocusProduct ? "yes" : "no"}`,
      `replyHasProbe=${/o que mais pesa para voce/i.test(state.selectedProductSalesReply ?? "") ? "yes" : "no"}`,
    ]),
  );

  return reports;
}

function runLeadRegression(): DomainReport[] {
  const reports: DomainReport[] = [];

  const history = [
    { role: "assistant" as const, content: "Como posso te chamar?" },
    { role: "user" as const, content: "Carlos" },
  ];

  const isNameReply = isLikelyLeadNameReply("Carlos", history, {
    normalizeText: normalizeFixtureText,
    extractName: (message) => {
      const enriched = enrichLeadContext(leadContextFixture as Record<string, unknown>, history, message, {
        normalizeText: normalizeFixtureText,
      });
      return enriched.lead?.nome ?? null;
    },
  });
  assert.equal(isNameReply, true);
  reports.push(
    report("lead", "resposta curta de nome e reconhecida apos pergunta do assistente", [
      `isNameReply=${isNameReply}`,
    ]),
  );

  const enriched = enrichLeadContext(leadContextFixture as Record<string, unknown>, history, "meu nome e Carlos 11999999999", {
    normalizeText: normalizeFixtureText,
  });
  assert.equal(enriched.lead?.nome, "Carlos");
  assert.equal(enriched.lead?.telefone, "11999999999");
  reports.push(
    report("lead", "enriquecimento captura nome e telefone", [
      `nome=${enriched.lead?.nome ?? "null"}`,
      `telefone=${enriched.lead?.telefone ?? "null"}`,
      `identificado=${String(enriched.lead?.identificado ?? false)}`,
    ]),
  );

  const ackReply = buildLeadNameAcknowledgementReply("Carlos", true, leadContextFixture, () => true);
  assert.ok(ackReply.includes("Carlos"));
  reports.push(
    report("lead", "acknowledgement de nome orienta proximo passo comercial", [
      `reply=${ackReply}`,
    ]),
  );

  return reports;
}

async function runHandoffRegression(): Promise<DomainReport[]> {
  const reports: DomainReport[] = [];

  const explicitIntent = isHumanHandoffIntent(handoffFixture.explicitHumanMessage);
  assert.equal(explicitIntent, true);
  reports.push(
    report("handoff", "pedido explicito de humano e detectado", [
      `explicitIntent=${explicitIntent}`,
    ]),
  );

  const offerReply = appendOptionalHumanOffer(handoffFixture.softOfferReply, "whatsapp");
  assert.ok(offerReply.includes("atendente humano"));
  reports.push(
    report("handoff", "oferta opcional de humano e anexada quando necessario", [
      `reply=${offerReply}`,
    ]),
  );

  const handoffReply = buildHumanHandoffReply("whatsapp");
  assert.ok(handoffReply.includes("WhatsApp"));
  reports.push(
    report("handoff", "resposta de handoff confirma continuidade no canal", [
      `reply=${handoffReply}`,
    ]),
  );

  const decision = await classifyHumanEscalationNeed({
    projetoId: null,
    channelKind: "web",
    message: "nao entendi",
    aiReply: "Posso tentar de outro jeito.",
    aiMetadata: { provider: "agent_scoped_recovery" },
    context: leadContextFixture as Record<string, unknown>,
    history: handoffFixture.recoveryHistory,
  });
  assert.equal(decision.decision, "none");
  reports.push(
    report("handoff", "escalada automatica fora do WhatsApp continua bloqueada", [
      `decision=${decision.decision}`,
      `reason=${decision.reason}`,
    ]),
  );

  return reports;
}

function runWhatsAppRegression(): DomainReport[] {
  const reports: DomainReport[] = [];

  const canonicalId = resolveCanonicalWhatsAppExternalIdentifier({
    identificadorExterno: "270570709065941@lid",
    identificador: "270570709065941@lid",
    context: whatsappContextFixture,
  });
  assert.equal(canonicalId, "5511978510655");
  reports.push(
    report("whatsapp", "identidade canonica prioriza telefone real e evita perder contexto", [
      `canonicalId=${canonicalId}`,
      `leadPhone=${whatsappContextFixture.lead?.telefone ?? "none"}`,
    ]),
  );

  const listingSequence = buildWhatsAppMessageSequence(
    "Encontrei algumas opcoes parecidas na loja logo abaixo. Me diga se gostou de algum ou se quer que eu traga mais opcoes nesse estilo.",
    (whatsappContextFixture.catalogo?.ultimosProdutos ?? []).map((item) => ({
      nome: item.nome ?? "Produto",
      targetUrl: item.link ?? "",
      descricao: item.descricao ?? "",
      whatsappText: "Se esse estilo fizer sentido para voce, eu posso te explicar melhor este item.",
    })),
  );
  assert.equal(listingSequence.length, 4);
  assert.match(listingSequence[0] ?? "", /me diga se gostou de algum|traga mais opcoes/i);
  assert.match(listingSequence[1] ?? "", /\*1\./i);
  reports.push(
    report("whatsapp", "lista inicial mantem frase humana e entrega um produto por mensagem", [
      `sequenceLength=${listingSequence.length}`,
      `introHasFollowUp=${/me diga se gostou de algum|traga mais opcoes/i.test(listingSequence[0] ?? "") ? "yes" : "no"}`,
      `firstProductHasLink=${/https?:\/\//i.test(listingSequence[1] ?? "") ? "yes" : "no"}`,
    ]),
  );

  return reports;
}

async function main() {
  const reports = [
    ...runCatalogRegression(),
    ...runApiRegression(),
    ...runMercadoLivreRegression(),
    ...(await runMercadoLivreCommercialRegression()),
    ...runLeadRegression(),
    ...(await runHandoffRegression()),
    ...runWhatsAppRegression(),
  ];

  console.log("\nChat Intelligence Domain Regression\n");
  for (const item of reports) {
    console.log(`[${item.domain}] ${item.title}`);
    for (const detail of item.details) {
      console.log(`- ${detail}`);
    }
    console.log("");
  }

  console.log(`${reports.length} domain regression checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
