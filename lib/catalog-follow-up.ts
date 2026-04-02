import "server-only";

import type { CatalogProductReference, ConversationContext } from "@/lib/chat-context";
import { isWhatsAppChannel, levenshteinDistance, normalizeText } from "@/lib/chat-text-utils";

export type CatalogFollowUpDecisionKind =
  | "recent_product_reference"
  | "recent_product_reference_ambiguous"
  | "new_product_search"
  | "load_more_results"
  | "non_catalog_message";

export type CatalogFollowUpDecision = {
  kind: CatalogFollowUpDecisionKind;
  confidence: number;
  reason: string;
  matchedProducts: CatalogProductReference[];
  usedLlm: boolean;
  shouldBlockNewSearch: boolean;
};

export type CatalogReferenceReplyAsset = {
  id: string;
  nome: string;
  descricao: string;
  arquivoNome: string;
  mimeType: string;
  categoria: "image";
  publicUrl: string;
  targetUrl?: string | null;
};

export type CatalogReferenceHeuristicReply = {
  mode: "catalog_reference_resolution" | "catalog_reference_ambiguous";
  logMessage: string;
  reply: string;
  assets: CatalogReferenceReplyAsset[];
  metadata: {
    provider: "heuristic";
    model: "catalog_reference_resolution" | "catalog_reference_ambiguous";
    agenteId: string | null;
    agenteNome: string | null;
    catalogoProdutoAtual?: CatalogProductReference | null;
  };
  tracePayload?: {
    matchedCount?: number;
    recentCount?: number;
  };
};

type CatalogFollowUpDeps = {
  buildProductSearchCandidates: (message: string) => string[];
  shouldSearchProducts: (message: string) => boolean;
  isMercadoLivrePurchaseIntent: (message: string) => boolean;
  isMercadoLivreDetailIntent: (message: string) => boolean;
};

function getCatalogProductRefForDetails(product: CatalogProductReference | null | undefined) {
  if (!product) return null;
  if (typeof product.id === "string" && /^MLB\d+$/i.test(product.id.trim())) return product.id.trim();
  if (typeof product.link === "string" && product.link.trim()) return product.link.trim();
  return typeof product.id === "string" && product.id.trim() ? product.id.trim() : null;
}

function isGreetingOrAckMessage(message: string) {
  const normalized = normalizeText(message)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;

  return [
    "oi",
    "ola",
    "opa",
    "e ai",
    "ei",
    "bom dia",
    "boa tarde",
    "boa noite",
    "obrigado",
    "obrigada",
    "valeu",
    "blz",
    "beleza",
    "tudo bem",
    "ok",
    "okay",
    "show",
    "top",
    "perfeito",
    "entendi",
    "certo",
    "sim",
    "nao",
  ].includes(normalized);
}

export function normalizeRecentCatalogProducts(context?: ConversationContext): CatalogProductReference[] {
  if (!Array.isArray(context?.catalogo?.ultimosProdutos)) {
    return [];
  }

  return context.catalogo.ultimosProdutos
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : null,
      nome: typeof item.nome === "string" ? item.nome : null,
      descricao: typeof item.descricao === "string" ? item.descricao : null,
      preco: typeof item.preco === "number" && Number.isFinite(item.preco) ? item.preco : null,
      link: typeof item.link === "string" ? item.link : null,
      imagem: typeof item.imagem === "string" ? item.imagem : null,
      cardIndex: typeof item.cardIndex === "number" && Number.isFinite(item.cardIndex) ? item.cardIndex : null,
    }))
    .filter((item) => item.nome);
}

export function hasRecentCatalogSnapshot(context?: ConversationContext) {
  const products = normalizeRecentCatalogProducts(context);
  if (!products.length) return false;

  const snapshotTurnId = Number(context?.catalogo?.snapshotTurnId ?? NaN);
  const currentTurnId = Number(context?.memoria?.mensagem_count ?? NaN);
  if (Number.isFinite(snapshotTurnId) && Number.isFinite(currentTurnId)) {
    return currentTurnId - snapshotTurnId <= 6;
  }

  const snapshotCreatedAt = typeof context?.catalogo?.snapshotCreatedAt === "string" ? context.catalogo.snapshotCreatedAt : "";
  if (!snapshotCreatedAt) return true;

  const snapshotTime = new Date(snapshotCreatedAt).getTime();
  if (!Number.isFinite(snapshotTime)) return true;

  return Date.now() - snapshotTime <= 1000 * 60 * 30;
}

