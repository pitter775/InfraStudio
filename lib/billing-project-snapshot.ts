import "server-only";

import { syncProjetoUsageCycleWithSnapshot, updateProjetoPlanoBilling } from "@/lib/billing";
import { appendSystemLog } from "@/lib/chat-logs";
import { getBillingPlanCatalogById } from "@/lib/billing-plan-catalog";
import { listProjetos, updateProjeto } from "@/lib/projetos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type ApplyProjectBillingSelectionInput = {
  projetoId: string;
  modoCobranca: "plano" | "manual" | "ilimitado";
  planoId?: string | null;
};

async function ownerAlreadyHasAnotherFreeProject(input: {
  ownerUserId: string;
  excludeProjectId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data: ownerProjects, error: ownerProjectsError } = await supabase
    .from("projetos")
    .select("id")
    .eq("owner_user_id", input.ownerUserId)
    .neq("id", input.excludeProjectId);

  if (ownerProjectsError) {
    console.error("[billing-project-snapshot] failed to list owner projects", ownerProjectsError);
    return { ok: false as const, hasAnotherFreeProject: false };
  }

  const projectIds = ((ownerProjects ?? []) as Array<{ id: string | null }>)
    .map((item) => item.id)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (!projectIds.length) {
    return { ok: true as const, hasAnotherFreeProject: false };
  }

  const { data: freePlans, error: freePlansError } = await supabase
    .from("planos")
    .select("id")
    .eq("is_free", true)
    .eq("ativo", true);

  if (freePlansError) {
    console.error("[billing-project-snapshot] failed to list free plans", freePlansError);
    return { ok: false as const, hasAnotherFreeProject: false };
  }

  const freePlanIds = ((freePlans ?? []) as Array<{ id: string | null }>)
    .map((item) => item.id)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (!freePlanIds.length) {
    return { ok: true as const, hasAnotherFreeProject: false };
  }

  const { count, error: snapshotError } = await supabase
    .from("projetos_planos")
    .select("id", { count: "exact", head: true })
    .in("projeto_id", projectIds)
    .in("plano_id", freePlanIds);

  if (snapshotError) {
    console.error("[billing-project-snapshot] failed to count free project snapshots", snapshotError);
    return { ok: false as const, hasAnotherFreeProject: false };
  }

  return { ok: true as const, hasAnotherFreeProject: (count ?? 0) > 0 };
}

export async function applyProjectBillingSelection(input: ApplyProjectBillingSelectionInput) {
  const projetos = await listProjetos();
  const projetoAtual = projetos.find((item) => item.id === input.projetoId);

  if (!projetoAtual) {
    return { ok: false as const, reason: "project_not_found" };
  }

  const projeto = await updateProjeto({
    id: input.projetoId,
    nome: projetoAtual.nome,
    slug: projetoAtual.slug,
    tipo: projetoAtual.tipo,
    descricao: projetoAtual.descricao,
    status: projetoAtual.status,
    modoCobranca: input.modoCobranca,
  });

  if (!projeto) {
    await appendSystemLog({
      projetoId: input.projetoId,
      tipo: "billing_update_error",
      origem: "billing_project_snapshot",
      descricao: "Falha ao atualizar modo de cobranca ao aplicar plano.",
      payload: {
        modoCobranca: input.modoCobranca,
        planoId: input.planoId ?? null,
      },
    });
    return { ok: false as const, reason: "project_mode_update_failed" };
  }

  if (input.modoCobranca === "ilimitado") {
    const plan = await updateProjetoPlanoBilling({
      projetoId: input.projetoId,
      planoId: null,
      nomePlano: "Ilimitado",
      limiteTokensTotalMensal: null,
      limiteCustoMensal: null,
      permitirExcedente: true,
      custoTokenExcedente: 0,
      autoBloquear: false,
      bloqueado: false,
      bloqueadoMotivo: null,
    });

    if (!plan) {
      return { ok: false as const, reason: "snapshot_update_failed" };
    }

    await syncProjetoUsageCycleWithSnapshot(input.projetoId, plan);
    return { ok: true as const, plan };
  }

  if (input.modoCobranca !== "plano" || !input.planoId) {
    return { ok: false as const, reason: "invalid_plan_selection" };
  }

  const plano = await getBillingPlanCatalogById(input.planoId);
  if (!plano) {
    return { ok: false as const, reason: "plan_not_found" };
  }

  if (plano.isFree) {
    if (!projetoAtual.ownerUserId) {
      await appendSystemLog({
        projetoId: input.projetoId,
        tipo: "billing_update_error",
        origem: "billing_project_snapshot",
        descricao: "Projeto sem owner_user_id nao pode receber plano free.",
        payload: {
          planoId: plano.id,
          planoNome: plano.nome,
        },
      });
      return { ok: false as const, reason: "project_owner_missing" };
    }

    const freeLimitCheck = await ownerAlreadyHasAnotherFreeProject({
      ownerUserId: projetoAtual.ownerUserId,
      excludeProjectId: input.projetoId,
    });

    if (!freeLimitCheck.ok) {
      return { ok: false as const, reason: "free_plan_validation_failed" };
    }

    if (freeLimitCheck.hasAnotherFreeProject) {
      return { ok: false as const, reason: "free_plan_limit_reached" };
    }
  }

  const plan = await updateProjetoPlanoBilling({
    projetoId: input.projetoId,
    planoId: plano.id,
    nomePlano: plano.nome,
    limiteTokensTotalMensal: plano.limiteTokensTotalMensal,
    limiteCustoMensal: plano.limiteCustoMensal,
    permitirExcedente: plano.permitirExcedente,
    custoTokenExcedente: plano.custoTokenExcedente,
    autoBloquear: true,
    bloqueado: false,
    bloqueadoMotivo: null,
  });

  if (!plan) {
    return { ok: false as const, reason: "snapshot_update_failed" };
  }

  await syncProjetoUsageCycleWithSnapshot(input.projetoId, plan);
  return { ok: true as const, plan };
}
