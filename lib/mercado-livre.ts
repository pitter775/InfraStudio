import "server-only";

import { appendSystemLog } from "@/lib/chat-logs";
import {
  getMercadoLivreConnectorConfig,
  listConectoresByAgente,
  MERCADO_LIVRE_CONNECTOR_TYPE,
  type ConnectorRecord,
} from "@/lib/conectores";
import { ensureMercadoLivreAccessToken } from "@/lib/mercado-livre-oauth";

export type ProdutoPadronizado = {
  id?: string | null;
  nome: string;
  preco: number;
  imagem: string;
  link: string;
  publicadoEm: string | null;
};

export type ProdutoDetalhadoMercadoLivre = ProdutoPadronizado & {
  descricao?: string | null;
  condicao?: string | null;
  garantia?: string | null;
  estoque?: number | null;
  vendidos?: number | null;
  aceitaMercadoPago?: boolean | null;
  freteGratis?: boolean | null;
  atributos?: Array<{ nome: string; valor: string }>;
};

export type MercadoLivreStoreSnapshot = {
  ok: boolean;
  connector: {
    id: string;
    nome: string;
    sellerId: string;
    nickname: string | null;
  } | null;
  produtos: ProdutoPadronizado[];
  error: string | null;
};

type MercadoLivreSearchItem = {
  id?: string;
  title?: string;
  price?: number;
  thumbnail?: string;
  permalink?: string;
  date_created?: string;
  start_time?: string;
  stop_time?: string;
  last_updated?: string;
};

type MercadoLivreSearchResponse = {
  results?: MercadoLivreSearchItem[];
};

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchTokens(value: string) {
  return normalizeSearchText(value)
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

const SEARCH_STOPWORDS = new Set([
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
  "pra",
  "para",
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
  "modelo",
]);

function buildSearchVariants(value: string) {
  const trimmed = value.trim();
  const normalized = normalizeSearchText(trimmed);
  const tokens = buildSearchTokens(trimmed);
  const meaningfulTokens = tokens.filter((token) => token.length >= 3 && !SEARCH_STOPWORDS.has(token));
  const variants = new Set<string>();

  if (trimmed) {
    variants.add(trimmed);
  }

  if (normalized && normalized !== trimmed) {
    variants.add(normalized);
  }

  if (meaningfulTokens.length) {
    variants.add(meaningfulTokens.join(" "));
  }

  for (var index = 0; index < meaningfulTokens.length; index += 1) {
    const token = meaningfulTokens[index];
    if (token.length >= 4) {
      variants.add(token);
    }

    const next = meaningfulTokens[index + 1];
    if (next) {
      variants.add(token + " " + next);
    }
  }

  return [...variants].filter((term) => term.trim().length >= 2).slice(0, 8);
}

function normalizeProduto(item: MercadoLivreSearchItem): ProdutoPadronizado | null {
  if (
    typeof item.title !== "string" ||
    typeof item.price !== "number" ||
    typeof item.thumbnail !== "string" ||
    typeof item.permalink !== "string"
  ) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : null,
    nome: item.title,
    preco: item.price,
    imagem: item.thumbnail,
    link: item.permalink,
    publicadoEm:
      (typeof item.date_created === "string" && item.date_created.trim()) ||
      (typeof item.start_time === "string" && item.start_time.trim()) ||
      (typeof item.last_updated === "string" && item.last_updated.trim()) ||
      null,
  };
}

function extractMercadoLivreItemId(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const directMatch = text.match(/\bMLB[- ]?(\d{6,})\b/i);
  if (directMatch) {
    return `MLB${directMatch[1]}`;
  }

  return /^[A-Z]{3}\d{6,}$/i.test(text) ? text.toUpperCase() : null;
}