export function isCatalogLoadMoreIntent(message: string, context?: ConversationContext) {
  const normalized = normalizeText(message);
  if (!normalized || !normalizeRecentCatalogProducts(context).length) return false;

  const compact = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!compact) return false;

  if (["mais", "outras", "outros", "mais opcoes", "outras opcoes", "mais modelos", "outros modelos"].includes(compact)) {
    return true;
  }

  return [
    /\btem mais\b/,
    /\bquero mais\b/,
    /\bme mostra mais\b/,
    /\bmostra mais\b/,
    /\btraz mais\b/,
    /\bmanda mais\b/,
    /\bver mais\b/,
    /\boutras opcoes\b/,
    /\boutros modelos\b/,
    /\bmais modelos\b/,
    /\bmais opcoes\b/,
  ].some((pattern) => pattern.test(normalized));
}

function tokenizeCatalogReferenceMessage(message: string) {
  return normalizeText(message)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .filter(
      (token) =>
        ![
          "esse",
          "essa",
          "esses",
          "essas",
          "aquele",
          "aquela",
          "aquilo",
          "produto",
          "produtos",
          "item",
          "itens",
          "bonita",
          "bonito",
          "lindo",
          "linda",
          "quero",
          "gostei",
          "desse",
          "dessa",
          "dele",
          "dela",
        ].includes(token),
    );
}

function fuzzyTokenMatchesText(token: string, text: string) {
  if (!token || !text) return false;
  if (text.includes(token)) return true;

  const words = text.split(/\s+/).filter((word) => word.length >= 3);
  return words.some((word) => {
    if (word === token) return true;
    if (Math.abs(word.length - token.length) > 2) return false;
    return levenshteinDistance(word, token) <= 2;
  });
}

const COLOR_FAMILIES = [
  ["amarelo", "amarela", "amarelos", "amarelas"],
  ["azul", "azuis"],
  ["branco", "branca", "brancos", "brancas"],
  ["preto", "preta", "pretos", "pretas"],
  ["verde", "verdes"],
  ["vermelho", "vermelha", "vermelhos", "vermelhas"],
  ["rosa", "rosas"],
  ["bege", "beges"],
  ["cinza", "cinzas"],
  ["dourado", "dourada", "dourados", "douradas"],
  ["prata"],
];

function normalizeColorToken(token: string) {
  const normalized = normalizeText(token).trim();
  for (const family of COLOR_FAMILIES) {
    if (family.includes(normalized)) {
      return family[0];
    }
  }

  return normalized;
}

