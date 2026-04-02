import "server-only";

import {
  buscarProdutosMercadoLivrePorAgente,
  listarProdutosRecentesMercadoLivrePorAgente,
  obterDetalhesProdutoMercadoLivrePorAgente,
  type ProdutoDetalhadoMercadoLivre,
  type ProdutoPadronizado,
} from "@/lib/mercado-livre";
import type { CatalogFollowUpDecision } from "@/lib/catalog-follow-up";
import type { CatalogProductReference, ConversationContext } from "@/lib/chat-context";

export type MercadoLivreReplyAsset = {
  id: string;
  nome: string;
  descricao: string;
  arquivoNome: string;
  mimeType: string;
  categoria: "image";
  publicUrl: string;
  targetUrl?: string | null;
  whatsappText?: string | null;
};

export type MercadoLivreSearchResolution = {
  listingProducts: ProdutoPadronizado[];
  products: ProdutoPadronizado[];
  listingProductsForAssets: Array<ProdutoPadronizado | ProdutoDetalhadoMercadoLivre>;
  productsForAssets: Array<ProdutoPadronizado | ProdutoDetalhadoMercadoLivre>;
  resolvedProductSearchTerm: string;
};

export type MercadoLivreFlowState = {
  loadMoreCatalogRequested: boolean;
  detectedProductSearch: boolean;
  previousCatalogSearchTerm: string;
  preResolvedCatalogReferences: CatalogProductReference[];
  explicitCatalogReferenceRequested: boolean;
  genericMercadoLivreListingRequested: boolean;
  productSearchRequested: boolean;
  productSearchCandidates: string[];
  productSearchTerm: string;
  referencedCatalogProducts: CatalogProductReference[];
  currentCatalogProduct: CatalogProductReference | null;
};

export type MercadoLivreHeuristicState = {
  selectedCatalogProduct: CatalogProductReference | null;
  selectedCatalogProductDetails: ProdutoDetalhadoMercadoLivre | null;
  directSingleProduct: CatalogProductReference | null;
  directSingleProductDetails: ProdutoDetalhadoMercadoLivre | null;
  selectedProductSalesReply: string | null;
  salesFocusProduct: ProdutoDetalhadoMercadoLivre | null;
  ambiguousCatalogReferenceReply: string | null;
  mercadoLivreListingReply: string | null;
  mercadoLivrePromptContext: string;
  mercadoLivreDetailPromptContext: string;
  directMercadoLivreReply: string | null;
  mercadoLivreNoResultsReply: string | null;
  currentProductForMetadata: CatalogProductReference | null;
};

export type MercadoLivreHeuristicReply = {
  mode:
    | "mercado_livre_product_sales"
    | "mercado_livre_listing"
    | "mercado_livre_connector"
    | "mercado_livre_no_results";
  logMessage: string;
  reply: string;
  assets: MercadoLivreReplyAsset[];
  metadata: {
    provider: "heuristic";
    model:
      | "mercado_livre_product_sales"
      | "mercado_livre_listing"
      | "mercado_livre_connector"
      | "mercado_livre_no_results";
    agenteId: string | null;
    agenteNome: string | null;
    catalogoProdutoAtual?: CatalogProductReference | null;
  };
  tracePayload?: {
    productId?: string | null;
  };
};

type MercadoLivreDeps = {
  normalizeText: (value: string) => string;
  isWhatsAppChannel: (context?: ConversationContext) => boolean;
};

export function isMercadoLivrePurchaseIntent(message: string, deps: MercadoLivreDeps) {
  const normalized = deps.normalizeText(message);
  return /\b(gostei|quero|comprar|levar|fechar|pedido|interesse|tenho interesse|vou querer|separa|reservar|manda o link|me passa o link)\b/.test(
    normalized,
  );
}

export function isMercadoLivreDetailIntent(message: string, deps: MercadoLivreDeps) {
  const normalized = deps.normalizeText(message);
  return /\b(detalhe|detalhes|descricao|descrição|garantia|material|medida|medidas|tamanho|capacidade|cor|estoque|frete|entrega|condicao|condição|vendeu|vendidos)\b/.test(
    normalized,
  );
}

function formatMercadoLivreCondition(value: string | null | undefined, deps: MercadoLivreDeps) {
  const normalized = deps.normalizeText(value ?? "");
  if (normalized === "new") return "novo";
  if (normalized === "used") return "usado";
  return value?.trim() || null;
}

export function getCatalogProductRefForDetails(product: CatalogProductReference | null | undefined) {
  if (!product) return null;
  if (typeof product.id === "string" && /^MLB\d+$/i.test(product.id.trim())) return product.id.trim();
  if (typeof product.link === "string" && product.link.trim()) return product.link.trim();
  return typeof product.id === "string" && product.id.trim() ? product.id.trim() : null;
}

