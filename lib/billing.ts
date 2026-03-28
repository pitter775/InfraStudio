import "server-only";

import { getDefaultOpenAIModel, resolvePricingModel } from "@/lib/openai-pricing";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type ProjetoPlanoRow = {
  id: string;
  projeto_id: string;
  nome_plano: string | null;
  modelo_referencia: string | null;
  limite_tokens_input_mensal: number | null;
  limite_tokens_output_mensal: number | null;
  limite_tokens_total_mensal: number | null;
  limite_custo_mensal: number | null;
  auto_bloquear: boolean | null;
  bloqueado: boolean | null;
  bloqueado_motivo: string | null;
  observacoes: string | null;
};

type UsuarioLimiteIaRow = {
  id: string;
  usuario_id: string;
  projeto_id: string;
  papel_financeiro: string | null;
  modelo_referencia: string | null;
  limite_tokens_input_mensal: number | null;
  limite_tokens_output_mensal: number | null;
  limite_tokens_total_mensal: number | null;
  limite_custo_mensal: number | null;
  auto_bloquear: boolean | null;
  bloqueado: boolean | null;
  bloqueado_motivo: string | null;
  observacoes: string | null;
};

type ConsumoAggregateRow = {
  tokens_input: number | null;
  tokens_output: number | null;
  custo_total: number | null;
};

export type BillingWindow = {
  startDate: string;
  endDate: string;
  startIso: string;
  endExclusiveIso: string;
  label: string;
};

export type ProjetoPlanoBilling = {
  id: string;
  projetoId: string;
  nomePlano: string;
  modeloReferencia: string;
  limiteTokensInputMensal: number | null;
  limiteTokensOutputMensal: number | null;
  limiteTokensTotalMensal: number | null;
  limiteCustoMensal: number | null;
  autoBloquear: boolean;
  bloqueado: boolean;
  bloqueadoMotivo: string | null;
  observacoes: string | null;
};

export type UsuarioLimiteBilling = {
  id: string;
  usuarioId: string;
  projetoId: string;
  papelFinanceiro: string;
  modeloReferencia: string;
  limiteTokensInputMensal: number | null;
  limiteTokensOutputMensal: number | null;
  limiteTokensTotalMensal: number | null;
  limiteCustoMensal: number | null;
  autoBloquear: boolean;
  bloqueado: boolean;
  bloqueadoMotivo: string | null;
  observacoes: string | null;
};

export type BillingUsageTotals = {
  tokensInput: number;
  tokensOutput: number;
  totalTokens: number;
  custoTotal: number;
};

export type BillingSnapshot = {
  window: BillingWindow;
  modeloPadrao: string;
  projetoPlano: ProjetoPlanoBilling | null;
  usuarioLimite: UsuarioLimiteBilling | null;
  consumoProjeto: BillingUsageTotals;
  consumoUsuario: BillingUsageTotals;
  limitesEfetivos: {
    tokensInputMensal: number | null;
    tokensOutputMensal: number | null;
    tokensTotalMensal: number | null;
    custoMensal: number | null;
  };
};

export type ProjetoBillingOverview = {
  window: BillingWindow;
  plano: ProjetoPlanoBilling;
  consumoAtual: BillingUsageTotals;
};

export type BillingDecisionCode =
  | "allowed"
  | "project_manually_blocked"
  | "user_manually_blocked"
  | "project_tokens_input_limit_reached"
  | "project_tokens_output_limit_reached"
  | "project_tokens_total_limit_reached"
  | "project_cost_limit_reached"
  | "user_tokens_input_limit_reached"
  | "user_tokens_output_limit_reached"
  | "user_tokens_total_limit_reached"
  | "user_cost_limit_reached";

export type BillingDecision = {
  allowed: boolean;
  code: BillingDecisionCode;
  message: string | null;
  snapshot: BillingSnapshot;
};

