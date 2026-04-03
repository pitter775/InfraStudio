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
  reusedPreviousCatalogSearchForListing: boolean;
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

function extractExplicitMercadoLivreProductRef(message: string) {
  const raw = String(message ?? "").trim();
  if (!raw) {
    return null;
  }

  const mlbMatch = raw.match(/\bMLB[- ]?(\d{6,})\b/i);
  if (mlbMatch?.[1]) {
    return `MLB${mlbMatch[1]}`;
  }

  const linkMatch = raw.match(/https?:\/\/\S*mercadolivre\.com\.br\/\S+/i);
  if (linkMatch?.[0]) {
    return linkMatch[0];
  }

  return null;
}

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

function shouldKeepCurrentProductConversation(
  message: string,
  currentCatalogProduct: CatalogProductReference | null | undefined,
  deps: MercadoLivreDeps,
) {
  if (!currentCatalogProduct) {
    return false;
  }

  const normalized = deps.normalizeText(message);
  if (!normalized) {
    return false;
  }

  if (isMercadoLivrePurchaseIntent(message, deps) || isMercadoLivreDetailIntent(message, deps)) {
    return true;
  }

  return /\b(esse mesmo|essa mesma|gostei dele|gostei dela|dele|dela|desse|dessa)\b/.test(normalized);
}


function formatMercadoLivreCondition(value: string | null | undefined, deps: MercadoLivreDeps) {
  const normalized = deps.normalizeText(value ?? "");
  if (normalized === "new") return "novo";
  if (normalized === "used") return "usado";
  return value?.trim() || null;
}

