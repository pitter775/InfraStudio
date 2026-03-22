import "server-only";

import {
  getMercadoLivreConnectorConfig,
  listConectoresByAgente,
  MERCADO_LIVRE_CONNECTOR_TYPE,
  type ConnectorRecord,
} from "@/lib/conectores";

export type ProdutoPadronizado = {
  nome: string;
  preco: number;
  imagem: string;
  link: string;
};

type MercadoLivreSearchItem = {
  title?: string;
  price?: number;
  thumbnail?: string;
  permalink?: string;
};

type MercadoLivreSearchResponse = {
  results?: MercadoLivreSearchItem[];
};

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
      .slice(0, input.limit ?? 3) as ProdutoPadronizado[];
  } catch (error) {
    if ((error as Error).name !== "AbortError") {
      console.error("[mercado-livre] failed to fetch products", error);
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function searchConnectorProducts(connector: ConnectorRecord, termo: string) {
  const config = getMercadoLivreConnectorConfig(connector);
  const endpointBase = connector.endpointBase || "https://api.mercadolibre.com";
  const sellerId = config?.seller_id?.trim();

  const primary = await fetchMercadoLivreProducts({
    endpointBase,
    termo,
    sellerId,
    limit: 3,
  });

  if (primary.length || sellerId) {
    return primary;
  }

  return await fetchMercadoLivreProducts({
    endpointBase,
    termo,
    limit: 3,
  });
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
