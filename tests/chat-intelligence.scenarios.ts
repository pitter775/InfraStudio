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
import { resolveConversationPipelineStageState } from "@/lib/chat-pipeline-stage";
import {
  resolveMercadoLivreFlowState,
  resolveMercadoLivreHeuristicReply,
  resolveMercadoLivreHeuristicState,
} from "@/lib/chat-mercado-livre";
import {
  createFixtureSearchDeps,
  loadCatalogContextFixture,
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
    isMercadoLivreListingIntent: (message) => /\b(loja|catalogo|vitrine)\b/i.test(message),
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

async function main() {
  const scenarios: ScenarioResult[] = [];

  scenarios.push(await analyzeCatalogScenario("Contexto normal: item recente resolvido", "gostei da sopeira que mandou", baseContext));
  scenarios.push(await analyzeCatalogScenario("Fora da normalidade: typo forte", "gostei da dopeira que mandou", baseContext));
  scenarios.push(await analyzeCatalogScenario("Fora da normalidade: mensagem curta neutra", "oi", baseContext));
  scenarios.push(await analyzeCatalogScenario("Fora da normalidade: ambiguidade por cor", "quero o amarelo", baseContext));
  scenarios.push(await analyzeCatalogScenario("Catalogo: referencia por preco curto", "quero o de 250", baseContext));

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
  const historyFilePath = path.resolve(process.cwd(), `analise-chat-test-${safeTimestamp}.md`);
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