function compactMercadoLivreDescription(value: string | null | undefined, maxLength = 220) {
  const compact = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!compact) return null;
  if (compact.length <= maxLength) return compact;

  return `${compact.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function buildMercadoLivreSalesClose(
  produto: ProdutoDetalhadoMercadoLivre,
  cta: string | null | undefined,
  fallback: string,
) {
  if (cta?.trim()) {
    return cta.trim();
  }

  const productName = produto.nome?.trim() || "esse item";
  return `${fallback} Se fizer sentido para voce, eu sigo com voce nesse ${productName} e te ajudo a decidir se vale fechar agora ou comparar com outro parecido. O que mais pesa para voce nesse item: garantia, frete, estado ou preco?`;
}

function buildMercadoLivreConsultiveProbe(
  produto: ProdutoDetalhadoMercadoLivre,
  latestUserMessage: string,
  deps: MercadoLivreDeps,
) {
  const normalized = deps.normalizeText(latestUserMessage);
  const productName = produto.nome?.trim() || "esse item";

  if (/\bgarantia\b|\bcondicao\b|\bcondição\b|\bestado\b/.test(normalized)) {
    return `Se quiser, eu tambem posso te resumir o estado geral do anuncio e o que costuma pesar mais para decidir com seguranca nesse ${productName}.`;
  }

  if (/\bfrete\b|\bentrega\b/.test(normalized)) {
    return `Se fizer sentido para voce, eu tambem posso te ajudar a decidir se esse ${productName} vale mais pela entrega, pelo estado ou pelo custo total.`;
  }

  if (/\bmaterial\b|\bmedida\b|\bmedidas\b|\btamanho\b|\bcapacidade\b|\bcor\b/.test(normalized)) {
    return `Se quiser, eu tambem posso te dizer se esse ${productName} encaixa melhor no uso que voce imagina ou se vale comparar com outro parecido.`;
  }

  if (/\b(gostei|curti|interesse|quero|acho que e esse|acho que combina)\b/.test(normalized)) {
    return `Se ele estiver perto do que voce quer, eu posso te ajudar a bater o martelo olhando os pontos que mais importam para voce nesse ${productName}.`;
  }

  return `Se fizer sentido para voce, eu sigo com voce nesse ${productName} e te ajudo a decidir se vale fechar agora ou comparar com outro parecido. O que mais pesa para voce nesse item: garantia, frete, estado ou preco?`;
}

function buildMercadoLivreDescriptionLead(compactDescription: string | null) {
  if (!compactDescription) {
    return null;
  }

  return `No anuncio ele aparece assim: ${compactDescription}`;
}

function shouldRepeatFocusedProductAsset(message: string, deps: MercadoLivreDeps) {
  const normalized = deps.normalizeText(message);

  if (!normalized) {
    return true;
  }

  const explicitAssetSignals = [
    /\blink\b/,
    /\banuncio\b/,
    /\banúncio\b/,
    /\bfoto\b/,
    /\bfotos\b/,
    /\bimagem\b/,
    /\bimagens\b/,
    /\bmostra ele\b/,
    /\bme manda\b/,
    /\bme envia\b/,
  ];

  if (explicitAssetSignals.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const detailConversationSignals = [
    /\bmais detalhes\b/,
    /\bdetalhes dele\b/,
    /\bdetalhes dela\b/,
    /\bmaterial\b/,
    /\bresistente\b/,
    /\bresistencia\b/,
    /\bserve\b/,
    /\buso diario\b/,
    /\bdia a dia\b/,
    /\bgarantia\b/,
    /\bfrete\b/,
    /\bentrega\b/,
    /\bestoque\b/,
    /\bcondicao\b/,
    /\bestado\b/,
    /\bmedida\b/,
    /\bmedidas\b/,
    /\btamanho\b/,
    /\bcapacidade\b/,
    /\bcor\b/,
    /\bmais sobre ele\b/,
    /\bmais sobre ela\b/,
    /\bme fala mais\b/,
  ];

  if (detailConversationSignals.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  return true;
}

function buildMercadoLivreTechnicalAnswer(
  produto: ProdutoDetalhadoMercadoLivre,
  latestUserMessage: string,
  consultiveProbe: string,
  deps: MercadoLivreDeps,
) {
  const normalized = deps.normalizeText(latestUserMessage);
  const description = deps.normalizeText(produto.descricao ?? "");
  const productName = produto.nome?.trim() || "esse item";
  const attributeText = (produto.atributos ?? []).map((item) => `${item.nome}: ${item.valor}`).join(" | ");

  const materialInfo =
    (produto.atributos ?? []).find((item) => /\bmaterial\b/.test(deps.normalizeText(item.nome)))?.valor ??
    (description.includes("ceramica esmaltada") ? "ceramica esmaltada" : null);
  const stateInfo =
    description.includes("bom estado geral")
      ? "Pelo anuncio, ele esta em bom estado geral, com leves marcas de uso e sem trincas ou quebras aparentes."
      : null;
  const usageInfo =
    description.includes("ideal para servir sopas e caldos")
      ? "Ele foi pensado para servir sopas e caldos de forma pratica e elegante, entao faz sentido para uso a mesa no dia a dia com os cuidados normais de uma peca vintage."
      : description.includes("uso a mesa")
      ? "O conjunto foi descrito para uso a mesa, com alcas laterais nas cumbucas que ajudam no manuseio."
      : null;
  const resistanceInfo =
    description.includes("sem trincas ou quebras aparentes")
      ? "Eu nao venderia como peca nova ou de uso bruto, mas o anuncio mostra uma peca integra, sem trincas ou quebras aparentes."
      : null;

  if (/\bresistente\b|\bresistencia\b|\bresiste\b/.test(normalized)) {
    return [
      materialInfo ? `${productName} e de ${materialInfo}.` : null,
      resistanceInfo,
      stateInfo,
      usageInfo,
      consultiveProbe,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (/\bmaterial\b/.test(normalized)) {
    return [
      materialInfo ? `${productName} e de ${materialInfo}.` : null,
      usageInfo,
      stateInfo,
      consultiveProbe,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (/\buso diario\b|\bdia a dia\b|\buso a mesa\b|\bserve\b/.test(normalized)) {
    return [
      usageInfo ?? `Pelo anuncio, ${productName} foi pensado para servir a mesa com praticidade e um visual retro.`,
      stateInfo,
      materialInfo ? `Material informado: ${materialInfo}.` : null,
      consultiveProbe,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (/\bmedida\b|\bmedidas\b|\btamanho\b|\bcapacidade\b|\bcor\b/.test(normalized) && attributeText) {
    return [
      `No anuncio encontrei estes detalhes: ${attributeText}.`,
      usageInfo,
      consultiveProbe,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return null;
}

function buildSyntheticMercadoLivreProductDetails(product: CatalogProductReference | null | undefined) {
  if (!product?.nome) {
    return null;
  }

  return {
    id: product.id ?? product.link ?? product.nome,
    nome: product.nome,
    preco: typeof product.preco === "number" && Number.isFinite(product.preco) ? product.preco : 0,
    imagem: product.imagem ?? "",
    link: product.link ?? "",
    publicadoEm: null,
    descricao: product.descricao ?? "",
    condicao: null,
    garantia: null,
    estoque: null,
    vendidos: null,
    aceitaMercadoPago: null,
    freteGratis: null,
    sellerId: null,
    pertenceALoja: true,
    atributos: [],
  } satisfies ProdutoDetalhadoMercadoLivre;
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
      ? "Separei um produto da loja para voce logo abaixo. Se gostar desse estilo, eu posso te mostrar outras opcoes parecidas tambem."
      : "Separei um produto da loja logo abaixo. Se quiser, eu tambem posso buscar um modelo especifico.";
  }

  return deps.isWhatsAppChannel(context)
    ? "Separei alguns produtos da loja para voce logo abaixo. Me diga se gostou de algum ou se quer que eu traga mais opcoes parecidas."
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
  const compactDescription = compactMercadoLivreDescription(produto.descricao, 260);
  const consultiveProbe = buildMercadoLivreConsultiveProbe(produto, latestUserMessage, deps);
  const descriptionLead = buildMercadoLivreDescriptionLead(compactDescription);
  const storeOwnershipNote =
    produto.pertenceALoja === false
      ? "Vi que esse link e de um anuncio fora da loja conectada aqui."
      : null;

  if (/\bgarantia\b/.test(normalized)) {
    const garantia = produto.garantia?.trim() || "Nao encontrei garantia informada no anuncio";
    const baseReply = deps.isWhatsAppChannel(context)
      ? `${produto.nome}: ${garantia}.\n\n${descriptionLead ? `${descriptionLead}\n\n` : ""}${consultiveProbe}`
      : `**${produto.nome}**: ${garantia}.\n\n${descriptionLead ? `${descriptionLead}\n\n` : ""}${consultiveProbe}`;
    return [storeOwnershipNote, baseReply].filter(Boolean).join("\n\n");
  }

  if (/\bfrete\b|\bentrega\b/.test(normalized)) {
    const frete =
      typeof produto.freteGratis === "boolean"
        ? produto.freteGratis
          ? "O anuncio indica frete gratis."
          : "O anuncio nao indica frete gratis."
        : "Nao encontrei frete detalhado no anuncio.";
    return [
      storeOwnershipNote,
      frete,
      descriptionLead,
      cta?.trim() || consultiveProbe,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (/\bestoque\b|\bdisponivel\b/.test(normalized)) {
    const estoque =
      typeof produto.estoque === "number"
        ? `No anuncio aparecem ${produto.estoque} unidade(s) disponivel(is).`
        : "Nao encontrei estoque detalhado no anuncio.";
    return [
      storeOwnershipNote,
      estoque,
      descriptionLead,
      cta?.trim() || consultiveProbe,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (/\bmaterial\b|\bmedida\b|\bmedidas\b|\btamanho\b|\bcapacidade\b|\bcor\b/.test(normalized)) {
    const technicalAnswer = buildMercadoLivreTechnicalAnswer(produto, latestUserMessage, cta?.trim() || consultiveProbe, deps);
    if (technicalAnswer) {
      return [storeOwnershipNote, technicalAnswer].filter(Boolean).join("\n\n");
    }

    const matchingAttributes = (produto.atributos ?? []).filter((item) =>
      /\b(material|medida|medidas|tamanho|capacidade|cor)\b/.test(deps.normalizeText(item.nome)),
    );
    if (matchingAttributes.length) {
      const summary = matchingAttributes.slice(0, 3).map((item) => `${item.nome}: ${item.valor}`).join(" | ");
      return [
        storeOwnershipNote,
        `Encontrei estes detalhes no anuncio: ${summary}.`,
        descriptionLead,
        cta?.trim() || consultiveProbe,
      ]
        .filter(Boolean)
        .join("\n\n");
    }

    if (produto.descricao) {
      return [
        storeOwnershipNote,
        `Na descricao do anuncio encontrei isto que ajuda na sua duvida: ${compactDescription ?? produto.descricao}`,
        cta?.trim() || consultiveProbe,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
  }

  if (/\bresistente\b|\bresistencia\b|\bresiste\b|\buso diario\b|\bdia a dia\b|\buso a mesa\b|\bserve\b/.test(normalized)) {
    const technicalAnswer = buildMercadoLivreTechnicalAnswer(produto, latestUserMessage, cta?.trim() || consultiveProbe, deps);
    if (technicalAnswer) {
      return [storeOwnershipNote, technicalAnswer].filter(Boolean).join("\n\n");
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
    : descriptionLead
    ? descriptionLead
    : "Posso te detalhar melhor esse item e te ajudar a decidir com mais seguranca.";
  const close = buildMercadoLivreSalesClose(
    produto,
    cta,
    consultiveProbe,
  );

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
      ? "Encontrei um produto da loja para voce logo abaixo. Se gostar desse estilo, eu posso te trazer outras opcoes parecidas tambem."
      : "Encontrei um produto da loja logo abaixo. Se quiser, eu posso buscar outras opcoes parecidas.";
  }
  return deps.isWhatsAppChannel(context)
    ? "Encontrei algumas opcoes parecidas na loja logo abaixo. Me diga se gostou de algum ou se quer que eu traga mais opcoes nesse estilo."
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

  const compactDescription = compactMercadoLivreDescription(produto.descricao, 240);
  const details = highlights.length
    ? `Resumo rapido: ${highlights.join(" | ")}.${compactDescription ? ` No anuncio ele aparece assim: ${compactDescription}` : ""}`
    : compactDescription
    ? `No anuncio ele aparece assim: ${compactDescription}`
    : "Posso te explicar melhor os detalhes desse item se voce quiser.";
  const close = buildMercadoLivreSalesClose(
    produto,
    cta,
    "Se quiser, eu tambem posso buscar outras opcoes parecidas ou seguir com este item por aqui",
  );
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
  deps?: MercadoLivreDeps;
}) {
  const currentCatalogProductFromContext =
    input.context?.catalogo?.produtoAtual && typeof input.context.catalogo.produtoAtual === "object"
      ? input.context.catalogo.produtoAtual
      : null;
  const loadMoreCatalogRequested = input.catalogFollowUpDecision?.kind === "load_more_results";
  const listingIntentRequested =
    input.hasMercadoLivreConnector &&
    input.isMercadoLivreListingIntent(input.latestUserMessage) &&
    !input.leadNameReplyDetected &&
    !loadMoreCatalogRequested;
  const detectedProductSearch =
    input.catalogFollowUpDecision?.kind === "new_product_search"
      ? true
      : input.catalogFollowUpDecision?.shouldBlockNewSearch
      ? false
      : input.detectProductSearch();
  const keepCurrentProductConversation =
    input.hasMercadoLivreConnector &&
    !input.leadNameReplyDetected &&
    shouldKeepCurrentProductConversation(input.latestUserMessage, currentCatalogProductFromContext, {
      normalizeText: input.deps?.normalizeText ?? ((value) => value),
      isWhatsAppChannel: input.deps?.isWhatsAppChannel ?? (() => false),
    });
  const previousCatalogSearchTerm = typeof input.context?.catalogo?.ultimaBusca === "string" ? input.context.catalogo.ultimaBusca.trim() : "";
  const preResolvedCatalogReferences =
    input.catalogFollowUpDecision?.kind === "recent_product_reference" ||
    input.catalogFollowUpDecision?.kind === "recent_product_reference_ambiguous"
      ? input.catalogFollowUpDecision.matchedProducts
      : input.hasMercadoLivreConnector && !input.leadNameReplyDetected && !listingIntentRequested && input.recentCatalogProducts.length
      ? input.resolveRecentCatalogProductReference(input.latestUserMessage, input.context)
      : [];
  const explicitCatalogReferenceRequested =
    input.hasMercadoLivreConnector &&
    !input.leadNameReplyDetected &&
    !loadMoreCatalogRequested &&
    !listingIntentRequested &&
    (input.catalogFollowUpDecision?.kind === "recent_product_reference" ||
      input.catalogFollowUpDecision?.kind === "recent_product_reference_ambiguous" ||
      preResolvedCatalogReferences.length > 0 ||
      input.isRecentCatalogReferenceAttempt(input.latestUserMessage, input.context));
  const reusedPreviousCatalogSearchForListing =
    listingIntentRequested &&
    Boolean(previousCatalogSearchTerm);
  const genericMercadoLivreListingRequested =
    listingIntentRequested &&
    !reusedPreviousCatalogSearchForListing;
  const productSearchRequested =
    !genericMercadoLivreListingRequested &&
    !explicitCatalogReferenceRequested &&
    !keepCurrentProductConversation &&
    !input.leadNameReplyDetected &&
    (input.catalogFollowUpDecision?.kind === "new_product_search" ||
      loadMoreCatalogRequested ||
      reusedPreviousCatalogSearchForListing ||
      detectedProductSearch ||
      (input.catalogFollowUpDecision?.shouldBlockNewSearch ? false : input.hasMercadoLivreConnector && input.shouldUseMercadoLivreConnectorFallback()));
  const productSearchSeed = loadMoreCatalogRequested || reusedPreviousCatalogSearchForListing ? previousCatalogSearchTerm : input.latestUserMessage;
  const productSearchCandidates = productSearchRequested ? input.buildProductSearchCandidates(productSearchSeed) : [];
  const productSearchTerm = productSearchCandidates[0] ?? "";
  const referencedCatalogProducts =
    input.hasMercadoLivreConnector && !input.leadNameReplyDetected && !productSearchRequested && !genericMercadoLivreListingRequested
      ? preResolvedCatalogReferences
      : [];
  const currentCatalogProduct =
    !productSearchRequested && currentCatalogProductFromContext
      ? currentCatalogProductFromContext
      : null;

  return {
    loadMoreCatalogRequested,
    detectedProductSearch,
    previousCatalogSearchTerm,
    reusedPreviousCatalogSearchForListing,
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
  const explicitProductRefFromMessage = extractExplicitMercadoLivreProductRef(input.latestUserMessage);
  const linkedProductDetails =
    !input.productSearchRequested && input.agentId && explicitProductRefFromMessage
      ? await obterDetalhesProdutoMercadoLivrePorAgente(input.agentId, explicitProductRefFromMessage)
      : null;
  const purchaseOrDetailIntent =
    isMercadoLivrePurchaseIntent(input.latestUserMessage, input.deps) ||
    isMercadoLivreDetailIntent(input.latestUserMessage, input.deps);
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
    Boolean(selectedCatalogProduct) && input.agentId && getCatalogProductRefForDetails(selectedCatalogProduct)
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
  const hasAmbiguousReferenceSignal =
    input.catalogFollowUpDecision?.kind === "recent_product_reference_ambiguous" ||
    (input.catalogFollowUpDecision?.kind === "recent_product_reference" && input.referencedCatalogProducts.length === 0) ||
    /\b(esse|essa|isso|a que mandou|o que mandou|a da lista|o da lista|o primeiro|a primeira|o segundo|a segunda|o terceiro|a terceira|mandou|mostrou)\b/.test(
      input.deps.normalizeText(input.latestUserMessage),
    );
  const fallbackFocusProductDetails =
    buildSyntheticMercadoLivreProductDetails(selectedCatalogProduct) ??
    buildSyntheticMercadoLivreProductDetails(input.currentCatalogProduct) ??
    buildSyntheticMercadoLivreProductDetails(directSingleProduct);
  const focusProductDetails =
    selectedCatalogProductDetails ?? linkedProductDetails ?? directSingleProductDetails ?? fallbackFocusProductDetails;
  const productAlreadyInFocus =
    input.catalogFollowUpDecision?.kind === "recent_product_reference" ||
    (Boolean(input.currentCatalogProduct) && !input.productSearchRequested && !input.genericMercadoLivreListingRequested);
  const shouldPitchSelectedProduct = Boolean(focusProductDetails) && !hasAmbiguousReferenceSignal && (purchaseOrDetailIntent || productAlreadyInFocus);
  const selectedProductSalesReply =
    focusProductDetails && shouldPitchSelectedProduct
      ? buildMercadoLivreSalesReply(
          focusProductDetails,
          input.latestUserMessage,
          input.context,
          input.lojaCta,
          input.deps,
        )
      : null;
  const salesFocusProduct = shouldPitchSelectedProduct ? focusProductDetails : selectedCatalogProductDetails ?? linkedProductDetails;
  const ambiguousCatalogReferenceReply =
    input.hasMercadoLivreConnector &&
    !input.leadNameReplyDetected &&
    !input.hasReferencedCatalogReply &&
    hasAmbiguousReferenceSignal
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
    const shouldRepeatAsset = shouldRepeatFocusedProductAsset(input.latestUserMessage, input.deps);
    return {
      mode: "mercado_livre_product_sales",
      logMessage: "Resposta comercial de produto especifico do Mercado Livre acionada.",
      reply: input.formatReply(input.selectedProductSalesReply, input.context),
      assets: shouldRepeatAsset ? buildMercadoLivreProductAssets([input.salesFocusProduct], input.latestUserMessage, input.deps) : [],
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
