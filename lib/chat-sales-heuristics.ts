import type { ConversationContext } from "@/lib/chat-context";

type ConversationMessage = {
  role: unknown;
  content: string;
};

type CatalogItem = {
  slug: "site-comum" | "chat-ia" | "automacao-whatsapp" | "integracao-crm" | "sistema-sob-medida-simples";
  nome: string;
  precoLabel: string;
};

type LeadNameDetector = (message: string, history: ConversationMessage[], deps: {
  normalizeText: (value: string) => string;
  extractName: (message: string) => string | null;
}) => boolean;

const PRODUCT_SEARCH_STOPWORDS = new Set([
  "esse",
  "essa",
  "esses",
  "essas",
  "aquele",
  "aquela",
  "aqueles",
  "aquelas",
  "isto",
  "isso",
  "aquilo",
  "bem",
  "muito",
  "mais",
  "menos",
  "para",
  "pra",
  "com",
  "sem",
  "que",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "na",
  "no",
  "nas",
  "nos",
  "um",
  "uma",
  "uns",
  "umas",
  "e",
  "eh",
  "bonita",
  "bonito",
  "linda",
  "lindo",
  "gostei",
  "quero",
  "procuro",
  "buscar",
  "busca",
  "produto",
  "produtos",
  "item",
  "itens",
  "desse",
  "dessa",
]);

export function shouldSearchProducts(message: string, deps: { normalizeText: (value: string) => string }) {
  const normalized = deps.normalizeText(message);
  const commercialServiceSignals = [
    /\bpreco\b/,
    /\bvalor\b/,
    /\borcamento\b/,
    /\bquanto\b/,
    /\bmedia de valor\b/,
    /\bestimativa\b/,
    /\bsistema\b/,
    /\bsite\b/,
    /\bchat\b/,
    /\bagente\b/,
    /\bautomac(?:ao|a)o\b/,
    /\bintegrac(?:ao|a)o\b/,
    /\bwhatsapp\b/,
  ];

  if (commercialServiceSignals.some((pattern) => pattern.test(normalized))) {
    const explicitCatalogSignals = [
      /\bproduto\b/,
      /\bprodutos\b/,
      /\bitem\b/,
      /\bitens\b/,
      /\bcatalogo\b/,
      /\bcatÃ¡logo\b/,
      /\bloja\b/,
      /\bmercado livre\b/,
      /\bml\b/,
      /\bsku\b/,
      /\bmodelo\b/,
      /\bcor\b/,
      /\btamanho\b/,
    ];

    if (!explicitCatalogSignals.some((pattern) => pattern.test(normalized))) {
      return false;
    }
  }

  const productSignals = [
    "tem algum",
    "tem alguma",
    "voce tem",
    "tem ai",
    "produto",
    "produtos",
    "item",
    "itens",
    "catalogo",
    "catÃ¡logo",
    "loja",
    "mercado livre",
    "ml",
    "venda",
    "vende",
    "disponivel",
    "disponÃ­vel",
    "procuro",
    "quero comprar",
    "estou procurando",
  ];

  if (productSignals.some((signal) => normalized.includes(signal))) {
    return true;
  }

  return /\btem\b.+\b(produt|item|modelo|cor|tamanho|sku|na loja)\b/.test(normalized);
}

export function isGreetingOrAckMessage(message: string, deps: { normalizeText: (value: string) => string }) {
  const normalized = deps.normalizeText(message)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return false;
  }

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

export function extractProductSearchTerm(message: string) {
  const cleaned = message
    .trim()
    .replace(/[?!.]+$/g, "")
    .replace(/^(oi|ola|olÃ¡|opa)\s*[!,.-]?\s*/i, "")
    .replace(/^(voces?|vocÃª|vc)\s+/i, "")
    .replace(/^e\s+/i, "")
    .replace(/^(tem|tem ai|tem aÃ­|vende|procuro|quero|estou procurando)\s+/i, "")
    .replace(/^(algum|alguma|alguns|algumas)\s+/i, "")
    .replace(/^(produto|produtos|item|itens)\s+(de\s+)?/i, "")
    .replace(/^(no|na|da|do)\s+/i, "")
    .trim();

  return cleaned || message.trim();
}

