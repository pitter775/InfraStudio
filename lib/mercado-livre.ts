import "server-only";

import {
  getMercadoLivreConnectorConfig,
  listConectoresByAgente,
  MERCADO_LIVRE_CONNECTOR_TYPE,
  type ConnectorRecord,
} from "@/lib/conectores";
import { ensureMercadoLivreAccessToken } from "@/lib/mercado-livre-oauth";

export type ProdutoPadronizado = {
  nome: string;
  preco: number;
  imagem: string;
  link: string;
  publicadoEm: string | null;
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
  const normalizedTerm = normalizeSearchText(termo);
  const terms = [...new Set([termo.trim(), normalizedTerm].filter(Boolean))];
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

  return rankProdutosByTermo(dedupeProdutos(batches), termo).slice(0, 3);
}

type MercadoLivreItemDetailsResponse = Array<{
  code?: number;
  body?: {
    title?: string;
    price?: number;
    thumbnail?: string;
    permalink?: string;
    date_created?: string;
    start_time?: string;
    last_updated?: string;
  };
}>;

async function fetchMercadoLivreLatestProducts(input: {
  endpointBase: string;
  sellerId: string;
  accessToken?: string;
  limit?: number;
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
    throw new Error(`Mercado Livre retornou ${searchResponse.status} ao listar itens do seller.`);
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
    throw new Error(`Mercado Livre retornou ${detailsResponse.status} ao carregar detalhes dos itens.`);
  }

  const detailsPayload = (await detailsResponse.json()) as MercadoLivreItemDetailsResponse;
  return detailsPayload
    .map((entry) => (entry.body ? normalizeProduto(entry.body) : null))
    .filter(Boolean) as ProdutoPadronizado[];
}

export async function buscarProdutosMercadoLivrePorAgente(agenteId: string, termo: string) {
  const termoNormalizado = termo.trim();
  if (!agenteId.trim() || !termoNormalizado) {
    return [];
  }

  const conectores = await listConectoresByAgente(agenteId, MERCADO_LIVRE_CONNECTOR_TYPE);
  if (!conectores.length) {
    return [];
  }

  const resultados = await Promise.all(conectores.map((connector) => searchConnectorProducts(connector, termoNormalizado)));
  return dedupeProdutos(resultados.flat()).slice(0, 3);
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

  if (!sellerId) {
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

  try {
    const produtos = await fetchMercadoLivreLatestProducts({
      endpointBase,
      sellerId,
      accessToken,
      limit: 5,
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
    return {
      ok: false,
      connector: {
        id: connector.id,
        nome: connector.nome,
        sellerId,
        nickname: config?.nickname ?? null,
      },
      produtos: [],
      error: error instanceof Error ? error.message : "Nao foi possivel consultar a loja no Mercado Livre.",
    };
  }
}
