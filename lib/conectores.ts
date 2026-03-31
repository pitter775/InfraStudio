import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const MERCADO_LIVRE_CONNECTOR_TYPE = "mercado_livre";
export const MERCADO_LIVRE_ENDPOINT_BASE = "https://api.mercadolibre.com";

export type MercadoLivreConnectorConfig = {
  app_id?: string;
  client_secret?: string;
  seller_id?: string;
  nickname?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  user_id?: string;
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

  const appId =
    typeof configuracoes.app_id === "string" && configuracoes.app_id.trim()
      ? configuracoes.app_id.trim()
      : undefined;
  const clientSecret =
    typeof configuracoes.client_secret === "string" && configuracoes.client_secret.trim()
      ? configuracoes.client_secret.trim()
      : undefined;
  const mlSellerId =
    typeof configuracoes.seller_id === "string" && configuracoes.seller_id.trim()
      ? configuracoes.seller_id.trim()
      : undefined;
  const nickname =
    typeof configuracoes.nickname === "string" && configuracoes.nickname.trim()
      ? configuracoes.nickname.trim()
      : undefined;
  const accessToken =
    typeof configuracoes.access_token === "string" && configuracoes.access_token.trim()
      ? configuracoes.access_token.trim()
      : undefined;
  const refreshToken =
    typeof configuracoes.refresh_token === "string" && configuracoes.refresh_token.trim()
      ? configuracoes.refresh_token.trim()
      : undefined;
  const tokenExpiresAt =
    typeof configuracoes.token_expires_at === "string" && configuracoes.token_expires_at.trim()
      ? configuracoes.token_expires_at.trim()
      : undefined;
  const userId =
    typeof configuracoes.user_id === "string" && configuracoes.user_id.trim()
      ? configuracoes.user_id.trim()
      : undefined;

  if (!appId && !clientSecret && !mlSellerId && !nickname && !accessToken && !refreshToken && !tokenExpiresAt && !userId) {
    return null;
  }

  return {
    app_id: appId,
    client_secret: clientSecret,
    seller_id: mlSellerId,
    nickname,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expires_at: tokenExpiresAt,
    user_id: userId,
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

export async function getConectorById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conectores")
    .select("id, projeto_id, agente_id, nome, tipo, endpoint_base, configuracoes, ativo, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[conectores] failed to load connector by id", error);
    }
    return null;
  }

  return mapConnector(data as ConnectorRow);
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

export async function getConectorByProjetoTipo(input: {
  projetoId: string;
  tipo: string;
  excludeId?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("conectores")
    .select("id, projeto_id, agente_id, nome, tipo, endpoint_base, configuracoes, ativo, created_at, updated_at")
    .eq("projeto_id", input.projetoId)
    .eq("tipo", input.tipo)
    .order("created_at", { ascending: true })
    .limit(1);

  if (input.excludeId) {
    query = query.neq("id", input.excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[conectores] failed to load connector by project/type", error);
    }
    return null;
  }

  return mapConnector(data as ConnectorRow);
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

export async function deleteConector(id: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("conectores").delete().eq("id", id);

  if (error) {
    console.error("[conectores] failed to delete connector", error);
    return false;
  }

  return true;
}