export function buildProductSearchCandidates(
  message: string,
  deps: {
    normalizeText: (value: string) => string;
    isGreetingOrAckMessage: (message: string) => boolean;
  },
) {
  if (deps.isGreetingOrAckMessage(message)) {
    return [];
  }

  const baseTerm = extractProductSearchTerm(message);
  if (deps.isGreetingOrAckMessage(baseTerm)) {
    return [];
  }

  if (baseTerm.trim().length <= 2) {
    return [];
  }

  const normalized = deps.normalizeText(baseTerm).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !PRODUCT_SEARCH_STOPWORDS.has(token));
  const candidates = new Set<string>();

  if (tokens.length) {
    candidates.add(tokens.join(" "));
    candidates.add(tokens.slice(-2).join(" "));
    candidates.add(tokens.slice(0, 2).join(" "));
  }

  [...tokens].reverse().forEach((token) => {
    if (token.length >= 4) {
      candidates.add(token);
    }
  });

  if (baseTerm.trim()) {
    candidates.add(baseTerm.trim());
  }

  if (normalized && normalized !== baseTerm.trim()) {
    candidates.add(normalized);
  }

  return [...candidates].map((term) => term.trim()).filter(Boolean).slice(0, 6);
}

export function shouldContinueProductSearch(
  history: ConversationMessage[],
  latestUserMessage: string,
  context: ConversationContext | undefined,
  deps: {
    normalizeText: (value: string) => string;
    isGreetingOrAckMessage: (message: string) => boolean;
    shouldSearchProducts: (message: string) => boolean;
    buildProductSearchCandidates: (message: string) => string[];
  },
) {
  void history;
  const normalized = deps.normalizeText(latestUserMessage).trim();
  if (!normalized) {
    return false;
  }

  if (deps.isGreetingOrAckMessage(latestUserMessage)) {
    return false;
  }

  if (/\b(preco|valor|orcamento|quanto|media de valor|estimativa|sistema|site|chat|agente|automac(?:ao|a)o|integrac(?:ao|a)o|whatsapp)\b/.test(normalized)) {
    return false;
  }

  if (deps.shouldSearchProducts(latestUserMessage)) {
    return true;
  }

  const compact = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const words = compact ? compact.split(" ").filter(Boolean) : [];
  if (compact.length > 40 || words.length > 6) {
    return false;
  }

  if (!deps.buildProductSearchCandidates(latestUserMessage).length) {
    return false;
  }

  return Boolean(context?.catalogo?.ultimaBusca);
}