function extractColorSignals(text: string) {
  const normalized = normalizeText(text).replace(/[^\p{L}\p{N}\s]/gu, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const colors = new Set<string>();

  for (const token of tokens) {
    const family = normalizeColorToken(token);
    if (COLOR_FAMILIES.some((group) => group[0] === family)) {
      colors.add(family);
    }
  }

  return [...colors];
}

function messageLooksLikeColorOnlyReference(message: string) {
  const tokens = tokenizeCatalogReferenceMessage(message);
  if (!tokens.length || tokens.length > 2) {
    return false;
  }

  return tokens.every((token) => COLOR_FAMILIES.some((family) => family.includes(token) || family[0] === normalizeColorToken(token)));
}

export function isRecentCatalogReferenceAttempt(message: string, context?: ConversationContext) {
  const products = normalizeRecentCatalogProducts(context);
  if (!products.length) return false;

  const normalized = normalizeText(message);
  return /\b(esse|essa|esses|essas|aquele|aquela|aqueles|aquelas|primeiro|segundo|terceiro|ultimo|último|mais caro|mais barato)\b/.test(
    normalized,
  );
}

function hasCatalogReferenceSignal(message: string, context: ConversationContext | undefined, deps: CatalogFollowUpDeps) {
  const normalized = normalizeText(message);
  if (!normalized || !hasRecentCatalogSnapshot(context)) return false;

  if (isRecentCatalogReferenceAttempt(message, context)) return true;
  if (deps.isMercadoLivrePurchaseIntent(message) || deps.isMercadoLivreDetailIntent(message)) return true;

  return [
    /\b(mandou|manda|mostrou|mostra|passou|enviou|esse da lista|esse da loja|esse anuncio|essa opcao)\b/,
    /\b(a que voce mandou|a que vc mandou|o que voce mandou|o que vc mandou)\b/,
    /\b(da lista|do card|dos cards|da vitrine)\b/,
    /\b(desse|dessa|dele|dela|nele|nela)\b/,
  ].some((pattern) => pattern.test(normalized));
}

function hasStrongNewProductSearchSignal(message: string, deps: CatalogFollowUpDeps) {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  if (
    /\b(tem|procuro|estou procurando|quero ver|quero buscar|busca|buscar|acha|mostra|me mostra|me traz|traz|me indica)\b/.test(normalized) &&
    deps.buildProductSearchCandidates(message).length > 0
  ) {
    return true;
  }

  return /\b(produto|produtos|modelo|marca|cor|tamanho|sku|loja|mercado livre|catalogo)\b/.test(normalized);
}

function scoreRecentCatalogProductReference(
  message: string,
  product: CatalogProductReference,
  context: ConversationContext | undefined,
  deps: CatalogFollowUpDeps,
) {
  const normalized = normalizeText(message);
  const haystack = normalizeText([product.nome, product.descricao].filter(Boolean).join(" "));
  const tokens = tokenizeCatalogReferenceMessage(message);
  const messageColors = extractColorSignals(message);
  const productColors = extractColorSignals(haystack);
  let score = 0;

  if (typeof product.cardIndex === "number" && Number.isFinite(product.cardIndex)) {
    const humanIndex = product.cardIndex + 1;
    const ordinalPatterns = [
      new RegExp(`\\b${humanIndex}\\b`),
      humanIndex === 1 ? /\b(primeiro|um)\b/ : null,
      humanIndex === 2 ? /\b(segundo|dois)\b/ : null,
      humanIndex === 3 ? /\b(terceiro|tres)\b/ : null,
    ].filter(Boolean) as RegExp[];

    if (ordinalPatterns.some((pattern) => pattern.test(normalized))) score += 10;
  }

  if (typeof product.preco === "number" && Number.isFinite(product.preco)) {
    const roundedPrice = String(Math.round(product.preco));
    if (new RegExp(`\\b${roundedPrice}\\b`).test(normalized)) score += 8;
  }

  for (const token of tokens) {
    if (fuzzyTokenMatchesText(token, haystack)) {
      score += haystack.includes(token) ? 4 : 3;
    }
  }

  for (const color of messageColors) {
    if (productColors.includes(color)) {
      score += 4;
    }
  }

  if ((deps.isMercadoLivrePurchaseIntent(message) || deps.isMercadoLivreDetailIntent(message)) && context?.catalogo?.produtoAtual) {
    const currentRef = getCatalogProductRefForDetails(context.catalogo.produtoAtual);
    const productRef = getCatalogProductRefForDetails(product);
    if (currentRef && productRef && currentRef === productRef) score += 6;
  }

  if (hasCatalogReferenceSignal(message, context, deps) && !tokens.length && context?.catalogo?.produtoAtual) {
    const currentRef = getCatalogProductRefForDetails(context.catalogo.produtoAtual);
    const productRef = getCatalogProductRefForDetails(product);
    if (currentRef && productRef && currentRef === productRef) score += 7;
  }

  return score;
}

export function decideCatalogFollowUpHeuristically(
  message: string,
  context: ConversationContext | undefined,
  deps: CatalogFollowUpDeps,
): CatalogFollowUpDecision | null {
  const recentProducts = normalizeRecentCatalogProducts(context);
  if (!recentProducts.length || !hasRecentCatalogSnapshot(context)) return null;

  if (isCatalogLoadMoreIntent(message, context)) {
    return {
      kind: "load_more_results",
      confidence: 0.99,
      reason: "Cliente pediu mais opcoes do ultimo lote.",
      matchedProducts: [],
      usedLlm: false,
      shouldBlockNewSearch: false,
    };
  }

  const normalized = normalizeText(message).trim();
  if (!normalized) {
    return {
      kind: "non_catalog_message",
      confidence: 0.9,
      reason: "Mensagem vazia ou sem sinal de catalogo.",
      matchedProducts: [],
      usedLlm: false,
      shouldBlockNewSearch: true,
    };
  }

  if (isGreetingOrAckMessage(message)) {
    return {
      kind: "non_catalog_message",
      confidence: 0.98,
      reason: "Saudacao ou confirmacao curta apos lista recente.",
      matchedProducts: [],
      usedLlm: false,
      shouldBlockNewSearch: true,
    };
  }

  const messageColors = extractColorSignals(message);
  const colorOnlyReference = messageLooksLikeColorOnlyReference(message);
  if (colorOnlyReference && messageColors.length) {
    const colorMatchedProducts = recentProducts.filter((product) => {
      const haystack = [product.nome, product.descricao].filter(Boolean).join(" ");
      const productColors = extractColorSignals(haystack);
      return messageColors.some((color) => productColors.includes(color));
    });

    if (colorMatchedProducts.length > 1) {
      return {
        kind: "recent_product_reference_ambiguous",
        confidence: 0.6,
        reason: "Mensagem cita apenas cor compartilhada por mais de um produto recente.",
        matchedProducts: colorMatchedProducts.slice(0, 2),
        usedLlm: false,
        shouldBlockNewSearch: true,
      };
    }

    if (colorMatchedProducts.length === 1) {
      return {
        kind: "recent_product_reference",
        confidence: 0.76,
        reason: "Mensagem cita cor que identifica um produto recente especifico.",
        matchedProducts: colorMatchedProducts,
        usedLlm: false,
        shouldBlockNewSearch: true,
      };
    }
  }

  const scored = recentProducts
    .map((product) => ({ product, score: scoreRecentCatalogProductReference(message, product, context, deps) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scored.length) {
    const top = scored[0];
    const second = scored[1];

    if (top && second && colorOnlyReference && top.score - second.score <= 2) {
      return {
        kind: "recent_product_reference_ambiguous",
        confidence: 0.58,
        reason: "Mensagem cita apenas atributo compartilhado por mais de um produto recente.",
        matchedProducts: [top.product, second.product],
        usedLlm: false,
        shouldBlockNewSearch: true,
      };
    }

    if (top && top.score >= 8) {
      return {
        kind: "recent_product_reference",
        confidence: Math.min(0.99, 0.6 + top.score / 20),
        reason: "Heuristica encontrou referencia forte a produto mostrado recentemente.",
        matchedProducts: [top.product],
        usedLlm: false,
        shouldBlockNewSearch: true,
      };
    }

    if (top && second && top.score === second.score && top.score >= 4) {
      return {
        kind: "recent_product_reference_ambiguous",
        confidence: 0.62,
        reason: "Heuristica encontrou mais de um produto recente com a mesma pontuacao.",
        matchedProducts: [top.product, second.product],
        usedLlm: false,
        shouldBlockNewSearch: true,
      };
    }

    if (top && top.score >= 4 && hasCatalogReferenceSignal(message, context, deps)) {
      return {
        kind: "recent_product_reference",
        confidence: 0.74,
        reason: "Mensagem referencia a lista recente e existe candidato mais provavel.",
        matchedProducts: [top.product],
        usedLlm: false,
        shouldBlockNewSearch: true,
      };
    }
  }

  if (hasCatalogReferenceSignal(message, context, deps)) {
    return {
      kind: "recent_product_reference_ambiguous",
      confidence: 0.45,
      reason: "Mensagem parece referenciar produto recente, mas a heuristica nao cravou o item.",
      matchedProducts: recentProducts.slice(0, 3),
      usedLlm: false,
      shouldBlockNewSearch: true,
    };
  }

  if (hasStrongNewProductSearchSignal(message, deps) || deps.shouldSearchProducts(message)) {
    return {
      kind: "new_product_search",
      confidence: 0.8,
      reason: "Mensagem trouxe sinais claros de nova busca de produto.",
      matchedProducts: [],
      usedLlm: false,
      shouldBlockNewSearch: false,
    };
  }

  return {
    kind: "non_catalog_message",
    confidence: 0.7,
    reason: "Sem sinais suficientes para nova busca ou referencia a item recente.",
    matchedProducts: [],
    usedLlm: false,
    shouldBlockNewSearch: true,
  };
}

export function resolveRecentCatalogProductReference(message: string, context?: ConversationContext) {
  const products = normalizeRecentCatalogProducts(context);
  if (!products.length || !hasRecentCatalogSnapshot(context)) return [];

  const normalized = normalizeText(message);
  const explicitReferenceSignal = /\b(esse|essa|esses|essas|mandou|mostrou|primeiro|segundo|terceiro|ultimo|ultimo|dele|dela|desse|dessa|gostei|quero o)\b/.test(
    normalized,
  );
  const explicitNewSearchSignal = /\b(tem|procuro|procurando|buscar|busca|mostra|me mostra|acha|quero ver)\b/.test(normalized);

  if (explicitNewSearchSignal && !explicitReferenceSignal) {
    return [];
  }

  const ordinalMatchers = [
    { pattern: /\b(primeiro|1|um)\b/, index: 0 },
    { pattern: /\b(segundo|2|dois)\b/, index: 1 },
    { pattern: /\b(terceiro|3|tres)\b/, index: 2 },
    { pattern: /\b(quarto|4|quatro)\b/, index: 3 },
    { pattern: /\b(quinto|5|cinco)\b/, index: 4 },
    { pattern: /\b(ultimo|último)\b/, index: products.length - 1 },
  ];

  for (const matcher of ordinalMatchers) {
    if (matcher.index >= 0 && matcher.index < products.length && matcher.pattern.test(normalized)) {
      return [products[matcher.index]];
    }
  }

  if (/\b(mais caro)\b/.test(normalized)) {
    return [...products].filter((item) => typeof item.preco === "number").sort((a, b) => Number(b.preco ?? 0) - Number(a.preco ?? 0)).slice(0, 1);
  }

  if (/\b(mais barato)\b/.test(normalized)) {
    return [...products].filter((item) => typeof item.preco === "number").sort((a, b) => Number(a.preco ?? 0) - Number(b.preco ?? 0)).slice(0, 1);
  }

  const priceMatch = normalized.match(/\b(?:r\$?\s*)?(\d{2,6})(?:[.,]\d{1,2})?\b/);
  if (priceMatch) {
    const price = Number(priceMatch[1]);
    const byPrice = products.filter((item) => Number(item.preco ?? NaN) === price);
    if (byPrice.length) return byPrice.slice(0, 2);
  }

  const tokens = tokenizeCatalogReferenceMessage(message);
  if (!tokens.length) return [];

  const messageColors = extractColorSignals(message);
  if (messageColors.length) {
    const byColor = products.filter((item) => {
      const haystack = [item.nome, item.descricao].filter(Boolean).join(" ");
      const colors = extractColorSignals(haystack);
      return messageColors.some((color) => colors.includes(color));
    });

    if (byColor.length) {
      return byColor.slice(0, 2);
    }
  }

  const scored = products
    .map((item) => {
      const haystack = normalizeText([item.nome, item.descricao].filter(Boolean).join(" "));
      const score = tokens.reduce((total, token) => (fuzzyTokenMatchesText(token, haystack) ? total + 1 : total), 0);
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return [];
  const topScore = scored[0]?.score ?? 0;
  return scored.filter((entry) => entry.score === topScore).slice(0, 2).map((entry) => entry.item);
}

export function buildReferencedCatalogReply(products: CatalogProductReference[], context?: ConversationContext) {
  if (!products.length) {
    return null;
  }

  if (products.length === 1) {
    const product = products[0];
    const priceLabel = typeof product.preco === "number" ? `R$ ${product.preco.toLocaleString("pt-BR")}` : product.descricao ?? "";

    return isWhatsAppCatalogContext(context)
      ? `Acredito que voce esteja falando de ${product.nome}${priceLabel ? `, por ${priceLabel}` : ""}. Se quiser, eu posso te mostrar mais detalhes ou buscar opcoes parecidas.`
      : `Acredito que voce esteja falando de **${product.nome}**${priceLabel ? `, por **${priceLabel}**` : ""}. Se quiser, eu posso te mostrar mais detalhes ou buscar opcoes parecidas.`;
  }

  return isWhatsAppCatalogContext(context)
    ? "Acredito que voce esteja falando de uma destas opcoes logo abaixo. Se quiser, me diga o numero do card ou o preco para eu cravar qual delas."
    : "Acredito que voce esteja falando de uma destas opcoes logo abaixo. Se quiser, me diga o **numero do card** ou o **preco** para eu cravar qual delas.";
}

export function buildReferencedCatalogAssets(products: CatalogProductReference[]): CatalogReferenceReplyAsset[] {
  return products
    .filter((item) => item.nome && item.imagem)
    .slice(0, 2)
    .map((item, index) => ({
      id: item.id || `catalog-ref-${index + 1}`,
      nome: String(item.nome),
      descricao: typeof item.preco === "number" ? `R$ ${item.preco.toLocaleString("pt-BR")}` : String(item.descricao ?? ""),
      arquivoNome: String(item.nome),
      mimeType: "image/jpeg",
      categoria: "image",
      publicUrl: String(item.imagem),
      targetUrl: item.link || null,
    }));
}

export function buildAmbiguousCatalogReferenceReply(context?: ConversationContext) {
  return isWhatsAppCatalogContext(context)
    ? "Acho que voce esta se referindo a um dos produtos que acabei de mostrar. Me diga o numero do card ou o preco para eu identificar certinho."
    : "Acho que voce esta se referindo a um dos produtos que acabei de mostrar. Me diga o **numero do card** ou o **preco** para eu identificar certinho.";
}

export function resolveCatalogReferenceHeuristicReply(input: {
  context?: ConversationContext;
  agentId?: string | null;
  agentName?: string | null;
  referencedCatalogProducts: CatalogProductReference[];
  ambiguousCatalogReferenceReply: string | null;
  formatReply: (reply: string, context?: ConversationContext) => string;
}): CatalogReferenceHeuristicReply | null {
  const referencedCatalogReply = buildReferencedCatalogReply(input.referencedCatalogProducts, input.context);
  if (referencedCatalogReply) {
    return {
      mode: "catalog_reference_resolution",
      logMessage: "Referencia aos ultimos produtos do catalogo resolvida pelo contexto.",
      reply: input.formatReply(referencedCatalogReply, input.context),
      assets: buildReferencedCatalogAssets(input.referencedCatalogProducts),
      metadata: {
        provider: "heuristic",
        model: "catalog_reference_resolution",
        agenteId: input.agentId ?? null,
        agenteNome: input.agentName ?? null,
        catalogoProdutoAtual:
          input.referencedCatalogProducts.length === 1
            ? {
                id: input.referencedCatalogProducts[0]?.id ?? null,
                nome: input.referencedCatalogProducts[0]?.nome ?? null,
                descricao: input.referencedCatalogProducts[0]?.descricao ?? null,
                preco: input.referencedCatalogProducts[0]?.preco ?? null,
                link: input.referencedCatalogProducts[0]?.link ?? null,
                imagem: input.referencedCatalogProducts[0]?.imagem ?? null,
                cardIndex: input.referencedCatalogProducts[0]?.cardIndex ?? null,
              }
            : null,
      },
      tracePayload: {
        matchedCount: input.referencedCatalogProducts.length,
      },
    };
  }

  if (input.ambiguousCatalogReferenceReply) {
    const recentProducts = normalizeRecentCatalogProducts(input.context);
    return {
      mode: "catalog_reference_ambiguous",
      logMessage: "Referencia ambigua aos ultimos produtos do catalogo tratada com confirmacao.",
      reply: input.formatReply(input.ambiguousCatalogReferenceReply, input.context),
      assets: buildReferencedCatalogAssets(recentProducts),
      metadata: {
        provider: "heuristic",
        model: "catalog_reference_ambiguous",
        agenteId: input.agentId ?? null,
        agenteNome: input.agentName ?? null,
      },
      tracePayload: {
        recentCount: recentProducts.length,
      },
    };
  }

  return null;
}

function isWhatsAppCatalogContext(context?: ConversationContext) {
  return isWhatsAppChannel(context);
}