export function buildMercadoLivreListingReply(produtos: ProdutoPadronizado[], context: ConversationContext | undefined, deps: MercadoLivreDeps) {
  if (!produtos.length) {
    return deps.isWhatsAppChannel(context)
      ? "Nao encontrei produtos visiveis na loja neste momento."
      : "Nao encontrei produtos visiveis na loja neste momento.";
  }

  if (produtos.length === 1) {
    return deps.isWhatsAppChannel(context)
      ? 'Separei um produto da loja para voce logo abaixo. Se quiser ver mais opcoes, me responda "mais".'
      : "Separei um produto da loja logo abaixo. Se quiser, eu tambem posso buscar um modelo especifico.";
  }

  return deps.isWhatsAppChannel(context)
    ? 'Separei alguns produtos da loja para voce logo abaixo. Se quiser ver mais opcoes, me responda "mais".'
    : "Separei alguns produtos da loja logo abaixo. Se quiser, eu tambem posso buscar um modelo especifico.";
}

function buildAmbiguousCatalogReferenceReply(context: ConversationContext | undefined, deps: MercadoLivreDeps) {
  return deps.isWhatsAppChannel(context)
    ? "Acho que voce esta se referindo a um dos produtos que acabei de mostrar. Me diga o numero do card ou o preco para eu identificar certinho."
    : "Acho que voce esta se referindo a um dos produtos que acabei de mostrar. Me diga o **numero do card** ou o **preco** para eu identificar certinho.";
}

export function buildMercadoLivreNoResultsReply(
  termo: string,
  context: ConversationContext | undefined,
  options: { exhausted?: boolean } | undefined,
  deps: MercadoLivreDeps,
) {
  const termoLimpo = termo.trim() || "esse produto";
  if (options?.exhausted) {
    return deps.isWhatsAppChannel(context)
      ? "Ja te mostrei as opcoes mais relevantes que encontrei por agora. Se quiser, me diga outro nome, cor, tamanho ou modelo para eu buscar uma nova leva."
      : "Ja mostrei as opcoes mais relevantes encontradas ate aqui. Se quiser, me diga outro nome, cor, tamanho ou modelo para eu fazer uma nova busca.";
  }

  return deps.isWhatsAppChannel(context)
    ? `Nao encontrei resultados para "${termoLimpo}" na loja neste momento.\n\nSe quiser, eu posso tentar outra busca com um nome parecido, cor, tamanho ou modelo alternativo.`
    : `Nao encontrei resultados para **${termoLimpo}** na loja neste momento.\n\nSe quiser, eu posso tentar outra busca com um nome parecido, cor, tamanho ou modelo alternativo.`;
}

