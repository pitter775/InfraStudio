import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type BillingPlanCatalogRow = {
  id: string;
  nome: string | null;
  preco_mensal: number | null;
  limite_tokens_total_mensal: number | null;
  limite_custo_mensal: number | null;
  is_free: boolean | null;
  ativo: boolean | null;
  permitir_excedente: boolean | null;
  custo_token_excedente: number | null;
};

export type BillingPlanCatalogRecord = {
  id: string;
  nome: string;
  precoMensal: number;
  limiteTokensTotalMensal: number | null;
  limiteCustoMensal: number | null;
  isFree: boolean;
  ativo: boolean;
  permitirExcedente: boolean;
  custoTokenExcedente: number;
};

function mapBillingPlanCatalog(row: BillingPlanCatalogRow): BillingPlanCatalogRecord {
  return {
    id: row.id,
    nome: row.nome?.trim() || "Plano sem nome",
    precoMensal: Number(row.preco_mensal ?? 0),
    limiteTokensTotalMensal: row.limite_tokens_total_mensal ?? null,
    limiteCustoMensal: row.limite_custo_mensal ?? null,
    isFree: row.is_free === true,
    ativo: row.ativo !== false,
    permitirExcedente: row.permitir_excedente === true,
    custoTokenExcedente: Number(row.custo_token_excedente ?? 0),
  };
}

export async function getBillingPlanCatalogById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("planos")
    .select("id, nome, preco_mensal, limite_tokens_total_mensal, limite_custo_mensal, is_free, ativo, permitir_excedente, custo_token_excedente")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[billing-plan-catalog] failed to load plan", error);
    }
    return null;
  }

  return mapBillingPlanCatalog(data as BillingPlanCatalogRow);
}

export async function syncProjetoSnapshotsForPlan(plan: BillingPlanCatalogRecord) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("projetos_planos")
    .update({
      nome_plano: plan.nome,
      limite_tokens_total_mensal: plan.limiteTokensTotalMensal,
      limite_custo_mensal: plan.limiteCustoMensal,
      permitir_excedente: plan.permitirExcedente,
      custo_token_excedente: plan.custoTokenExcedente,
      updated_at: now,
    } as never)
    .eq("plano_id", plan.id);

  if (error) {
    console.error("[billing-plan-catalog] failed to sync project snapshots", error);
  }
}
