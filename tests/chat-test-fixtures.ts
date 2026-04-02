import { readFileSync } from "node:fs";
import path from "node:path";

import type { ApiRuntimeContext } from "@/lib/apis";
import type { ConversationContext } from "@/lib/chat-context";
import type { ProdutoDetalhadoMercadoLivre, ProdutoPadronizado } from "@/lib/mercado-livre";

type MercadoLivreFixture = {
  listingProducts: ProdutoPadronizado[];
  searchProducts: ProdutoPadronizado[];
  detailedProducts: ProdutoDetalhadoMercadoLivre[];
};

type ApiRuntimeFixture = {
  apis: ApiRuntimeContext[];
};

type HandoffFixture = {
  explicitHumanMessage: string;
  softOfferReply: string;
  recoveryHistory: Array<{
    role?: string;
    conteudo?: string;
    metadata?: Record<string, unknown>;
  }>;
};

function fixturesDir() {
  return path.join(process.cwd(), "tests", "fixtures");
}

function readFixtureJson<T>(filename: string): T {
  const content = readFileSync(path.join(fixturesDir(), filename), "utf-8");
  return JSON.parse(content) as T;
}

export function loadCatalogContextFixture(): ConversationContext {
  const fixture = readFixtureJson<ConversationContext>("catalog-context.base.json");
  return materializeCatalogFixture(fixture);
}

export function loadStaleCatalogContextFixture(): ConversationContext {
  const fixture = readFixtureJson<ConversationContext>("catalog-context.stale.json");
  return materializeCatalogFixture(fixture);
}

function materializeCatalogFixture(fixture: ConversationContext): ConversationContext {
  return {
    ...fixture,
    memoria: {
      ...fixture.memoria,
    },
    catalogo: fixture.catalogo
      ? {
          ...fixture.catalogo,
          snapshotCreatedAt: new Date().toISOString(),
          produtoAtual: fixture.catalogo.produtoAtual ? { ...fixture.catalogo.produtoAtual } : null,
          ultimosProdutos: Array.isArray(fixture.catalogo.ultimosProdutos)
            ? fixture.catalogo.ultimosProdutos.map((item) => ({ ...item }))
            : [],
        }
      : undefined,
  };
}

export function loadApiRuntimeFixture() {
  return readFixtureJson<ApiRuntimeFixture>("api-runtime-context.products.json");
}

export function loadApiRuntimeErrorFixture() {
  return readFixtureJson<ApiRuntimeFixture>("api-runtime-context.error.json");
}

export function loadMercadoLivreFixture() {
  return readFixtureJson<MercadoLivreFixture>("mercado-livre-products.json");
}

export function loadMercadoLivreAmbiguousFixture() {
  return readFixtureJson<MercadoLivreFixture>("mercado-livre-ambiguous.json");
}

export function loadLeadContextFixture(): ConversationContext {
  return readFixtureJson<ConversationContext>("lead-context.base.json");
}

export function loadHandoffFixture() {
  return readFixtureJson<HandoffFixture>("handoff-cases.json");
}

export function createFixtureSearchDeps() {
  return {
    buildProductSearchCandidates: (message: string) => {
      const normalized = normalizeFixtureText(message);
      if (!normalized || ["oi", "ola", "ok"].includes(normalized)) return [];
      if (normalized.includes("prato azul")) return ["prato azul"];
      if (normalized.includes("sopeira")) return ["sopeira"];
      if (normalized.includes("garantia")) return [];
      return normalized.split(/\s+/).length >= 2 ? [normalized] : [];
    },
    shouldSearchProducts: (message: string) => /\b(tem|procuro|buscar|mostra|me mostra)\b/i.test(message),
    isMercadoLivrePurchaseIntent: (message: string) => /\b(gostei|quero|comprar|manda o link|vou querer)\b/i.test(message),
    isMercadoLivreDetailIntent: (message: string) => /\b(garantia|frete|estoque|detalhes|cor|material)\b/i.test(message),
  };
}

export function normalizeFixtureText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