export function buildMercadoLivreDetailPromptContext(produto: ProdutoDetalhadoMercadoLivre | null) {
  if (!produto) return "";

  const atributos = (produto.atributos ?? []).map((item) => `- ${item.nome}: ${item.valor}`);
  return [
    "Produto atual em foco no Mercado Livre:",
    `- id: ${produto.id ?? ""}`,
    `- nome: ${produto.nome}`,
    `- preco: ${produto.preco}`,
    produto.condicao ? `- condicao: ${produto.condicao}` : "",
    produto.garantia ? `- garantia: ${produto.garantia}` : "",
    typeof produto.estoque === "number" ? `- estoque: ${produto.estoque}` : "",
    typeof produto.vendidos === "number" ? `- vendidos: ${produto.vendidos}` : "",
    typeof produto.freteGratis === "boolean" ? `- frete_gratis: ${produto.freteGratis ? "sim" : "nao"}` : "",
    typeof produto.pertenceALoja === "boolean" ? `- pertence_a_loja: ${produto.pertenceALoja ? "sim" : "nao"}` : "",
    produto.descricao ? `- descricao: ${produto.descricao}` : "",
    ...atributos,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildMercadoLivreSalesReply(
  produto: ProdutoDetalhadoMercadoLivre,
  latestUserMessage: string,
  context: ConversationContext | undefined,
  cta: string | null | undefined,
  deps: MercadoLivreDeps,
) {
  const normalized = deps.normalizeText(latestUserMessage);
  const storeOwnershipNote =
    produto.pertenceALoja === false
      ? "Vi que esse link e de um anuncio fora da loja conectada aqui."
      : null;

  if (/\bgarantia\b/.test(normalized)) {
    const garantia = produto.garantia?.trim() || "Nao encontrei garantia informada no anuncio";
    const baseReply = deps.isWhatsAppChannel(context)
      ? `${produto.nome}: ${garantia}.\n\nSe quiser, eu tambem posso te dizer condicao, estoque e frete para voce decidir melhor.`
      : `**${produto.nome}**: ${garantia}.\n\nSe quiser, eu tambem posso te dizer **condicao, estoque e frete** para voce decidir melhor.`;
    return [storeOwnershipNote, baseReply].filter(Boolean).join("\n\n");
  }

  if (/\bfrete\b|\bentrega\b/.test(normalized)) {
    const frete =
      typeof produto.freteGratis === "boolean"
        ? produto.freteGratis
          ? "O anuncio indica frete gratis."
          : "O anuncio nao indica frete gratis."
        : "Nao encontrei frete detalhado no anuncio.";
    return [storeOwnershipNote, frete, cta?.trim() || "Se quiser, eu sigo com voce e vejo se vale a pena fechar este item ou comparar com outro parecido."].filter(Boolean).join("\n\n");
  }

  if (/\bestoque\b|\bdisponivel\b/.test(normalized)) {
    const estoque =
      typeof produto.estoque === "number"
        ? `No anuncio aparecem ${produto.estoque} unidade(s) disponivel(is).`
        : "Nao encontrei estoque detalhado no anuncio.";
    return [storeOwnershipNote, estoque, cta?.trim() || "Se quiser, eu sigo com voce e te ajudo a decidir se vale fechar este item agora."].filter(Boolean).join("\n\n");
  }

  if (/\bmaterial\b|\bmedida\b|\bmedidas\b|\btamanho\b|\bcapacidade\b|\bcor\b/.test(normalized)) {
    const matchingAttributes = (produto.atributos ?? []).filter((item) =>
      /\b(material|medida|medidas|tamanho|capacidade|cor)\b/.test(deps.normalizeText(item.nome)),
    );
    if (matchingAttributes.length) {
      const summary = matchingAttributes.slice(0, 3).map((item) => `${item.nome}: ${item.valor}`).join(" | ");
      return [storeOwnershipNote, `Encontrei estes detalhes no anuncio: ${summary}.`, cta?.trim() || "Se quiser, eu tambem posso te falar de garantia, estoque e frete antes de voce decidir."].filter(Boolean).join("\n\n");
    }

    if (produto.descricao) {
      return [storeOwnershipNote, `Na descricao do anuncio encontrei isto que ajuda na sua duvida: ${produto.descricao}`, cta?.trim() || "Se quiser, eu tambem posso te resumir garantia, estoque e frete deste item."].filter(Boolean).join("\n\n");
    }
  }

  const highlights: string[] = [];
  if (produto.atributos?.length) highlights.push(...produto.atributos.slice(0, 3).map((item) => `${item.nome}: ${item.valor}`));
  const condition = formatMercadoLivreCondition(produto.condicao, deps);
  if (condition) highlights.push(`Condicao: ${condition}`);
  if (produto.garantia) highlights.push(`Garantia: ${produto.garantia}`);
  if (typeof produto.freteGratis === "boolean") highlights.push(produto.freteGratis ? "Frete gratis" : "Frete a consultar");
  if (typeof produto.vendidos === "number" && produto.vendidos > 0) highlights.push(`${produto.vendidos} vendas`);

  const leadIn = deps.isWhatsAppChannel(context)
    ? `Boa escolha. ${produto.nome} esta por R$ ${produto.preco.toLocaleString("pt-BR")}.`
    : `**Boa escolha.** ${produto.nome} esta por **R$ ${produto.preco.toLocaleString("pt-BR")}**.`;
  const sellingPoint = highlights.length
    ? `Pelo anuncio, os pontos que mais ajudam na decisao sao: ${highlights.join(" | ")}.`
    : produto.descricao
    ? produto.descricao
    : "Posso te detalhar melhor esse item e te ajudar a decidir com mais seguranca.";
  const close = cta?.trim() ? cta.trim() : "Se fizer sentido para voce, me diga se quer seguir com este item ou comparar com outra opcao parecida.";

  return [storeOwnershipNote, leadIn, sellingPoint, close].filter(Boolean).join("\n\n");
}

function buildMercadoLivreWhatsAppSupportText(
  produto: ProdutoPadronizado | ProdutoDetalhadoMercadoLivre,
  latestUserMessage: string | null | undefined,
  deps: MercadoLivreDeps,
) {
  const detailed = produto as ProdutoDetalhadoMercadoLivre;
  const latestMessage = typeof latestUserMessage === "string" ? latestUserMessage : "";
  const isTechnicalIntent = latestMessage ? isMercadoLivreDetailIntent(latestMessage, deps) : false;
  const isCommercialIntent = latestMessage ? isMercadoLivrePurchaseIntent(latestMessage, deps) : false;
  const highlights: string[] = [];

  if (Array.isArray(detailed.atributos) && detailed.atributos.length) {
    highlights.push(...detailed.atributos.slice(0, 2).map((item) => `${item.nome}: ${item.valor}`));
  }
  if (typeof detailed.freteGratis === "boolean") highlights.push(detailed.freteGratis ? "Frete gratis" : "Frete a consultar");
  if (typeof detailed.estoque === "number") highlights.push(`Estoque: ${detailed.estoque}`);

  if (highlights.length) {
    if (isTechnicalIntent) return `Nesse anuncio vi estes pontos que ajudam na sua duvida: ${highlights.join(" | ")}.`;
    if (isCommercialIntent) return `Esse modelo pode encaixar bem no que voce pediu: ${highlights.join(" | ")}.`;
    return highlights.join(" | ");
  }

  if (typeof detailed.descricao === "string" && detailed.descricao.trim()) {
    const compactDescription = detailed.descricao.trim().replace(/\s+/g, " ").slice(0, 220);
    if (isTechnicalIntent) return `Nesse anuncio vi um resumo util para sua duvida: ${compactDescription}`;
    if (isCommercialIntent) return `Esse modelo pode encaixar bem no que voce pediu. Se fizer sentido, te explico os detalhes e ja seguimos. ${compactDescription}`;
    return compactDescription;
  }

  if (isCommercialIntent) return "Esse modelo pode encaixar bem no que voce pediu. Se fizer sentido, te explico os detalhes e ja seguimos.";
  if (isTechnicalIntent) return "Nesse anuncio vi pontos que podem ajudar na sua duvida. Se quiser, eu te explico os detalhes mais importantes.";
  return "";
}

export function buildMercadoLivreProductAssets(
  produtos: Array<ProdutoPadronizado | ProdutoDetalhadoMercadoLivre>,
  latestUserMessage: string | null | undefined,
  deps: MercadoLivreDeps,
): MercadoLivreReplyAsset[] {
  return produtos.slice(0, 3).map((produto, index) => ({
    id: produto.id || `mercado-livre-${index + 1}-${deps.normalizeText(produto.nome).replace(/\s+/g, "-") || "produto"}`,
    nome: produto.nome,
    descricao: `R$ ${produto.preco.toLocaleString("pt-BR")}`,
    arquivoNome: produto.nome,
    mimeType: "image/jpeg",
    categoria: "image",
    publicUrl: produto.imagem,
    targetUrl: produto.link,
    whatsappText: buildMercadoLivreWhatsAppSupportText(produto, latestUserMessage, deps) || null,
  }));
}

export function buildMercadoLivreReply(produtos: ProdutoPadronizado[], context: ConversationContext | undefined, deps: MercadoLivreDeps) {
  if (!produtos.length) return null;
  if (produtos.length === 1) {
    return deps.isWhatsAppChannel(context)
      ? 'Encontrei um produto da loja para voce logo abaixo. Se quiser ver outras opcoes parecidas, me responda "mais".'
      : "Encontrei um produto da loja logo abaixo. Se quiser, eu posso buscar outras opcoes parecidas.";
  }
  return deps.isWhatsAppChannel(context)
    ? 'Encontrei algumas opcoes parecidas na loja logo abaixo. Se quiser ver outras sem repetir estas, me responda "mais".'
    : "Encontrei algumas opcoes parecidas na loja logo abaixo. Se quiser, eu posso buscar mais variacoes desse produto.";
}

export function buildMercadoLivreSingleResultReply(
  produto: ProdutoDetalhadoMercadoLivre,
  context: ConversationContext | undefined,
  cta: string | null | undefined,
  deps: MercadoLivreDeps,
) {
  const highlights: string[] = [];
  if (produto.atributos?.length) highlights.push(...produto.atributos.slice(0, 3).map((item) => `${item.nome}: ${item.valor}`));
  const condition = formatMercadoLivreCondition(produto.condicao, deps);
  if (condition) highlights.push(`Condicao: ${condition}`);
  if (produto.garantia) highlights.push(`Garantia: ${produto.garantia}`);
  if (typeof produto.estoque === "number") highlights.push(`Estoque: ${produto.estoque}`);
  if (typeof produto.freteGratis === "boolean") highlights.push(produto.freteGratis ? "Frete gratis" : "Frete a consultar");

  const intro = deps.isWhatsAppChannel(context)
    ? `Encontrei um produto que combina com a sua busca: ${produto.nome}. Ele esta por R$ ${produto.preco.toLocaleString("pt-BR")}.`
    : `Encontrei um produto que combina com a busca: **${produto.nome}** por **R$ ${produto.preco.toLocaleString("pt-BR")}**.`;

  const details = highlights.length ? `Resumo rapido: ${highlights.join(" | ")}.` : produto.descricao ? produto.descricao : "Posso te explicar melhor os detalhes desse item se voce quiser.";
  const close = cta?.trim() ? cta.trim() : 'Se quiser, eu tambem posso buscar outras opcoes parecidas. No WhatsApp, basta responder "mais".';
  return [intro, details, close].filter(Boolean).join("\n\n");
}

export function buildMercadoLivrePromptContext(produtos: ProdutoPadronizado[]) {
  if (!produtos.length) return "";
  return [
    "Produtos encontrados no conector Mercado Livre do agente:",
    ...produtos.map((produto) => `- nome: ${produto.nome} | preco: ${produto.preco} | link: ${produto.link}`),
    "Se o cliente estiver buscando produto, responda com base nesses itens e convide para refinar a busca se necessario.",
  ].join("\n");
}

export async function resolveMercadoLivreSearch(input: {
  agentId: string;
  context?: ConversationContext;
  genericListingRequested: boolean;
  productSearchRequested: boolean;
  productSearchCandidates: string[];
  productSearchTerm: string;
  recentCatalogProducts: CatalogProductReference[];
  loadMoreCatalogRequested: boolean;
  deps: MercadoLivreDeps;
}) {
  const mercadoLivreListingSnapshot = input.genericListingRequested
    ? await listarProdutosRecentesMercadoLivrePorAgente(input.agentId)
    : null;
  const listingProducts = mercadoLivreListingSnapshot?.produtos ?? [];

  let products: ProdutoPadronizado[] = [];
  let resolvedProductSearchTerm = input.productSearchTerm;

  if (input.productSearchRequested) {
    const excludedProductRefs = input.loadMoreCatalogRequested
      ? input.recentCatalogProducts
          .flatMap((item) => [typeof item.id === "string" ? item.id : null, typeof item.link === "string" ? item.link : null])
          .filter((item): item is string => Boolean(item))
      : [];
    const aggregatedProducts: ProdutoPadronizado[] = [];
    const seenProductRefs = new Set<string>();

    for (const candidate of input.productSearchCandidates) {
      const currentProducts = await buscarProdutosMercadoLivrePorAgente(input.agentId, candidate, {
        excludeRefs: [
          ...excludedProductRefs,
          ...aggregatedProducts.flatMap((item) => [typeof item.id === "string" ? item.id : null, typeof item.link === "string" ? item.link : null]),
        ].filter((item): item is string => Boolean(item)),
        limit: 3,
      });

      if (!currentProducts.length) {
        continue;
      }

      if (!resolvedProductSearchTerm) {
        resolvedProductSearchTerm = candidate;
      }

      for (const product of currentProducts) {
        const ref = (
          String(product.id || "").trim().toLowerCase() ||
          String(product.link || "").trim().toLowerCase() ||
          `${input.deps.normalizeText(product.nome)}|${product.preco}`
        ).trim();

        if (!ref || seenProductRefs.has(ref)) {
          continue;
        }

        seenProductRefs.add(ref);
        aggregatedProducts.push(product);
      }

      if (!resolvedProductSearchTerm && aggregatedProducts.length) {
        resolvedProductSearchTerm = candidate;
      }

      if (aggregatedProducts.length >= 3) {
        break;
      }
    }

    products = aggregatedProducts.slice(0, 3);
  }

  const enrichForWhatsApp = async (items: ProdutoPadronizado[]) => {
    if (!input.deps.isWhatsAppChannel(input.context) || !items.length) {
      return items;
    }

    const detailedProducts = await Promise.all(
      items.slice(0, 3).map(async (product) => {
        const ref = getCatalogProductRefForDetails({
          id: product.id ?? null,
          link: product.link ?? null,
        });
        if (!ref) {
          return product;
        }

        const detailed = await obterDetalhesProdutoMercadoLivrePorAgente(input.agentId, ref);
        return detailed ?? product;
      }),
    );

    return detailedProducts;
  };

  return {
    listingProducts,
    products,
    listingProductsForAssets: await enrichForWhatsApp(listingProducts),
    productsForAssets: await enrichForWhatsApp(products),
    resolvedProductSearchTerm,
  } satisfies MercadoLivreSearchResolution;
}

export function resolveMercadoLivreFlowState(input: {
  latestUserMessage: string;
  context?: ConversationContext;
  hasMercadoLivreConnector: boolean;
  leadNameReplyDetected: boolean;
  recentCatalogProducts: CatalogProductReference[];
  catalogFollowUpDecision: CatalogFollowUpDecision | null;
  detectProductSearch: () => boolean;
  buildProductSearchCandidates: (message: string) => string[];
  resolveRecentCatalogProductReference: (message: string, context?: ConversationContext) => CatalogProductReference[];
  isRecentCatalogReferenceAttempt: (message: string, context?: ConversationContext) => boolean;
  isMercadoLivreListingIntent: (message: string) => boolean;
  shouldUseMercadoLivreConnectorFallback: () => boolean;
}) {
  const loadMoreCatalogRequested = input.catalogFollowUpDecision?.kind === "load_more_results";
  const detectedProductSearch =
    input.catalogFollowUpDecision?.kind === "new_product_search"
      ? true
      : input.catalogFollowUpDecision?.shouldBlockNewSearch
      ? false
      : input.detectProductSearch();
  const previousCatalogSearchTerm = typeof input.context?.catalogo?.ultimaBusca === "string" ? input.context.catalogo.ultimaBusca.trim() : "";
  const preResolvedCatalogReferences =
    input.catalogFollowUpDecision?.kind === "recent_product_reference" ||
    input.catalogFollowUpDecision?.kind === "recent_product_reference_ambiguous"
      ? input.catalogFollowUpDecision.matchedProducts
      : input.hasMercadoLivreConnector && !input.leadNameReplyDetected && input.recentCatalogProducts.length
      ? input.resolveRecentCatalogProductReference(input.latestUserMessage, input.context)
      : [];
  const explicitCatalogReferenceRequested =
    input.hasMercadoLivreConnector &&
    !input.leadNameReplyDetected &&
    !loadMoreCatalogRequested &&
    (input.catalogFollowUpDecision?.kind === "recent_product_reference" ||
      input.catalogFollowUpDecision?.kind === "recent_product_reference_ambiguous" ||
      preResolvedCatalogReferences.length > 0 ||
      input.isRecentCatalogReferenceAttempt(input.latestUserMessage, input.context));
  const genericMercadoLivreListingRequested =
    input.hasMercadoLivreConnector &&
    input.isMercadoLivreListingIntent(input.latestUserMessage) &&
    !input.leadNameReplyDetected &&
    !loadMoreCatalogRequested;
  const productSearchRequested =
    !genericMercadoLivreListingRequested &&
    !explicitCatalogReferenceRequested &&
    !input.leadNameReplyDetected &&
    (input.catalogFollowUpDecision?.kind === "new_product_search" ||
      loadMoreCatalogRequested ||
      detectedProductSearch ||
      (input.catalogFollowUpDecision?.shouldBlockNewSearch ? false : input.hasMercadoLivreConnector && input.shouldUseMercadoLivreConnectorFallback()));
  const productSearchSeed = loadMoreCatalogRequested ? previousCatalogSearchTerm : input.latestUserMessage;
  const productSearchCandidates = productSearchRequested ? input.buildProductSearchCandidates(productSearchSeed) : [];
  const productSearchTerm = productSearchCandidates[0] ?? "";
  const referencedCatalogProducts =
    input.hasMercadoLivreConnector && !input.leadNameReplyDetected && !productSearchRequested && !genericMercadoLivreListingRequested
      ? preResolvedCatalogReferences
      : [];
  const currentCatalogProduct =
    !productSearchRequested && input.context?.catalogo?.produtoAtual && typeof input.context.catalogo.produtoAtual === "object"
      ? input.context.catalogo.produtoAtual
      : null;

  return {
    loadMoreCatalogRequested,
    detectedProductSearch,
    previousCatalogSearchTerm,
    preResolvedCatalogReferences,
    explicitCatalogReferenceRequested,
    genericMercadoLivreListingRequested,
    productSearchRequested,
    productSearchCandidates,
    productSearchTerm,
    referencedCatalogProducts,
    currentCatalogProduct,
  } satisfies MercadoLivreFlowState;
}

export async function resolveMercadoLivreHeuristicState(input: {
  agentId?: string | null;
  latestUserMessage: string;
  context?: ConversationContext;
  hasMercadoLivreConnector: boolean;
  leadNameReplyDetected: boolean;
  hasReferencedCatalogReply: boolean;
  productSearchRequested: boolean;
  genericMercadoLivreListingRequested: boolean;
  mercadoLivreListingProducts: ProdutoPadronizado[];
  mercadoLivreProducts: ProdutoPadronizado[];
  resolvedProductSearchTerm: string;
  productSearchTerm: string;
  loadMoreCatalogRequested: boolean;
  referencedCatalogProducts: CatalogProductReference[];
  currentCatalogProduct: CatalogProductReference | null;
  catalogFollowUpDecision?: CatalogFollowUpDecision | null;
  lojaCta?: string | null;
  deps: MercadoLivreDeps;
}) {
  const selectedCatalogProduct =
    input.referencedCatalogProducts.length === 1 ? input.referencedCatalogProducts[0] : input.currentCatalogProduct;
  const linkedProductDetails =
    !input.productSearchRequested && input.agentId
      ? await obterDetalhesProdutoMercadoLivrePorAgente(input.agentId, input.latestUserMessage)
      : null;
  const shouldPitchSelectedProduct =
    Boolean(selectedCatalogProduct || linkedProductDetails) &&
    (isMercadoLivrePurchaseIntent(input.latestUserMessage, input.deps) ||
      isMercadoLivreDetailIntent(input.latestUserMessage, input.deps));
  const directSingleProduct =
    input.mercadoLivreProducts.length === 1
      ? {
          id: input.mercadoLivreProducts[0]?.id ?? null,
          nome: input.mercadoLivreProducts[0]?.nome ?? null,
          descricao: `R$ ${input.mercadoLivreProducts[0]?.preco.toLocaleString("pt-BR")}`,
          preco: input.mercadoLivreProducts[0]?.preco ?? null,
          link: input.mercadoLivreProducts[0]?.link ?? null,
          imagem: input.mercadoLivreProducts[0]?.imagem ?? null,
          cardIndex: 0,
        }
      : null;
  const shouldFetchDirectSingleProductDetails =
    Boolean(directSingleProduct) &&
    input.productSearchRequested &&
    !input.genericMercadoLivreListingRequested &&
    Boolean(input.agentId);
  const selectedCatalogProductDetails =
    shouldPitchSelectedProduct && input.agentId && getCatalogProductRefForDetails(selectedCatalogProduct)
      ? await obterDetalhesProdutoMercadoLivrePorAgente(
          input.agentId,
          getCatalogProductRefForDetails(selectedCatalogProduct) ?? "",
        )
      : null;
  const directSingleProductDetails =
    shouldFetchDirectSingleProductDetails && input.agentId && getCatalogProductRefForDetails(directSingleProduct)
      ? await obterDetalhesProdutoMercadoLivrePorAgente(
          input.agentId,
          getCatalogProductRefForDetails(directSingleProduct) ?? "",
        )
      : null;
  const selectedProductSalesReply =
    (selectedCatalogProductDetails ?? linkedProductDetails) && shouldPitchSelectedProduct
      ? buildMercadoLivreSalesReply(
          selectedCatalogProductDetails ?? linkedProductDetails!,
          input.latestUserMessage,
          input.context,
          input.lojaCta,
          input.deps,
        )
      : null;
  const salesFocusProduct = selectedCatalogProductDetails ?? linkedProductDetails;
  const ambiguousCatalogReferenceReply =
    input.hasMercadoLivreConnector &&
    !input.leadNameReplyDetected &&
    !input.hasReferencedCatalogReply &&
    (input.catalogFollowUpDecision?.kind === "recent_product_reference_ambiguous" ||
      (input.catalogFollowUpDecision?.kind === "recent_product_reference" &&
        input.referencedCatalogProducts.length === 0) ||
      /\b(esse|essa|isso|a que mandou|o que mandou|a da lista|o da lista|o primeiro|a primeira|o segundo|a segunda|o terceiro|a terceira|mandou|mostrou)\b/.test(
        input.deps.normalizeText(input.latestUserMessage),
      ))
      ? buildAmbiguousCatalogReferenceReply(input.context, input.deps)
      : null;
  const mercadoLivreListingReply = input.genericMercadoLivreListingRequested
    ? buildMercadoLivreListingReply(input.mercadoLivreListingProducts, input.context, input.deps)
    : null;
  const mercadoLivrePromptContext = buildMercadoLivrePromptContext(input.mercadoLivreProducts);
  const mercadoLivreDetailPromptContext = buildMercadoLivreDetailPromptContext(
    selectedCatalogProductDetails ?? linkedProductDetails ?? directSingleProductDetails,
  );
  const directMercadoLivreReply = directSingleProductDetails
    ? buildMercadoLivreSingleResultReply(directSingleProductDetails, input.context, input.lojaCta, input.deps)
    : buildMercadoLivreReply(input.mercadoLivreProducts, input.context, input.deps);
  const mercadoLivreNoResultsReply =
    input.productSearchRequested && input.agentId && input.hasMercadoLivreConnector && input.mercadoLivreProducts.length === 0
      ? buildMercadoLivreNoResultsReply(
          input.resolvedProductSearchTerm || input.productSearchTerm,
          input.context,
          {
            exhausted: input.loadMoreCatalogRequested,
          },
          input.deps,
        )
      : null;
  const currentProductForMetadata = directSingleProductDetails
    ? {
        id: directSingleProductDetails.id ?? null,
        nome: directSingleProductDetails.nome,
        descricao: `R$ ${directSingleProductDetails.preco.toLocaleString("pt-BR")}`,
        preco: directSingleProductDetails.preco,
        link: directSingleProductDetails.link,
        imagem: directSingleProductDetails.imagem,
        cardIndex: directSingleProduct?.cardIndex ?? null,
      }
    : directSingleProduct;

  return {
    selectedCatalogProduct,
    selectedCatalogProductDetails,
    directSingleProduct,
    directSingleProductDetails,
    selectedProductSalesReply,
    salesFocusProduct,
    ambiguousCatalogReferenceReply,
    mercadoLivreListingReply,
    mercadoLivrePromptContext,
    mercadoLivreDetailPromptContext,
    directMercadoLivreReply,
    mercadoLivreNoResultsReply,
    currentProductForMetadata,
  } satisfies MercadoLivreHeuristicState;
}

export function resolveMercadoLivreHeuristicReply(input: {
  context?: ConversationContext;
  latestUserMessage: string;
  agentId?: string | null;
  agentName?: string | null;
  selectedProductSalesReply: string | null;
  salesFocusProduct: ProdutoDetalhadoMercadoLivre | null;
  selectedCatalogProduct: CatalogProductReference | null;
  mercadoLivreListingReply: string | null;
  mercadoLivreListingProductsForAssets: Array<ProdutoPadronizado | ProdutoDetalhadoMercadoLivre>;
  directMercadoLivreReply: string | null;
  mercadoLivreProductsForAssets: Array<ProdutoPadronizado | ProdutoDetalhadoMercadoLivre>;
  currentProductForMetadata: CatalogProductReference | null;
  mercadoLivreNoResultsReply: string | null;
  formatReply: (reply: string, context?: ConversationContext) => string;
  deps: MercadoLivreDeps;
}): MercadoLivreHeuristicReply | null {
  if (input.selectedProductSalesReply && input.salesFocusProduct) {
    return {
      mode: "mercado_livre_product_sales",
      logMessage: "Resposta comercial de produto especifico do Mercado Livre acionada.",
      reply: input.formatReply(input.selectedProductSalesReply, input.context),
      assets: buildMercadoLivreProductAssets([input.salesFocusProduct], input.latestUserMessage, input.deps),
      metadata: {
        provider: "heuristic",
        model: "mercado_livre_product_sales",
        agenteId: input.agentId ?? null,
        agenteNome: input.agentName ?? null,
        catalogoProdutoAtual: input.salesFocusProduct
          ? {
              id: input.salesFocusProduct.id ?? null,
              nome: input.salesFocusProduct.nome,
              descricao: `R$ ${input.salesFocusProduct.preco.toLocaleString("pt-BR")}`,
              preco: input.salesFocusProduct.preco,
              link: input.salesFocusProduct.link,
              imagem: input.salesFocusProduct.imagem,
              cardIndex: input.selectedCatalogProduct?.cardIndex ?? null,
            }
          : null,
      },
      tracePayload: {
        productId: input.salesFocusProduct.id ?? null,
      },
    };
  }

  if (input.mercadoLivreListingReply) {
    return {
      mode: "mercado_livre_listing",
      logMessage: "Listagem de produtos recentes do Mercado Livre acionada.",
      reply: input.formatReply(input.mercadoLivreListingReply, input.context),
      assets: buildMercadoLivreProductAssets(input.mercadoLivreListingProductsForAssets, input.latestUserMessage, input.deps),
      metadata: {
        provider: "heuristic",
        model: "mercado_livre_listing",
        agenteId: input.agentId ?? null,
        agenteNome: input.agentName ?? null,
      },
      tracePayload: {},
    };
  }

  if (input.directMercadoLivreReply) {
    return {
      mode: "mercado_livre_connector",
      logMessage: "Resposta heuristica por conector Mercado Livre acionada.",
      reply: input.formatReply(input.directMercadoLivreReply, input.context),
      assets: buildMercadoLivreProductAssets(input.mercadoLivreProductsForAssets, input.latestUserMessage, input.deps),
      metadata: {
        provider: "heuristic",
        model: "mercado_livre_connector",
        agenteId: input.agentId ?? null,
        agenteNome: input.agentName ?? null,
        catalogoProdutoAtual: input.currentProductForMetadata,
      },
      tracePayload: {},
    };
  }

  if (input.mercadoLivreNoResultsReply) {
    return {
      mode: "mercado_livre_no_results",
      logMessage: "Busca em conector Mercado Livre sem resultados.",
      reply: input.formatReply(input.mercadoLivreNoResultsReply, input.context),
      assets: [],
      metadata: {
        provider: "heuristic",
        model: "mercado_livre_no_results",
        agenteId: input.agentId ?? null,
        agenteNome: input.agentName ?? null,
      },
      tracePayload: {},
    };
  }

  return null;
}
