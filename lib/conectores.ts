import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const MERCADO_LIVRE_CONNECTOR_TYPE = "mercado_livre";
export const MERCADO_LIVRE_ENDPOINT_BASE = "https://api.mercadolibre.com";

export type MercadoLivreConnectorConfig = {
  seller_id?: string;
  nickname?: string;
};

export type ConnectorRecord = {
  id: string;
  projetoId: string | null;
  agenteId: string | null;
  nome: string;
  tipo: string;
  endpointBase: string;
  configuracoes: Record<string, unknown> | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
};

type ConnectorRow = {
  id: string;
  projeto_id: string | null;
  agente_id: string | null;
  nome: string | null;
  tipo: string | null;
  endpoint_base: string | null;
  configuracoes: Record<string, unknown> | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function mapConnector(row: ConnectorRow): ConnectorRecord {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    agenteId: row.agente_id,
    nome: row.nome?.trim() || "Conector sem nome",
    tipo: row.tipo?.trim() || MERCADO_LIVRE_CONNECTOR_TYPE,
    endpointBase: row.endpoint_base?.trim() || MERCADO_LIVRE_ENDPOINT_BASE,
    configuracoes: row.configuracoes ?? null,
    ativo: Boolean(row.ativo),
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

function normalizeMercadoLivreConfig(configuracoes?: Record<string, unknown> | null): MercadoLivreConnectorConfig | null {
  if (!configuracoes) {
    return null;
  }

  const sellerId =
    typeof configuracoes.seller_id === "string" && configuracoes.seller_id.trim()
      ? configuracoes.seller_id.trim()
      : undefined;
  const nickname =
    typeof configuracoes.nickname === "string" && configuracoes.nickname.trim()
      ? configuracoes.nickname.trim()
      : undefined;

  if (!sellerId && !nickname) {
    return null;
  }

  return {
    seller_id: sellerId,
    nickname,
  };
}

export function getMercadoLivreConnectorConfig(connector: Pick<ConnectorRecord, "tipo" | "configuracoes">) {
  if (connector.tipo !== MERCADO_LIVRE_CONNECTOR_TYPE) {
    return null;
  }

  return normalizeMercadoLivreConfig(connector.configuracoes);
}

export async function listConectores(projetoId?: string | null) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("conectores")
    .select("id, projeto_id, agente_id, nome, tipo, endpoint_base, configuracoes, ativo, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (projetoId) {
    query = query.eq("projeto_id", projetoId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("[conectores] failed to list connectors", error);
    return [];
  }

  return data.map((row) => mapConnector(row as ConnectorRow));
}

export async function listConectoresByAgente(agenteId: string, tipo?: string) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("conectores")
    .select("id, projeto_id, agente_id, nome, tipo, endpoint_base, configuracoes, ativo, created_at, updated_at")
    .eq("agente_id", agenteId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  if (tipo) {
    query = query.eq("tipo", tipo);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("[conectores] failed to list connectors by agent", error);
    return [];
  }

  return data.map((row) => mapConnector(row as ConnectorRow));
}

export async function createConector(input: {
  projetoId: string;
  agenteId?: string | null;
  nome: string;
  tipo: string;
  endpointBase?: string | null;
  configuracoes?: Record<string, unknown> | null;
  ativo?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("conectores")
    .insert({
      projeto_id: input.projetoId,
      agente_id: input.agenteId ?? null,
      nome: input.nome.trim(),
      tipo: input.tipo.trim(),
      endpoint_base: input.endpointBase?.trim() || MERCADO_LIVRE_ENDPOINT_BASE,
      configuracoes: input.configuracoes ?? null,
      ativo: input.ativo ?? true,
      created_at: now,
      updated_at: now,
    } as never)
    .select("id, projeto_id, agente_id, nome, tipo, endpoint_base, configuracoes, ativo, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[conectores] failed to create connector", error);
    return null;
  }

  return mapConnector(data as ConnectorRow);
}

export async function updateConector(input: {
  id: string;
  projetoId: string;
  agenteId?: string | null;
  nome: string;
  tipo: string;
  endpointBase?: string | null;
  configuracoes?: Record<string, unknown> | null;
  ativo?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conectores")
    .update({
      projeto_id: input.projetoId,
      agente_id: input.agenteId ?? null,
      nome: input.nome.trim(),
      tipo: input.tipo.trim(),
      endpoint_base: input.endpointBase?.trim() || MERCADO_LIVRE_ENDPOINT_BASE,
      configuracoes: input.configuracoes ?? null,
      ativo: input.ativo ?? true,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id)
    .select("id, projeto_id, agente_id, nome, tipo, endpoint_base, configuracoes, ativo, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[conectores] failed to update connector", error);
    return null;
  }

  return mapConnector(data as ConnectorRow);
}
