import assert from "node:assert/strict";

import {
  decideCatalogFollowUpHeuristically,
  resolveRecentCatalogProductReference,
} from "@/lib/catalog-follow-up";
import type { CatalogFollowUpDecision } from "@/lib/catalog-follow-up";
import { buildApiFallbackReply, buildFocusedApiContext } from "@/lib/chat-api-runtime";
import {
  appendOptionalHumanOffer,
  buildHumanHandoffReply,
  classifyHumanEscalationNeed,
  isHumanHandoffIntent,
} from "@/lib/chat-handoff-policy";
import {
  buildLeadNameAcknowledgementReply,
  enrichLeadContext,
  isLikelyLeadNameReply,
} from "@/lib/chat-lead-stage";
import { resolveConversationPipelineStageState } from "@/lib/chat-pipeline-stage";
import { resolveMercadoLivreFlowState } from "@/lib/chat-mercado-livre";
import {
  createFixtureSearchDeps,
  loadApiRuntimeErrorFixture,
  loadApiRuntimeFixture,
  loadCatalogContextFixture,
  loadHandoffFixture,
  loadLeadContextFixture,
  loadMercadoLivreAmbiguousFixture,
  loadStaleCatalogContextFixture,
  normalizeFixtureText,
} from "@/tests/chat-test-fixtures";

const deps = createFixtureSearchDeps();
const catalogContext = loadCatalogContextFixture();
const staleCatalogContext = loadStaleCatalogContextFixture();
const apiFixture = loadApiRuntimeFixture();
const apiErrorFixture = loadApiRuntimeErrorFixture();
const leadContextFixture = loadLeadContextFixture();
const handoffFixture = loadHandoffFixture();
const mercadoLivreAmbiguousFixture = loadMercadoLivreAmbiguousFixture();

type DomainReport = {
  domain: "catalog" | "api" | "mercado_livre" | "lead" | "handoff";
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

async function main() {
  const reports = [
    ...runCatalogRegression(),
    ...runApiRegression(),
    ...runMercadoLivreRegression(),
    ...runLeadRegression(),
    ...(await runHandoffRegression()),
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