function mapProjetoPlano(row: ProjetoPlanoRow): ProjetoPlanoBilling {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    nomePlano: row.nome_plano?.trim() || "padrao",
    modeloReferencia: row.modelo_referencia?.trim() || getDefaultOpenAIModel(),
    limiteTokensInputMensal: row.limite_tokens_input_mensal ?? null,
    limiteTokensOutputMensal: row.limite_tokens_output_mensal ?? null,
    limiteTokensTotalMensal: row.limite_tokens_total_mensal ?? null,
    limiteCustoMensal: row.limite_custo_mensal ?? null,
    autoBloquear: row.auto_bloquear !== false,
    bloqueado: row.bloqueado === true,
    bloqueadoMotivo: row.bloqueado_motivo?.trim() || null,
    observacoes: row.observacoes?.trim() || null,
  };
}

function mapUsuarioLimite(row: UsuarioLimiteIaRow): UsuarioLimiteBilling {
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    projetoId: row.projeto_id,
    papelFinanceiro: row.papel_financeiro?.trim() || "padrao",
    modeloReferencia: row.modelo_referencia?.trim() || getDefaultOpenAIModel(),
    limiteTokensInputMensal: row.limite_tokens_input_mensal ?? null,
    limiteTokensOutputMensal: row.limite_tokens_output_mensal ?? null,
    limiteTokensTotalMensal: row.limite_tokens_total_mensal ?? null,
    limiteCustoMensal: row.limite_custo_mensal ?? null,
    autoBloquear: row.auto_bloquear !== false,
    bloqueado: row.bloqueado === true,
    bloqueadoMotivo: row.bloqueado_motivo?.trim() || null,
    observacoes: row.observacoes?.trim() || null,
  };
}

function buildCurrentMonthWindow(referenceDate = new Date()): BillingWindow {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const endExclusive = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  const endInclusive = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = `${endInclusive.getFullYear()}-${String(endInclusive.getMonth() + 1).padStart(2, "0")}-${String(endInclusive.getDate()).padStart(2, "0")}`;

  return {
    startDate,
    endDate,
    startIso: `${startDate} 00:00:00`,
    endExclusiveIso: `${endExclusive.getFullYear()}-${String(endExclusive.getMonth() + 1).padStart(2, "0")}-${String(endExclusive.getDate()).padStart(2, "0")} 00:00:00`,
    label: start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };
}

function normalizeTotals(row?: ConsumoAggregateRow | null): BillingUsageTotals {
  const tokensInput = row?.tokens_input ?? 0;
  const tokensOutput = row?.tokens_output ?? 0;
  const custoTotal = Number(row?.custo_total ?? 0);

  return {
    tokensInput,
    tokensOutput,
    totalTokens: tokensInput + tokensOutput,
    custoTotal,
  };
}

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

export async function getProjetoPlanoBilling(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos_planos")
    .select("id, projeto_id, nome_plano, modelo_referencia, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal, auto_bloquear, bloqueado, bloqueado_motivo, observacoes")
    .eq("projeto_id", projetoId)
    .maybeSingle();

  if (error) {
    console.error("[billing] failed to load project plan", error);
    return null;
  }

  return data ? mapProjetoPlano(data as ProjetoPlanoRow) : null;
}