export function isMercadoLivreListingIntent(message: string, deps: { normalizeText: (value: string) => string }) {
  const normalized = deps.normalizeText(message);
  const compact = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

  if (!compact) {
    return false;
  }

  if (["produtos", "produto", "catalogo", "catÃ¡logo", "loja", "vitrine", "anuncios", "anÃºncios", "itens"].includes(compact)) {
    return true;
  }

  const explicitPatterns = [
    /\bquais produtos\b/,
    /\bquais sao os produtos\b/,
    /\bmostra(?:r|i|e)? os produtos\b/,
    /\bmostra(?:r|i|e)? seus produtos\b/,
    /\bme mostra(?:r|i|e)? os produtos\b/,
    /\bme mostra(?:r|i|e)? seus produtos\b/,
    /\btraga os produtos\b/,
    /\btraga seus produtos\b/,
    /\bme traga seus produtos\b/,
    /\bexiba os produtos\b/,
    /\bexiba seus produtos\b/,
    /\bexibe os produtos\b/,
    /\bexibe seus produtos\b/,
    /\blistar produtos\b/,
    /\blista de produtos\b/,
    /\bliste os produtos\b/,
    /\bliste seus produtos\b/,
    /\bo que voce tem\b/,
    /\bo que vc tem\b/,
    /\bo que voce vende\b/,
    /\bo que vc vende\b/,
    /\bprodutos que voce tem\b/,
    /\bprodutos que vc tem\b/,
    /\bme mostra a loja\b/,
    /\bmostra a loja\b/,
    /\bver catalogo\b/,
    /\bver produtos\b/,
    /\bme passa seu catalogo\b/,
    /\bmanda seu catalogo\b/,
    /\bme envia seu catalogo\b/,
    /\bquero ver seus produtos\b/,
    /\bquero ver os produtos\b/,
    /\bquais itens voce tem\b/,
    /\bquais itens vc tem\b/,
    /\bquais anuncios voce tem\b/,
    /\bquais anuncios vc tem\b/,
  ];

  if (explicitPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const browseVerb = /\b(mostra|mostrar|mostre|exiba|exibe|exibir|liste|listar|lista|traga|trazer|manda|mandar|envia|enviar|ver|veja|quero ver|apresenta|apresentar)\b/;
  const catalogNoun = /\b(produto|produtos|item|itens|catalogo|catÃ¡logo|loja|vitrine|anuncio|anuncios|anÃºncio|anÃºncios)\b/;

  return browseVerb.test(normalized) && catalogNoun.test(normalized);
}

export function shouldUseMercadoLivreConnectorFallback(
  history: ConversationMessage[],
  latestUserMessage: string,
  context: ConversationContext | undefined,
  deps: {
    normalizeText: (value: string) => string;
    isGreetingOrAckMessage: (message: string) => boolean;
    buildProductSearchCandidates: (message: string) => string[];
    shouldSearchProducts: (message: string) => boolean;
    isLikelyLeadNameReply: LeadNameDetector;
    extractName: (message: string) => string | null;
  },
) {
  const normalized = deps.normalizeText(latestUserMessage).trim();
  if (!normalized) {
    return false;
  }

  if (
    deps.isLikelyLeadNameReply(latestUserMessage, history, {
      normalizeText: deps.normalizeText,
      extractName: deps.extractName,
    })
  ) {
    return false;
  }

  if (deps.isGreetingOrAckMessage(latestUserMessage)) {
    return false;
  }

  if (/\b(preco|valor|orcamento|quanto|site|chat|agente|automac(?:ao|a)o|integrac(?:ao|a)o|whatsapp|api|status|codigo|consulta)\b/.test(normalized)) {
    return false;
  }

  if (deps.shouldSearchProducts(latestUserMessage)) {
    return true;
  }

  const compact = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const words = compact ? compact.split(" ").filter(Boolean) : [];
  if (!words.length || compact.length > 60 || words.length > 8) {
    return false;
  }

  if (!deps.buildProductSearchCandidates(latestUserMessage).length) {
    return false;
  }

  return Boolean(context?.catalogo?.ultimaBusca);
}

export function detectCatalogItems(history: ConversationMessage[], deps: { normalizeText: (value: string) => string }) {
  const userText = history
    .filter((item) => item.role === "user")
    .map((item) => deps.normalizeText(item.content))
    .join(" ");

  const items: CatalogItem[] = [];
  const has = (pattern: RegExp) => pattern.test(userText);
  const asksForChat = has(
    /\bchat\b|\bwidget\b|\bia no site\b|\bagente no site\b|\batendimento com ia\b|\bchat no site\b|\bchat no sistema\b|\bchat em sistema\b|\bchat em um sistema\b|\bsistema legado\b|\bsite legado\b|\badicionar o chat\b|\bcolocar o chat\b|\bimplantar o chat\b/,
  );
  const asksForStandaloneSystem =
    !asksForChat && has(/\bsistema\b|\bpainel\b|\bcadastro\b|\bproduto\b|\bprodutos\b|\badmin\b|\badm\b|\blistagem\b|\bcatalogo\b/);

  if (has(/\bsite\b|\blanding page\b|\bpagina\b/) && !asksForChat) {
    items.push({ slug: "site-comum", nome: "Criacao de site", precoLabel: "R$300 a R$1000" });
  }

  if (asksForChat) {
    items.push({ slug: "chat-ia", nome: "Chat com IA (widget)", precoLabel: "R$50 de adesao + R$20/mÃªs" });
  }

  if (has(/\bwhatsapp\b|\bautomatiza(?:r|cao) whatsapp\b|\batendimento no whatsapp\b/)) {
    items.push({ slug: "automacao-whatsapp", nome: "Atendimento com agentes no WhatsApp", precoLabel: "A partir de R$200/mÃªs" });
  }

  if (has(/\bcrm\b|\bintegrac(?:ao|a)o com crm\b/)) {
    items.push({ slug: "integracao-crm", nome: "Integracao/API", precoLabel: "R$400 a R$1000" });
  }

  if (asksForStandaloneSystem) {
    items.push({ slug: "sistema-sob-medida-simples", nome: "Sistema com IA", precoLabel: "R$500 a R$2000" });
  }

  return items.filter((item, index, array) => array.findIndex((entry) => entry.slug === item.slug) === index);
}

export function isOutOfScopeForCatalog(history: ConversationMessage[], deps: { normalizeText: (value: string) => string }) {
  const userText = history
    .filter((item) => item.role === "user")
    .map((item) => deps.normalizeText(item.content))
    .join(" ");
  const asksForChat =
    /\bchat\b|\bwidget\b|\bia no site\b|\bagente no site\b|\batendimento com ia\b|\bchat no site\b|\bchat no sistema\b|\bchat em sistema\b|\bchat em um sistema\b|\bsistema legado\b|\bsite legado\b|\badicionar o chat\b|\bcolocar o chat\b|\bimplantar o chat\b/.test(
      userText,
    );

  const complexSignals = [/\berp\b/, /\bintegrac(?:ao|a)o(?:es)?\b/, /\bmuitas regras\b/, /\bfluxos\b/, /\bprocessos\b/, /\bsistema interno\b/, /\bsob medida\b/, /\bvarios\b/, /\bcomplex[oa]\b/, /\bmais de um\b/];

  const catalogItems = detectCatalogItems(history, deps);
  return catalogItems.length === 0 || (!asksForChat && complexSignals.some((pattern) => pattern.test(userText)));
}

export function buildCatalogPricingReply(
  history: ConversationMessage[],
  context: ConversationContext | undefined,
  deps: {
    normalizeText: (value: string) => string;
    prefersStructuredReply: (context?: ConversationContext) => boolean;
  },
) {
  const catalogItems = detectCatalogItems(history, deps);
  if (catalogItems.length === 0 || isOutOfScopeForCatalog(history, deps)) {
    return null;
  }

  const labels = catalogItems.map((item) => `${item.nome}: ${item.precoLabel}`);
  const joinedLabels = labels.join(" + ");

  if (catalogItems.length === 1) {
    return deps.prefersStructuredReply(context)
      ? [
          "âœ“ **Melhor encaixe inicial**",
          labels[0],
          "",
          "â†’ Se quiser, eu sigo com voce por aqui e ja te explico como isso entra no seu caso, ou te encaminho no WhatsApp para fecharmos mais rapido.",
        ].join("\n")
      : `Pelo que voce descreveu, isso encaixa em ${joinedLabels}. Se quiser, eu sigo com voce por aqui ou te encaminho no WhatsApp para fecharmos o proximo passo.`;
  }

  return deps.prefersStructuredReply(context)
    ? [
        "âœ“ **Melhor encaixe inicial**",
        ...labels.map((label) => `- ${label}`),
        "",
        "â†’ Se quiser, eu posso te dizer qual combinacao faz mais sentido para o seu caso e te direcionar no WhatsApp para alinharmos os detalhes finais.",
      ].join("\n")
    : `Pelo que voce descreveu, isso encaixa no nosso catalogo como ${joinedLabels}. Se quiser, eu posso te direcionar no WhatsApp para alinharmos os detalhes finais.`;
}

export function maybeAskForLeadIdentification(
  context: ConversationContext,
  history: ConversationMessage[],
  latestUserMessage: string,
  deps: {
    normalizeText: (value: string) => string;
    isOutOfScopeForCatalog: (history: ConversationMessage[]) => boolean;
    isWhatsAppChannel: (context?: ConversationContext) => boolean;
  },
) {
  const count = context.memoria?.mensagem_count ?? 0;
  const hasName = Boolean(context.lead?.nome?.trim());
  const identified = Boolean(context.lead?.identificado);
  const ready = Boolean(context.qualificacao?.pronto_para_whatsapp);
  const normalized = deps.normalizeText(latestUserMessage);

  if (hasName || identified) {
    return null;
  }

  if (!deps.isOutOfScopeForCatalog(history)) {
    return null;
  }

  if (count <= 2) {
    return deps.isWhatsAppChannel(context)
      ? "Perfeito. Antes de seguir, qual e o seu nome?"
      : "Antes de eu te orientar melhor, como posso te chamar?";
  }

  if (ready || count >= 4 || normalized.includes("orcamento") || normalized.includes("whatsapp")) {
    return "Consigo seguir com voce por aqui, mas para te direcionar melhor no WhatsApp me envie seu nome e telefone com DDD.";
  }

  return null;
}
