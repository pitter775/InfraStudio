import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type PlanoRow = {
  id: string;
  nome: string | null;
  preco_mensal: number | null;
  limite_tokens_total_mensal: number | null;
  limite_custo_mensal: number | null;
  max_agentes: number | null;
  max_apis: number | null;
  max_whatsapp: number | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PlanoRecord = {
  id: string;
  nome: string;
  precoMensal: number;
  limiteTokensTotalMensal: number | null;
  limiteCustoMensal: number | null;
  maxAgentes: number;
  maxApis: number;
  maxWhatsapp: number;
  ativo: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

function normalizeNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.round(parsed));
}

function normalizeNullableDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Number(parsed.toFixed(6)));
}

function mapPlano(row: PlanoRow): PlanoRecord {
  return {
    id: row.id,
    nome: row.nome?.trim() || "Plano sem nome",
    precoMensal: Number(row.preco_mensal ?? 0),
    limiteTokensTotalMensal: row.limite_tokens_total_mensal ?? null,
    limiteCustoMensal: row.limite_custo_mensal ?? null,
    maxAgentes: row.max_agentes ?? 0,
    maxApis: row.max_apis ?? 0,
    maxWhatsapp: row.max_whatsapp ?? 0,
    ativo: row.ativo !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPlanos() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("planos")
    .select("id, nome, preco_mensal, limite_tokens_total_mensal, limite_custo_mensal, max_agentes, max_apis, max_whatsapp, ativo, created_at, updated_at")
    .order("preco_mensal", { ascending: true })
    .order("nome", { ascending: true });

  if (error || !data) {
    console.error("[planos] failed to list plans", error);
    return [];
  }

  return (data as PlanoRow[]).map(mapPlano);
}

export async function getPlanoById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("planos")
    .select("id, nome, preco_mensal, limite_tokens_total_mensal, limite_custo_mensal, max_agentes, max_apis, max_whatsapp, ativo, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[planos] failed to load plan", error);
    }
    return null;
  }

  return mapPlano(data as PlanoRow);
}

export async function createPlano(input: {
  nome: string;
  precoMensal?: number | string | null;
  limiteTokensTotalMensal?: number | string | null;
  limiteCustoMensal?: number | string | null;
  maxAgentes?: number | string | null;
  maxApis?: number | string | null;
  maxWhatsapp?: number | string | null;
  ativo?: boolean | null;
}) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("planos")
    .insert(({
      nome: input.nome.trim(),
      preco_mensal: Number(input.precoMensal ?? 0),
      limite_tokens_total_mensal: normalizeNullableInteger(input.limiteTokensTotalMensal),
      limite_custo_mensal: normalizeNullableDecimal(input.limiteCustoMensal),
      max_agentes: normalizeNullableInteger(input.maxAgentes) ?? 0,
      max_apis: normalizeNullableInteger(input.maxApis) ?? 0,
      max_whatsapp: normalizeNullableInteger(input.maxWhatsapp) ?? 0,
      ativo: input.ativo !== false,
      created_at: now,
      updated_at: now,
    }) as never)
    .select("id, nome, preco_mensal, limite_tokens_total_mensal, limite_custo_mensal, max_agentes, max_apis, max_whatsapp, ativo, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[planos] failed to create plan", error);
    return null;
  }

  return mapPlano(data as PlanoRow);
}

export async function updatePlano(input: {
  id: string;
  nome?: string | null;
  precoMensal?: number | string | null;
  limiteTokensTotalMensal?: number | string | null;
  limiteCustoMensal?: number | string | null;
  maxAgentes?: number | string | null;
  maxApis?: number | string | null;
  maxWhatsapp?: number | string | null;
  ativo?: boolean | null;
}) {
  const supabase = getSupabaseAdminClient();
  const current = await getPlanoById(input.id);
  if (!current) {
    return null;
  }

  const { data, error } = await supabase
    .from("planos")
    .update(({
      nome: input.nome?.trim() || current.nome,
      preco_mensal: input.precoMensal === undefined ? current.precoMensal : Number(input.precoMensal ?? 0),
      limite_tokens_total_mensal:
        input.limiteTokensTotalMensal === undefined
          ? current.limiteTokensTotalMensal
          : normalizeNullableInteger(input.limiteTokensTotalMensal),
      limite_custo_mensal:
        input.limiteCustoMensal === undefined
          ? current.limiteCustoMensal
          : normalizeNullableDecimal(input.limiteCustoMensal),
      max_agentes: input.maxAgentes === undefined ? current.maxAgentes : normalizeNullableInteger(input.maxAgentes) ?? 0,
      max_apis: input.maxApis === undefined ? current.maxApis : normalizeNullableInteger(input.maxApis) ?? 0,
      max_whatsapp: input.maxWhatsapp === undefined ? current.maxWhatsapp : normalizeNullableInteger(input.maxWhatsapp) ?? 0,
      ativo: input.ativo === undefined ? current.ativo : input.ativo === true,
      updated_at: new Date().toISOString(),
    }) as never)
    .eq("id", input.id)
    .select("id, nome, preco_mensal, limite_tokens_total_mensal, limite_custo_mensal, max_agentes, max_apis, max_whatsapp, ativo, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[planos] failed to update plan", error);
    return null;
  }

  return mapPlano(data as PlanoRow);
}

export async function setPlanoAtivo(id: string, ativo: boolean) {
  return updatePlano({ id, ativo });
}