export async function ensureProjetoPlanoBilling(projetoId: string) {
  const current = await getProjetoPlanoBilling(projetoId);
  if (current) {
    return current;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos_planos")
    .insert(({
      projeto_id: projetoId,
      nome_plano: "padrao",
      modelo_referencia: getDefaultOpenAIModel(),
      auto_bloquear: true,
      bloqueado: false,
    }) as never)
    .select("id, projeto_id, nome_plano, modelo_referencia, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal, auto_bloquear, bloqueado, bloqueado_motivo, observacoes")
    .single();

  if (error) {
    console.error("[billing] failed to ensure project plan", error);
    return null;
  }

  return mapProjetoPlano(data as ProjetoPlanoRow);
}

export async function getUsuarioLimiteBilling(usuarioId: string, projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("usuarios_limites_ia")
    .select("id, usuario_id, projeto_id, papel_financeiro, modelo_referencia, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal, auto_bloquear, bloqueado, bloqueado_motivo, observacoes")
    .eq("usuario_id", usuarioId)
    .eq("projeto_id", projetoId)
    .maybeSingle();

  if (error) {
    console.error("[billing] failed to load user usage limit", error);
    return null;
  }

  return data ? mapUsuarioLimite(data as UsuarioLimiteIaRow) : null;
}

export async function getBillingUsageTotals(input: {
  projetoId: string;
  usuarioId?: string | null;
  window?: BillingWindow;
}) {
  const supabase = getSupabaseAdminClient();
  const window = input.window ?? buildCurrentMonthWindow();

  let query = supabase
    .from("consumos")
    .select("tokens_input.sum(), tokens_output.sum(), custo_total.sum()")
    .eq("projeto_id", input.projetoId)
    .gte("created_at", window.startIso)
    .lt("created_at", window.endExclusiveIso);

  if (input.usuarioId) {
    query = query.eq("usuario_id", input.usuarioId);
  }

  const { data, error } = await query.single();

  if (error) {
    console.error("[billing] failed to aggregate usage totals", error);
    return normalizeTotals();
  }

  return normalizeTotals(data as ConsumoAggregateRow | null);
}

export async function getBillingSnapshot(input: {
  projetoId: string;
  usuarioId: string;
  referenceDate?: Date;
}) {
  const window = buildCurrentMonthWindow(input.referenceDate);
  const [projetoPlano, usuarioLimite, consumoProjeto, consumoUsuario] = await Promise.all([
    getProjetoPlanoBilling(input.projetoId),
    getUsuarioLimiteBilling(input.usuarioId, input.projetoId),
    getBillingUsageTotals({ projetoId: input.projetoId, window }),
    getBillingUsageTotals({ projetoId: input.projetoId, usuarioId: input.usuarioId, window }),
  ]);

  return {
    window,
    modeloPadrao: usuarioLimite?.modeloReferencia ?? projetoPlano?.modeloReferencia ?? getDefaultOpenAIModel(),
    projetoPlano,
    usuarioLimite,
    consumoProjeto,
    consumoUsuario,
    limitesEfetivos: {
      tokensInputMensal: usuarioLimite?.limiteTokensInputMensal ?? projetoPlano?.limiteTokensInputMensal ?? null,
      tokensOutputMensal: usuarioLimite?.limiteTokensOutputMensal ?? projetoPlano?.limiteTokensOutputMensal ?? null,
      tokensTotalMensal: usuarioLimite?.limiteTokensTotalMensal ?? projetoPlano?.limiteTokensTotalMensal ?? null,
      custoMensal: usuarioLimite?.limiteCustoMensal ?? projetoPlano?.limiteCustoMensal ?? null,
    },
  } satisfies BillingSnapshot;
}

export async function getProjetoBillingOverview(projetoId: string, referenceDate?: Date) {
  const window = buildCurrentMonthWindow(referenceDate);
  const [plano, consumoAtual] = await Promise.all([
    ensureProjetoPlanoBilling(projetoId),
    getBillingUsageTotals({ projetoId, window }),
  ]);

  if (!plano) {
    return null;
  }

  return {
    window,
    plano,
    consumoAtual,
  } satisfies ProjetoBillingOverview;
}

export async function updateProjetoPlanoBilling(input: {
  projetoId: string;
  nomePlano?: string | null;
  modeloReferencia?: string | null;
  limiteTokensInputMensal?: number | string | null;
  limiteTokensOutputMensal?: number | string | null;
  limiteTokensTotalMensal?: number | string | null;
  limiteCustoMensal?: number | string | null;
  autoBloquear?: boolean | null;
  bloqueado?: boolean | null;
  bloqueadoMotivo?: string | null;
  observacoes?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const payload = {
    projeto_id: input.projetoId,
    nome_plano: input.nomePlano?.trim() || "padrao",
    modelo_referencia: resolvePricingModel(input.modeloReferencia),
    limite_tokens_input_mensal: normalizeNullableInteger(input.limiteTokensInputMensal),
    limite_tokens_output_mensal: normalizeNullableInteger(input.limiteTokensOutputMensal),
    limite_tokens_total_mensal: normalizeNullableInteger(input.limiteTokensTotalMensal),
    limite_custo_mensal: normalizeNullableDecimal(input.limiteCustoMensal),
    auto_bloquear: input.autoBloquear !== false,
    bloqueado: input.bloqueado === true,
    bloqueado_motivo: input.bloqueadoMotivo?.trim() || null,
    observacoes: input.observacoes?.trim() || null,
  };

  const { data, error } = await supabase
    .from("projetos_planos")
    .upsert(payload as never, { onConflict: "projeto_id" })
    .select("id, projeto_id, nome_plano, modelo_referencia, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal, auto_bloquear, bloqueado, bloqueado_motivo, observacoes")
    .single();

  if (error) {
    console.error("[billing] failed to update project plan", error);
    return null;
  }

  return mapProjetoPlano(data as ProjetoPlanoRow);
}

function buildDecision(code: BillingDecisionCode, snapshot: BillingSnapshot, message: string | null): BillingDecision {
  return {
    allowed: code === "allowed",
    code,
    message,
    snapshot,
  };
}

export async function evaluateBillingAccess(input: {
  projetoId: string;
  usuarioId: string;
  referenceDate?: Date;
}) {
  const snapshot = await getBillingSnapshot(input);

  if (snapshot.projetoPlano?.bloqueado) {
    return buildDecision(
      "project_manually_blocked",
      snapshot,
      snapshot.projetoPlano.bloqueadoMotivo || "Projeto bloqueado manualmente para consumo de IA.",
    );
  }

  if (snapshot.usuarioLimite?.bloqueado) {
    return buildDecision(
      "user_manually_blocked",
      snapshot,
      snapshot.usuarioLimite.bloqueadoMotivo || "Usuario bloqueado manualmente para consumo de IA.",
    );
  }

  if (snapshot.projetoPlano?.autoBloquear) {
    if (snapshot.projetoPlano.limiteTokensInputMensal !== null && snapshot.consumoProjeto.tokensInput >= snapshot.projetoPlano.limiteTokensInputMensal) {
      return buildDecision("project_tokens_input_limit_reached", snapshot, "Projeto atingiu o limite mensal de tokens de entrada.");
    }

    if (snapshot.projetoPlano.limiteTokensOutputMensal !== null && snapshot.consumoProjeto.tokensOutput >= snapshot.projetoPlano.limiteTokensOutputMensal) {
      return buildDecision("project_tokens_output_limit_reached", snapshot, "Projeto atingiu o limite mensal de tokens de saida.");
    }

    if (snapshot.projetoPlano.limiteTokensTotalMensal !== null && snapshot.consumoProjeto.totalTokens >= snapshot.projetoPlano.limiteTokensTotalMensal) {
      return buildDecision("project_tokens_total_limit_reached", snapshot, "Projeto atingiu o limite mensal total de tokens.");
    }

    if (snapshot.projetoPlano.limiteCustoMensal !== null && snapshot.consumoProjeto.custoTotal >= snapshot.projetoPlano.limiteCustoMensal) {
      return buildDecision("project_cost_limit_reached", snapshot, "Projeto atingiu o limite mensal de custo.");
    }
  }

  if (snapshot.usuarioLimite?.autoBloquear) {
    if (snapshot.usuarioLimite.limiteTokensInputMensal !== null && snapshot.consumoUsuario.tokensInput >= snapshot.usuarioLimite.limiteTokensInputMensal) {
      return buildDecision("user_tokens_input_limit_reached", snapshot, "Usuario atingiu o limite mensal de tokens de entrada.");
    }

    if (snapshot.usuarioLimite.limiteTokensOutputMensal !== null && snapshot.consumoUsuario.tokensOutput >= snapshot.usuarioLimite.limiteTokensOutputMensal) {
      return buildDecision("user_tokens_output_limit_reached", snapshot, "Usuario atingiu o limite mensal de tokens de saida.");
    }

    if (snapshot.usuarioLimite.limiteTokensTotalMensal !== null && snapshot.consumoUsuario.totalTokens >= snapshot.usuarioLimite.limiteTokensTotalMensal) {
      return buildDecision("user_tokens_total_limit_reached", snapshot, "Usuario atingiu o limite mensal total de tokens.");
    }

    if (snapshot.usuarioLimite.limiteCustoMensal !== null && snapshot.consumoUsuario.custoTotal >= snapshot.usuarioLimite.limiteCustoMensal) {
      return buildDecision("user_cost_limit_reached", snapshot, "Usuario atingiu o limite mensal de custo.");
    }
  }

  return buildDecision("allowed", snapshot, null);
}
