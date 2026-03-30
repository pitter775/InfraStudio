import "server-only";

import { createProjetoUsageCycle, listBillingUsageByProject, syncProjetoPlanoSnapshotFromPlan } from "@/lib/billing";
import { getPlanoById } from "@/lib/planos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type AssinaturaStatus = "ativo" | "cancelado" | "trial" | "suspenso";

type AssinaturaRow = {
  id: string;
  projeto_id: string;
  plano_id: string;
  status: AssinaturaStatus | null;
  data_inicio: string | null;
  data_fim: string | null;
  renovar_automatico: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ProjetoAssinaturaRecord = {
  id: string;
  projetoId: string;
  planoId: string;
  status: AssinaturaStatus;
  dataInicio: string | null;
  dataFim: string | null;
  renovarAutomatico: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AssinaturaOverview = {
  assinaturaId: string | null;
  projetoId: string;
  projetoNome: string;
  modoCobranca: "plano" | "manual" | "ilimitado";
  planoId: string | null;
  planoNome: string;
  status: AssinaturaStatus | null;
  renovarAutomatico: boolean;
  dataInicio: string | null;
  dataFim: string | null;
  usoPercentual: number | null;
  statusUso: "ativo" | "bloqueado";
};

function mapAssinatura(row: AssinaturaRow): ProjetoAssinaturaRecord {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    planoId: row.plano_id,
    status: row.status ?? "ativo",
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    renovarAutomatico: row.renovar_automatico !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAssinaturasOverview() {
  const [usageRows, assinaturas] = await Promise.all([
    listBillingUsageByProject(),
    listAssinaturas(),
  ]);

  const assinaturaMap = new Map(assinaturas.map((item) => [item.projetoId, item]));

  return usageRows.map<AssinaturaOverview>((item) => {
    const assinatura = assinaturaMap.get(item.projetoId) ?? null;

    return {
      assinaturaId: assinatura?.id ?? null,
      projetoId: item.projetoId,
      projetoNome: item.projetoNome,
      modoCobranca: item.modoCobranca,
      planoId: assinatura?.planoId ?? item.assinaturaAtual?.planoId ?? null,
      planoNome: item.plano.nomePlano,
      status: assinatura?.status ?? item.assinaturaAtual?.status ?? null,
      renovarAutomatico: assinatura?.renovarAutomatico ?? item.assinaturaAtual?.renovarAutomatico ?? false,
      dataInicio: assinatura?.dataInicio ?? item.assinaturaAtual?.dataInicio ?? null,
      dataFim: assinatura?.dataFim ?? item.assinaturaAtual?.dataFim ?? null,
      usoPercentual: item.percentualUso,
      statusUso: item.status,
    };
  });
}

export async function listAssinaturas() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos_assinaturas")
    .select("id, projeto_id, plano_id, status, data_inicio, data_fim, renovar_automatico, created_at, updated_at")
    .in("status", ["ativo", "trial", "suspenso"])
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("[assinaturas] failed to list subscriptions", error);
    return [];
  }

  const byProject = new Map<string, ProjetoAssinaturaRecord>();
  for (const row of data as AssinaturaRow[]) {
    if (!byProject.has(row.projeto_id)) {
      byProject.set(row.projeto_id, mapAssinatura(row));
    }
  }

  return Array.from(byProject.values());
}

async function cancelActiveAssinaturas(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("projetos_assinaturas")
    .update(({
      status: "cancelado",
      data_fim: now,
      updated_at: now,
    }) as never)
    .eq("projeto_id", projetoId)
    .in("status", ["ativo", "trial", "suspenso"]);

  if (error) {
    console.error("[assinaturas] failed to cancel previous active subscriptions", error);
    return false;
  }

  return true;
}

export async function createAssinatura(input: {
  projetoId: string;
  planoId: string;
  status?: AssinaturaStatus;
  dataInicio?: string | null;
  renovarAutomatico?: boolean | null;
}) {
  const supabase = getSupabaseAdminClient();
  const plano = await getPlanoById(input.planoId);
  if (!plano) {
    return null;
  }

  const previousCancelled = await cancelActiveAssinaturas(input.projetoId);
  if (!previousCancelled) {
    return null;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("projetos_assinaturas")
    .insert(({
      projeto_id: input.projetoId,
      plano_id: input.planoId,
      status: input.status ?? "ativo",
      data_inicio: input.dataInicio ?? now,
      renovar_automatico: input.renovarAutomatico !== false,
      created_at: now,
      updated_at: now,
    }) as never)
    .select("id, projeto_id, plano_id, status, data_inicio, data_fim, renovar_automatico, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[assinaturas] failed to create subscription", error);
    return null;
  }

  await syncProjetoPlanoSnapshotFromPlan({
    projetoId: input.projetoId,
    plano: {
      id: plano.id,
      nome: plano.nome,
      precoMensal: plano.precoMensal,
      limiteTokensTotalMensal: plano.limiteTokensTotalMensal,
      limiteCustoMensal: plano.limiteCustoMensal,
      maxAgentes: plano.maxAgentes,
      maxApis: plano.maxApis,
      maxWhatsapp: plano.maxWhatsapp,
      ativo: plano.ativo,
    },
    clearBlock: true,
  });

  await createProjetoUsageCycle({
    projetoId: input.projetoId,
    startDate: input.dataInicio ? new Date(input.dataInicio) : new Date(),
    closeExisting: true,
  });

  return mapAssinatura(data as AssinaturaRow);
}

export async function trocarPlanoProjeto(projetoId: string, planoId: string) {
  return createAssinatura({
    projetoId,
    planoId,
    status: "ativo",
    renovarAutomatico: true,
  });
}

export async function cancelarAssinatura(assinaturaId: string) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("projetos_assinaturas")
    .update(({
      status: "cancelado",
      data_fim: now,
      updated_at: now,
    }) as never)
    .eq("id", assinaturaId)
    .select("id, projeto_id, plano_id, status, data_inicio, data_fim, renovar_automatico, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[assinaturas] failed to cancel subscription", error);
    return null;
  }

  return mapAssinatura(data as AssinaturaRow);
}