function dedupeProdutos(produtos: ProdutoPadronizado[]) {
  const seen = new Set<string>();
  return produtos.filter((produto) => {
    const key = produto.link.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function truncateText(value: string, max = 280) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max)}...`;
}

function buildMercadoLivreFriendlyError(message: string) {
  if (/PA_UNAUTHORIZED_RESULT_FROM_POLICIES|PolicyAgent/i.test(message)) {
    if (/listar itens do seller|carregar detalhes dos itens|\/items/i.test(message)) {
      return "Conta conectada com sucesso, mas o Mercado Livre bloqueou a leitura dos anuncios dessa loja para este app. O OAuth esta funcionando; no app do Mercado Livre, ative a permissao Publicacao e sincronizacao e reautorize a conta.";
    }

    return "Conta conectada com sucesso, mas o Mercado Livre bloqueou este recurso para o app. O OAuth esta funcionando; revise as permissoes funcionais do app e reautorize a conta.";
  }

  return message;
}

async function fetchMercadoLivreProducts(input: {
  endpointBase: string;
  termo: string;
  sellerId?: string;
  accessToken?: string;
  limit?: number;
}) {
  const endpoint = new URL("/sites/MLB/search", input.endpointBase);
  endpoint.searchParams.set("q", input.termo);

  if (input.sellerId) {
    endpoint.searchParams.set("seller_id", input.sellerId);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as MercadoLivreSearchResponse;
    return (payload.results ?? [])
      .map((item) => normalizeProduto(item))
      .filter(Boolean)
      .slice(0, input.limit ?? 12) as ProdutoPadronizado[];
  } catch (error) {
    if ((error as Error).name !== "AbortError") {
      console.error("[mercado-livre] failed to fetch products", error);
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function rankProdutosByTermo(produtos: ProdutoPadronizado[], termo: string) {
  const tokens = buildSearchTokens(termo);
  const normalizedTerm = normalizeSearchText(termo);

  return [...produtos]
    .map((produto) => {
      const title = normalizeSearchText(produto.nome);
      const tokenScore = tokens.reduce((sum, token) => sum + (title.includes(token) ? 10 : 0), 0);
      const phraseScore = title.includes(normalizedTerm) ? 50 : 0;
      const startsScore = normalizedTerm && title.startsWith(normalizedTerm) ? 25 : 0;
      return {
        produto,
        score: phraseScore + startsScore + tokenScore,
        timestamp: produto.publicadoEm ? Date.parse(produto.publicadoEm) : 0,
      };
    })
    .sort(
      (left, right) =>
        right.timestamp - left.timestamp ||
        right.score - left.score ||
        left.produto.preco - right.produto.preco,
    )
    .map((item) => item.produto);
}

async function searchConnectorProducts(connector: ConnectorRecord, termo: string) {
  const config = getMercadoLivreConnectorConfig(connector);
  const endpointBase = connector.endpointBase || "https://api.mercadolibre.com";
  const sellerId = config?.seller_id?.replace(/\D/g, "").trim();
  const accessToken = await ensureMercadoLivreAccessToken(connector);
  const terms = buildSearchVariants(termo);
  const batches: ProdutoPadronizado[] = [];

  for (const currentTerm of terms) {
    if (sellerId) {
      batches.push(
        ...(await fetchMercadoLivreProducts({
          endpointBase,
          termo: currentTerm,
          sellerId: sellerId || undefined,
          accessToken,
          limit: 12,
        })),
      );
    }

    batches.push(
        ...(await fetchMercadoLivreProducts({
          endpointBase,
          termo: currentTerm,
          accessToken,
          limit: 12,
        })),
    );
  }

  const rankedProducts = rankProdutosByTermo(dedupeProdutos(batches), termo).slice(0, 3);
  if (rankedProducts.length || !sellerId) {
    return rankedProducts;
  }

  try {
    const fallbackProducts = await fetchMercadoLivreLatestProducts({
      endpointBase,
      sellerId,
      accessToken,
      limit: 20,
      connector,
    });

    return rankProdutosByTermo(dedupeProdutos(fallbackProducts), termo)
      .filter((produto) => normalizeSearchText(produto.nome).includes(normalizeSearchText(termo)))
      .slice(0, 3);
  } catch {
    return rankedProducts;
  }
}

type MercadoLivreItemDetailsResponse = Array<{
  code?: number;
  body?: {
    id?: string;
    title?: string;
    price?: number;
    thumbnail?: string;
    permalink?: string;
    date_created?: string;
    start_time?: string;
    last_updated?: string;
    condition?: string;
    warranty?: string;
    available_quantity?: number;
    sold_quantity?: number;
    accepts_mercadopago?: boolean;
    shipping?: { free_shipping?: boolean };
    attributes?: Array<{ name?: string; value_name?: string; value_struct?: { number?: number; unit?: string } }>;
  };
}>;

type MercadoLivreItemResponse = {
  id?: string;
  title?: string;
  price?: number;
  thumbnail?: string;
  permalink?: string;
  date_created?: string;
  start_time?: string;
  last_updated?: string;
  condition?: string;
  warranty?: string;
  available_quantity?: number;
  sold_quantity?: number;
  accepts_mercadopago?: boolean;
  shipping?: { free_shipping?: boolean };
  attributes?: Array<{ name?: string; value_name?: string; value_struct?: { number?: number; unit?: string } }>;
};

function normalizeMercadoLivreAttributes(item: MercadoLivreItemResponse) {
  return (item.attributes ?? [])
    .map((attribute) => {
      const nome = typeof attribute.name === "string" ? attribute.name.trim() : "";
      const rawValue =
        typeof attribute.value_name === "string" && attribute.value_name.trim()
          ? attribute.value_name.trim()
          : attribute.value_struct && typeof attribute.value_struct.number === "number"
            ? `${attribute.value_struct.number}${attribute.value_struct.unit ? ` ${attribute.value_struct.unit}` : ""}`.trim()
            : "";
      return nome && rawValue ? { nome, valor: rawValue } : null;
    })
    .filter(Boolean) as Array<{ nome: string; valor: string }>;
}

function normalizeProdutoDetalhado(item: MercadoLivreItemResponse, descricao?: string | null): ProdutoDetalhadoMercadoLivre | null {
  const base = normalizeProduto(item);
  if (!base) {
    return null;
  }

  return {
    ...base,
    descricao: descricao?.trim() || null,
    condicao: typeof item.condition === "string" ? item.condition.trim() || null : null,
    garantia: typeof item.warranty === "string" ? item.warranty.trim() || null : null,
    estoque: typeof item.available_quantity === "number" ? item.available_quantity : null,
    vendidos: typeof item.sold_quantity === "number" ? item.sold_quantity : null,
    aceitaMercadoPago: typeof item.accepts_mercadopago === "boolean" ? item.accepts_mercadopago : null,
    freteGratis: typeof item.shipping?.free_shipping === "boolean" ? item.shipping.free_shipping : null,
    atributos: normalizeMercadoLivreAttributes(item).slice(0, 8),
  };
}

async function fetchMercadoLivreLatestProducts(input: {
  endpointBase: string;
  sellerId: string;
  accessToken?: string;
  limit?: number;
  connector?: ConnectorRecord | null;
}) {
  const searchEndpoint = new URL(`/users/${input.sellerId}/items/search`, input.endpointBase);
  searchEndpoint.searchParams.set("limit", String(input.limit ?? 5));

  const searchResponse = await fetch(searchEndpoint.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
    },
    cache: "no-store",
  });

  if (!searchResponse.ok) {
    const responseText = truncateText(await searchResponse.text().catch(() => ""));
    await appendSystemLog({
      tipo: "mercado_livre_latest_products_error",
      origem: "mercado_livre",
      descricao: "Mercado Livre recusou a listagem dos itens do seller.",
      payload: {
        stage: "seller_items_search",
        connectorId: input.connector?.id ?? null,
        connectorName: input.connector?.nome ?? null,
        sellerId: input.sellerId,
        endpoint: searchEndpoint.toString(),
        status: searchResponse.status,
        hasAccessToken: Boolean(input.accessToken),
        responseText: responseText || null,
      },
    });
    throw new Error(`Mercado Livre retornou ${searchResponse.status} ao listar itens do seller. ${responseText}`.trim());
  }

  const searchPayload = (await searchResponse.json()) as { results?: string[] };
  const itemIds = Array.isArray(searchPayload.results) ? searchPayload.results.filter(Boolean).slice(0, input.limit ?? 5) : [];
  if (!itemIds.length) {
    return [];
  }

  const detailsEndpoint = new URL("/items", input.endpointBase);
  detailsEndpoint.searchParams.set("ids", itemIds.join(","));

  const detailsResponse = await fetch(detailsEndpoint.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
    },
    cache: "no-store",
  });

  if (!detailsResponse.ok) {
    const responseText = truncateText(await detailsResponse.text().catch(() => ""));
    await appendSystemLog({
      tipo: "mercado_livre_latest_products_error",
      origem: "mercado_livre",
      descricao: "Mercado Livre recusou os detalhes dos itens do seller.",
      payload: {
        stage: "items_details",
        connectorId: input.connector?.id ?? null,
        connectorName: input.connector?.nome ?? null,
        sellerId: input.sellerId,
        endpoint: detailsEndpoint.toString(),
        status: detailsResponse.status,
        itemIds,
        hasAccessToken: Boolean(input.accessToken),
        responseText: responseText || null,
      },
    });
    throw new Error(`Mercado Livre retornou ${detailsResponse.status} ao carregar detalhes dos itens. ${responseText}`.trim());
  }

  const detailsPayload = (await detailsResponse.json()) as MercadoLivreItemDetailsResponse;
  return detailsPayload
    .map((entry) => (entry.body ? normalizeProduto(entry.body) : null))
    .filter(Boolean) as ProdutoPadronizado[];
}

async function fetchMercadoLivreItemDescription(input: {
  endpointBase: string;
  itemId: string;
  accessToken?: string;
}) {
  const endpoint = new URL(`/items/${input.itemId}/description`, input.endpointBase);
  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { plain_text?: string };
  return typeof payload.plain_text === "string" && payload.plain_text.trim() ? truncateText(payload.plain_text.trim(), 700) : null;
}

async function fetchMercadoLivreItemDetails(input: {
  endpointBase: string;
  itemId: string;
  accessToken?: string;
}) {
  const endpoint = new URL(`/items/${input.itemId}`, input.endpointBase);
  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as MercadoLivreItemResponse;
}

export async function buscarProdutosMercadoLivrePorAgente(agenteId: string, termo: string) {
  const termoNormalizado = termo.trim();
  if (!agenteId.trim() || !termoNormalizado) {
    return [];
  }

  const conectores = await listConectoresByAgente(agenteId, MERCADO_LIVRE_CONNECTOR_TYPE);
  if (!conectores.length) {
    await appendSystemLog({
      tipo: "mercado_livre_search_empty_connector",
      origem: "api_produtos",
      descricao: "Busca de produtos sem conector Mercado Livre ativo para o agente.",
      payload: {
        agenteId,
        termo: termoNormalizado,
      },
    });
    return [];
  }

  await appendSystemLog({
    tipo: "mercado_livre_search_start",
    origem: "api_produtos",
    descricao: "Busca de produtos do Mercado Livre iniciada.",
    payload: {
      agenteId,
      termo: termoNormalizado,
      connectorIds: conectores.map((connector) => connector.id),
    },
  });

  try {
    const resultados = await Promise.all(conectores.map((connector) => searchConnectorProducts(connector, termoNormalizado)));
    const produtos = dedupeProdutos(resultados.flat()).slice(0, 3);

    await appendSystemLog({
      tipo: "mercado_livre_search_result",
      origem: "api_produtos",
      descricao: produtos.length
        ? "Busca de produtos do Mercado Livre retornou resultados."
        : "Busca de produtos do Mercado Livre terminou sem resultados.",
      payload: {
        agenteId,
        termo: termoNormalizado,
        totalProdutos: produtos.length,
        connectorIds: conectores.map((connector) => connector.id),
      },
    });

    return produtos;
  } catch (error) {
    await appendSystemLog({
      tipo: "mercado_livre_search_error",
      origem: "api_produtos",
      descricao: "Falha ao buscar produtos do Mercado Livre por agente.",
      payload: {
        agenteId,
        termo: termoNormalizado,
        connectorIds: conectores.map((connector) => connector.id),
        message: error instanceof Error ? error.message : "Erro desconhecido.",
      },
    });
    throw error;
  }
}

export async function obterDetalhesProdutoMercadoLivrePorAgente(agenteId: string, produtoRef: string) {
  const itemId = extractMercadoLivreItemId(produtoRef);
  if (!agenteId.trim() || !itemId) {
    return null;
  }

  const conectores = await listConectoresByAgente(agenteId, MERCADO_LIVRE_CONNECTOR_TYPE);
  const connector = conectores.find((item) => item.ativo) ?? conectores[0] ?? null;
  if (!connector) {
    return null;
  }

  const endpointBase = connector.endpointBase || "https://api.mercadolibre.com";
  const accessToken = await ensureMercadoLivreAccessToken(connector);

  try {
    const [item, descricao] = await Promise.all([
      fetchMercadoLivreItemDetails({ endpointBase, itemId, accessToken }),
      fetchMercadoLivreItemDescription({ endpointBase, itemId, accessToken }),
    ]);

    return item ? normalizeProdutoDetalhado(item, descricao) : null;
  } catch (error) {
    await appendSystemLog({
      tipo: "mercado_livre_item_details_error",
      origem: "api_produtos",
      descricao: "Falha ao buscar detalhes do produto do Mercado Livre.",
      payload: {
        agenteId,
        itemId,
        connectorId: connector.id,
        message: error instanceof Error ? error.message : "Erro desconhecido.",
      },
    });
    return null;
  }
}

export async function listarProdutosRecentesMercadoLivrePorAgente(agenteId: string): Promise<MercadoLivreStoreSnapshot> {
  if (!agenteId.trim()) {
    return {
      ok: false,
      connector: null,
      produtos: [],
      error: "Agente invalido para testar a loja.",
    };
  }

  const conectores = await listConectoresByAgente(agenteId, MERCADO_LIVRE_CONNECTOR_TYPE);
  const connector = conectores.find((item) => item.ativo) ?? conectores[0] ?? null;

  if (!connector) {
    return {
      ok: false,
      connector: null,
      produtos: [],
      error: "Nenhum conector Mercado Livre ativo foi encontrado para este agente.",
    };
  }

  const config = getMercadoLivreConnectorConfig(connector);
  const endpointBase = connector.endpointBase || "https://api.mercadolibre.com";
  const sellerId = config?.seller_id?.replace(/\D/g, "").trim() || "";
  const accessToken = await ensureMercadoLivreAccessToken(connector);
  const refreshToken = config?.refresh_token?.trim() || "";
  const appId = config?.app_id?.trim() || "";
  const clientSecret = config?.client_secret?.trim() || "";

  await appendSystemLog({
    tipo: "mercado_livre_latest_products_start",
    origem: "api_admin_agente_loja_teste",
    descricao: "Teste da loja Mercado Livre iniciado para o agente.",
    payload: {
      agenteId,
      connectorId: connector.id,
      connectorName: connector.nome,
      endpointBase,
      sellerId: sellerId || null,
      nickname: config?.nickname ?? null,
      oauthUserId: config?.user_id ?? null,
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(refreshToken),
      tokenExpiresAt: config?.token_expires_at ?? null,
    },
  });

  if (!sellerId) {
    await appendSystemLog({
      tipo: "mercado_livre_latest_products_error",
      origem: "api_admin_agente_loja_teste",
      descricao: "Teste da loja bloqueado porque o conector nao tem seller_id.",
      payload: {
        agenteId,
        connectorId: connector.id,
        connectorName: connector.nome,
        nickname: config?.nickname ?? null,
        oauthUserId: config?.user_id ?? null,
      },
    });
    return {
      ok: false,
      connector: {
        id: connector.id,
        nome: connector.nome,
        sellerId: "",
        nickname: config?.nickname ?? null,
      },
      produtos: [],
      error: "O conector nao tem seller_id configurado.",
    };
  }

  if (!accessToken && !refreshToken) {
    const secretLooksInvalid = Boolean(appId) && Boolean(clientSecret) && appId === clientSecret;
    const errorMessage = secretLooksInvalid
      ? "A loja ainda nao concluiu o OAuth do Mercado Livre e o CLIENT SECRET salvo parece invalido porque esta igual ao APP ID."
      : "A loja ainda nao concluiu o OAuth do Mercado Livre. Clique em Conectar Mercado Livre para autorizar a conta e gerar access_token e refresh_token.";

    await appendSystemLog({
      tipo: "mercado_livre_latest_products_error",
      origem: "api_admin_agente_loja_teste",
      descricao: "Teste da loja bloqueado porque o conector nao possui tokens OAuth do Mercado Livre.",
      payload: {
        agenteId,
        connectorId: connector.id,
        connectorName: connector.nome,
        sellerId,
        nickname: config?.nickname ?? null,
        oauthUserId: config?.user_id ?? null,
        hasAccessToken: false,
        hasRefreshToken: false,
        appIdPresent: Boolean(appId),
        clientSecretPresent: Boolean(clientSecret),
        clientSecretEqualsAppId: secretLooksInvalid,
      },
    });

    return {
      ok: false,
      connector: {
        id: connector.id,
        nome: connector.nome,
        sellerId,
        nickname: config?.nickname ?? null,
      },
      produtos: [],
      error: errorMessage,
    };
  }

  try {
    const produtos = await fetchMercadoLivreLatestProducts({
      endpointBase,
      sellerId,
      accessToken,
      limit: 5,
      connector,
    });

    await appendSystemLog({
      tipo: "mercado_livre_latest_products_result",
      origem: "api_admin_agente_loja_teste",
      descricao: produtos.length
        ? "Teste da loja retornou produtos recentes."
        : "Teste da loja concluiu sem produtos recentes visiveis.",
      payload: {
        agenteId,
        connectorId: connector.id,
        connectorName: connector.nome,
        sellerId,
        totalProdutos: produtos.length,
        hasAccessToken: Boolean(accessToken),
      },
    });

    return {
      ok: produtos.length > 0,
      connector: {
        id: connector.id,
        nome: connector.nome,
        sellerId,
        nickname: config?.nickname ?? null,
      },
      produtos,
      error: produtos.length ? null : "A loja respondeu, mas nenhum produto publico recente foi retornado.",
    };
  } catch (error) {
    await appendSystemLog({
      tipo: "mercado_livre_latest_products_error",
      origem: "api_admin_agente_loja_teste",
      descricao: "Teste da loja falhou ao consultar produtos recentes.",
      payload: {
        agenteId,
        connectorId: connector.id,
        connectorName: connector.nome,
        endpointBase,
        sellerId,
        nickname: config?.nickname ?? null,
        oauthUserId: config?.user_id ?? null,
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(config?.refresh_token),
        tokenExpiresAt: config?.token_expires_at ?? null,
        message: error instanceof Error ? error.message : "Erro desconhecido ao consultar a loja.",
      },
    });
    return {
      ok: false,
      connector: {
        id: connector.id,
        nome: connector.nome,
        sellerId,
        nickname: config?.nickname ?? null,
      },
      produtos: [],
      error:
        error instanceof Error
          ? buildMercadoLivreFriendlyError(error.message)
          : "Nao foi possivel consultar a loja no Mercado Livre.",
    };
  }
}
