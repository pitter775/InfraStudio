import "server-only";

import { getBillingPlanCatalogById } from "@/lib/billing-plan-catalog";
import { appendSystemLog } from "@/lib/chat-logs";
import { getDefaultOpenAIModel, resolvePricingModel } from "@/lib/openai-pricing";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type BillingMode = "plano" | "manual" | "ilimitado";

type ProjetoRow = {
  id: string;
  nome: string | null;
  modo_cobranca: BillingMode | null;
};

type PlanoRow = {
  id: string;
  nome: string | null;
  preco_mensal: number | null;
  limite_tokens_total_mensal: number | null;
  limite_custo_mensal: number | null;
  ativo: boolean | null;
  permitir_excedente: boolean | null;
  custo_token_excedente: number | null;
};

type ProjetoPlanoRow = {
  id: string;
  projeto_id: string;
  plano_id?: string | null;
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
  permitir_excedente?: boolean | null;
  custo_token_excedente?: number | null;
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

type ProjetoCicloUsoRow = {
  id: string;
  projeto_id: string;
  data_inicio: string | null;
  data_fim: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  custo_total: number | null;
  fechado: boolean | null;
  created_at: string | null;
  limite_tokens_total: number | null;
  custo_token_excedente: number | null;
  permitir_excedente: boolean | null;
  alerta_80: boolean | null;
  alerta_100: boolean | null;
  bloqueado: boolean | null;
  excedente_tokens: number | null;
  excedente_custo: number | null;
  plano_id: string | null;
};

type ConsumoAggregateRow = {
  projeto_id?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  custo_total?: number | null;
};

type TokenAvulsoRow = {
  id: string;
  projeto_id: string;
  tokens: number | null;
  utilizado: boolean | null;
  created_at: string | null;
};

export type BillingWindow = {
  startDate: string;
  endDate: string;
  startIso: string;
  endExclusiveIso: string;
  label: string;
};

export type BillingUsageTotals = {
  tokensInput: number;
  tokensOutput: number;
  totalTokens: number;
  custoTotal: number;
};

export type ProjetoPlanoBilling = {
  id: string;
  projetoId: string;
  planoId: string | null;
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
  permitirExcedente: boolean;
  custoTokenExcedente: number;
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

export type PlanoBillingRecord = {
  id: string;
  nome: string;
  precoMensal: number;
  limiteTokensTotalMensal: number | null;
  limiteCustoMensal: number | null;
  ativo: boolean;
  permitirExcedente: boolean;
  custoTokenExcedente: number;
};

export type ProjetoCicloUso = {
  id: string;
  projetoId: string;
  dataInicio: string;
  dataFim: string;
  fechado: boolean;
  createdAt: string;
  totals: BillingUsageTotals;
  limiteTokensTotal: number | null;
  custoTokenExcedente: number;
  permitirExcedente: boolean;
  alerta80: boolean;
  alerta100: boolean;
  bloqueado: boolean;
  excedenteTokens: number;
  excedenteCusto: number;
  planoId: string | null;
};

export type BillingProjectPlan = {
  projetoId: string;
  projetoNome: string;
  modoCobranca: BillingMode;
  plano: ProjetoPlanoBilling;
  cicloAtual: ProjetoCicloUso | null;
  consumoAtual: BillingUsageTotals & { source: "ciclo" | "consumos" };
};

export type BillingUsageByProject = BillingProjectPlan & {
  percentualTokens: number | null;
  percentualCusto: number | null;
  percentualUso: number | null;
  status: "ativo" | "bloqueado";
};

export type BillingUsageCalculation = {
  usoAtualTokens: number;
  limiteTokens: number | null;
  percentualTokens: number | null;
  usoAtualCusto: number;
  limiteCusto: number | null;
  percentualCusto: number | null;
  percentualUso: number | null;
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
  modoCobranca: BillingMode;
  plano: ProjetoPlanoBilling;
  cicloAtual: ProjetoCicloUso | null;
  consumoAtual: BillingUsageTotals & { source: "ciclo" | "consumos" };
};

export type BillingDecisionCode =
  | "allowed"
  | "project_manually_blocked"
  | "project_tokens_input_limit_reached"
  | "project_tokens_output_limit_reached"
  | "project_tokens_total_limit_reached"
  | "project_cost_limit_reached"
  | "unlimited_mode";

export type BillingDecision = {
  allowed: boolean;
  code: BillingDecisionCode;
  message: string | null;
  snapshot: BillingSnapshot;
};

const PROJETO_PLANO_SELECT_CORE =
  "id, projeto_id, nome_plano, modelo_referencia, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal, auto_bloquear, bloqueado, bloqueado_motivo, observacoes";
const PROJETO_PLANO_SELECT_WITH_PLAN_ID = `${PROJETO_PLANO_SELECT_CORE}, plano_id`;
const PROJETO_PLANO_SELECT_WITH_OVERAGE = `${PROJETO_PLANO_SELECT_WITH_PLAN_ID}, permitir_excedente, custo_token_excedente`;

function isProjetoPlanoOptionalColumnError(error: { message?: string | null; details?: string | null; hint?: string | null } | null | undefined) {
  const source = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
  return source.includes("permitir_excedente") || source.includes("custo_token_excedente") || source.includes("plano_id");
}

async function selectProjetoPlanoCompat(
  buildQuery: (selectClause: string) => {
    maybeSingle?: () => unknown;
    single?: () => unknown;
  },
  mode: "single" | "maybeSingle",
) {
  const execute = async (selectClause: string) => {
    const query = buildQuery(selectClause);
    return (mode === "single" ? await query.single!() : await query.maybeSingle!()) as {
      data: unknown;
      error: unknown;
    };
  };

  let response = await execute(PROJETO_PLANO_SELECT_WITH_OVERAGE);
  if (response.error && isProjetoPlanoOptionalColumnError(response.error as { message?: string | null; details?: string | null; hint?: string | null })) {
    response = await execute(PROJETO_PLANO_SELECT_CORE);
  }

  return response;
}

async function selectProjetoPlanosCompat(buildQuery: (selectClause: string) => unknown) {
  let response = (await buildQuery(PROJETO_PLANO_SELECT_WITH_OVERAGE)) as {
    data: unknown;
    error: unknown;
  };
  if (response.error && isProjetoPlanoOptionalColumnError(response.error as { message?: string | null; details?: string | null; hint?: string | null })) {
    response = (await buildQuery(PROJETO_PLANO_SELECT_CORE)) as {
      data: unknown;
      error: unknown;
    };
  }

  return response;
}

function mapProjetoPlano(row: ProjetoPlanoRow): ProjetoPlanoBilling {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    planoId: row.plano_id ?? null,
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
    permitirExcedente: row.permitir_excedente === true,
    custoTokenExcedente: Number(row.custo_token_excedente ?? 0),
  };
}

async function appendBillingFailureLog(input: {
  projetoId?: string | null;
  etapa: string;
  error: unknown;
  payload?: Record<string, unknown> | null;
}) {
  const details =
    typeof input.error === "object" && input.error !== null
      ? (input.error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown })
      : null;

  await appendSystemLog({
    projetoId: input.projetoId ?? null,
    tipo: "billing_error",
    origem: "lib_billing",
    descricao: `Falha no billing em ${input.etapa}.`,
    payload: {
      etapa: input.etapa,
      code: details?.code ?? null,
      message: details?.message ?? (input.error instanceof Error ? input.error.message : String(input.error)),
      details: details?.details ?? null,
      hint: details?.hint ?? null,
      ...input.payload,
    },
  });
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

function mapPlano(row: PlanoRow): PlanoBillingRecord {
  return {
    id: row.id,
    nome: row.nome?.trim() || "Plano sem nome",
    precoMensal: Number(row.preco_mensal ?? 0),
    limiteTokensTotalMensal: row.limite_tokens_total_mensal ?? null,
    limiteCustoMensal: row.limite_custo_mensal ?? null,
    ativo: row.ativo !== false,
    permitirExcedente: row.permitir_excedente === true,
    custoTokenExcedente: Number(row.custo_token_excedente ?? 0),
  };
}

function mapCycle(row: ProjetoCicloUsoRow): ProjetoCicloUso {
  const tokensInput = row.tokens_input ?? 0;
  const tokensOutput = row.tokens_output ?? 0;

  return {
    id: row.id,
    projetoId: row.projeto_id,
    dataInicio: row.data_inicio ?? new Date().toISOString(),
    dataFim: row.data_fim ?? new Date().toISOString(),
    fechado: row.fechado === true,
    createdAt: row.created_at ?? new Date().toISOString(),
    totals: {
      tokensInput,
      tokensOutput,
      totalTokens: tokensInput + tokensOutput,
      custoTotal: Number(row.custo_total ?? 0),
    },
    limiteTokensTotal: row.limite_tokens_total ?? null,
    custoTokenExcedente: Number(row.custo_token_excedente ?? 0),
    permitirExcedente: row.permitir_excedente === true,
    alerta80: row.alerta_80 === true,
    alerta100: row.alerta_100 === true,
    bloqueado: row.bloqueado === true,
    excedenteTokens: Math.max(0, row.excedente_tokens ?? 0),
    excedenteCusto: Number(row.excedente_custo ?? 0),
    planoId: row.plano_id ?? null,
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

function buildDecision(code: BillingDecisionCode, snapshot: BillingSnapshot, message: string | null): BillingDecision {
  return {
    allowed: code === "allowed" || code === "unlimited_mode",
    code,
    message,
    snapshot,
  };
}

function clampPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(Number(value.toFixed(2)), 100));
}

function computePercent(used: number, limit: number | null) {
  if (limit === null || limit <= 0) {
    return null;
  }

  return clampPercent((used / limit) * 100);
}

function splitUsageTokens(totalTokens: number, tokensInput: number, tokensOutput: number) {
  if (totalTokens <= 0) {
    return {
      tokensInput: 0,
      tokensOutput: 0,
    };
  }

  const normalizedInput = Math.max(0, tokensInput);
  const normalizedOutput = Math.max(0, tokensOutput);
  const baseTotal = normalizedInput + normalizedOutput;
  if (baseTotal <= 0) {
    return {
      tokensInput: 0,
      tokensOutput: totalTokens,
    };
  }

  const nextInput = Math.min(totalTokens, Math.round((normalizedInput / baseTotal) * totalTokens));
  return {
    tokensInput: nextInput,
    tokensOutput: Math.max(0, totalTokens - nextInput),
  };
}

async function consumirTokensAvulsos(projetoId: string, tokensNecessarios: number) {
  const supabase = getSupabaseAdminClient();
  const totalNecessario = Math.max(0, Math.round(tokensNecessarios));
  if (totalNecessario <= 0) {
    return 0;
  }

  const { data, error } = await supabase
    .from("tokens_avulsos")
    .select("id, projeto_id, tokens, utilizado, created_at")
    .eq("projeto_id", projetoId)
    .eq("utilizado", false)
    .gt("tokens", 0)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[billing] failed to load extra tokens", error);
    return 0;
  }

  let consumidos = 0;
  for (const row of (data ?? []) as TokenAvulsoRow[]) {
    const saldoAtual = Math.max(0, row.tokens ?? 0);
    if (saldoAtual <= 0 || consumidos >= totalNecessario) {
      continue;
    }

    const desconto = Math.min(saldoAtual, totalNecessario - consumidos);
    const proximoSaldo = saldoAtual - desconto;
    const { error: updateError } = await supabase
      .from("tokens_avulsos")
      .update({
        tokens: proximoSaldo,
        utilizado: proximoSaldo <= 0,
      } as never)
      .eq("id", row.id);

    if (updateError) {
      console.error("[billing] failed to consume extra tokens", updateError);
      continue;
    }

    consumidos += desconto;
  }

  return consumidos;
}

async function atualizarAlertasCiclo(input: {
  cycle: ProjetoCicloUso;
  totalTokens: number;
}) {
  if (input.cycle.limiteTokensTotal === null || input.cycle.limiteTokensTotal <= 0) {
    return;
  }

  const percentualTokens = computePercent(input.totalTokens, input.cycle.limiteTokensTotal);
  if (percentualTokens === null) {
    return;
  }

  const patch: Record<string, boolean> = {};
  if (!input.cycle.alerta80 && percentualTokens >= 80) {
    patch.alerta_80 = true;
  }
  if (!input.cycle.alerta100 && percentualTokens >= 100) {
    patch.alerta_100 = true;
  }

  if (!Object.keys(patch).length) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("projetos_ciclos_uso").update(patch as never).eq("id", input.cycle.id);
  if (error) {
    console.error("[billing] failed to update cycle alerts", error);
  }
}

async function atualizarBloqueioCiclo(input: {
  cycle: ProjetoCicloUso;
  totalTokens: number;
}) {
  if (input.cycle.bloqueado || input.cycle.permitirExcedente) {
    return;
  }

  if (input.cycle.limiteTokensTotal === null || input.cycle.limiteTokensTotal <= 0) {
    return;
  }

  if (input.totalTokens < input.cycle.limiteTokensTotal) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("projetos_ciclos_uso")
    .update({
      bloqueado: true,
    } as never)
    .eq("id", input.cycle.id);

  if (error) {
    console.error("[billing] failed to update cycle block", error);
  }
}

async function atualizarExcedenteCiclo(input: {
  cycle: ProjetoCicloUso;
  totalTokens: number;
}) {
  if (!input.cycle.permitirExcedente) {
    return;
  }

  const limite = input.cycle.limiteTokensTotal;
  const excedenteTokens = limite === null || limite <= 0 ? 0 : Math.max(0, input.totalTokens - limite);
  const excedenteCusto = Number((excedenteTokens * input.cycle.custoTokenExcedente).toFixed(6));

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("projetos_ciclos_uso")
    .update({
      bloqueado: false,
      excedente_tokens: excedenteTokens,
      excedente_custo: excedenteCusto,
    } as never)
    .eq("id", input.cycle.id);

  if (error) {
    console.error("[billing] failed to update cycle overage", error);
  }
}

export function calculateBillingUsage(input: {
  consumoAtual: BillingUsageTotals;
  plano: Pick<ProjetoPlanoBilling, "limiteTokensTotalMensal" | "limiteCustoMensal">;
}): BillingUsageCalculation {
  const percentualTokens = computePercent(input.consumoAtual.totalTokens, input.plano.limiteTokensTotalMensal);
  const percentualCusto = computePercent(input.consumoAtual.custoTotal, input.plano.limiteCustoMensal);

  return {
    usoAtualTokens: input.consumoAtual.totalTokens,
    limiteTokens: input.plano.limiteTokensTotalMensal,
    percentualTokens,
    usoAtualCusto: input.consumoAtual.custoTotal,
    limiteCusto: input.plano.limiteCustoMensal,
    percentualCusto,
    percentualUso: clampPercent(Math.max(percentualTokens ?? 0, percentualCusto ?? 0)),
  };
}

export function buildCurrentMonthWindow(referenceDate = new Date()): BillingWindow {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const endExclusive = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  const endInclusive = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const endDate = `${endInclusive.getFullYear()}-${String(endInclusive.getMonth() + 1).padStart(2, "0")}-${String(endInclusive.getDate()).padStart(2, "0")}`;

  return {
    startDate,
    endDate,
    startIso: `${startDate} 00:00:00`,
    endExclusiveIso: `${endExclusive.getFullYear()}-${String(endExclusive.getMonth() + 1).padStart(2, "0")}-${String(endExclusive.getDate()).padStart(2, "0")} 00:00:00`,
    label: start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };
}

function buildMonthlyCycleBounds(referenceDate = new Date()) {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const endExclusive = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  const endInclusive = new Date(endExclusive.getTime() - 1000);

  return {
    startIso: start.toISOString(),
    endIso: endInclusive.toISOString(),
  };
}

async function getProjetoRowById(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos")
    .select("id, nome, modo_cobranca")
    .eq("id", projetoId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[billing] failed to load project", error);
    }
    return null;
  }

  return data as ProjetoRow;
}

export async function getProjetoBillingMode(projetoId: string): Promise<BillingMode> {
  const projeto = await getProjetoRowById(projetoId);
  return projeto?.modo_cobranca ?? "plano";
}

async function listProjetosBillingBase(projetoIds?: string[]) {
  const supabase = getSupabaseAdminClient();
  let projetosQuery = supabase
    .from("projetos")
    .select("id, nome, modo_cobranca")
    .order("nome", { ascending: true });

  if (projetoIds?.length) {
    projetosQuery = projetosQuery.in("id", projetoIds);
  }

  const { data: projetosData, error: projetosError } = await projetosQuery;
  if (projetosError || !projetosData) {
    console.error("[billing] failed to list billing projects", projetosError);
    return {
      projetos: [] as ProjetoRow[],
      snapshots: new Map<string, ProjetoPlanoBilling>(),
      ciclos: new Map<string, ProjetoCicloUso>(),
      fallbackUsage: new Map<string, BillingUsageTotals>(),
    };
  }

  const projetos = projetosData as ProjetoRow[];
  if (!projetos.length) {
    return {
      projetos,
      snapshots: new Map<string, ProjetoPlanoBilling>(),
      ciclos: new Map<string, ProjetoCicloUso>(),
      fallbackUsage: new Map<string, BillingUsageTotals>(),
    };
  }

  const ids = projetos.map((item) => item.id);
  const window = buildCurrentMonthWindow();
  const snapshotsResponse = await selectProjetoPlanosCompat((selectClause) =>
    supabase.from("projetos_planos").select(selectClause).in("projeto_id", ids),
  );

  const [ciclosResponse, consumosResponse] = await Promise.all([
    supabase
      .from("projetos_ciclos_uso")
      .select("id, projeto_id, data_inicio, data_fim, tokens_input, tokens_output, custo_total, fechado, created_at, limite_tokens_total, custo_token_excedente, permitir_excedente, alerta_80, alerta_100, bloqueado, excedente_tokens, excedente_custo, plano_id")
      .in("projeto_id", ids)
      .eq("fechado", false)
      .order("data_inicio", { ascending: false }),
    supabase
      .from("consumos")
      .select("projeto_id, tokens_input, tokens_output, custo_total")
      .in("projeto_id", ids)
      .gte("created_at", window.startIso)
      .lt("created_at", window.endExclusiveIso),
  ]);

  const snapshots = new Map<string, ProjetoPlanoBilling>();
  for (const row of (snapshotsResponse.data ?? []) as ProjetoPlanoRow[]) {
    snapshots.set(row.projeto_id, mapProjetoPlano(row));
  }

  const ciclos = new Map<string, ProjetoCicloUso>();
  for (const row of (ciclosResponse.data ?? []) as ProjetoCicloUsoRow[]) {
    if (!ciclos.has(row.projeto_id)) {
      ciclos.set(row.projeto_id, mapCycle(row));
    }
  }

  const fallbackUsage = new Map<string, BillingUsageTotals>();
  for (const row of (consumosResponse.data ?? []) as ConsumoAggregateRow[]) {
    const projetoId = row.projeto_id ?? "";
    if (!projetoId) {
      continue;
    }

    const current = fallbackUsage.get(projetoId) ?? normalizeTotals();
    current.tokensInput += row.tokens_input ?? 0;
    current.tokensOutput += row.tokens_output ?? 0;
    current.totalTokens = current.tokensInput + current.tokensOutput;
    current.custoTotal += Number(row.custo_total ?? 0);
    fallbackUsage.set(projetoId, current);
  }

  return { projetos, snapshots, ciclos, fallbackUsage };
}

export async function getProjetoPlanoBilling(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await selectProjetoPlanoCompat(
    (selectClause) => supabase.from("projetos_planos").select(selectClause).eq("projeto_id", projetoId),
    "maybeSingle",
  );

  if (error) {
    console.error("[billing] failed to load project snapshot", error);
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
  const insertPayload = {
    projeto_id: projetoId,
    plano_id: null,
    nome_plano: "padrao",
    modelo_referencia: getDefaultOpenAIModel(),
    auto_bloquear: true,
    bloqueado: false,
  };
  const { error: insertError } = await supabase.from("projetos_planos").insert(insertPayload as never);

  if (insertError) {
    console.error("[billing] failed to ensure project snapshot", insertError);
    await appendBillingFailureLog({
      projetoId,
      etapa: "ensure_projeto_plano_insert",
      error: insertError,
      payload: {
        hasPlanoIdColumn: "plano_id" in insertPayload,
      },
    });
    return null;
  }

  const { data, error } = await selectProjetoPlanoCompat(
    (selectClause) => supabase.from("projetos_planos").select(selectClause).eq("projeto_id", projetoId),
    "single",
  );

  if (error || !data) {
    console.error("[billing] failed to ensure project snapshot", error);
    await appendBillingFailureLog({
      projetoId,
      etapa: "ensure_projeto_plano_select",
      error: error ?? new Error("Projeto plano nao retornado apos insert."),
    });
    return null;
  }

  return mapProjetoPlano(data as ProjetoPlanoRow);
}

export async function updateProjetoPlanoBilling(input: {
  projetoId: string;
  planoId?: string | null;
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
  permitirExcedente?: boolean | null;
  custoTokenExcedente?: number | string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const current = await getProjetoPlanoBilling(input.projetoId);
  const payload = {
    projeto_id: input.projetoId,
    plano_id: input.planoId === undefined ? current?.planoId ?? null : input.planoId,
    nome_plano: input.nomePlano === undefined ? current?.nomePlano ?? "padrao" : input.nomePlano?.trim() || "padrao",
    modelo_referencia:
      input.modeloReferencia === undefined
        ? current?.modeloReferencia ?? getDefaultOpenAIModel()
        : resolvePricingModel(input.modeloReferencia),
    limite_tokens_input_mensal:
      input.limiteTokensInputMensal === undefined
        ? current?.limiteTokensInputMensal ?? null
        : normalizeNullableInteger(input.limiteTokensInputMensal),
    limite_tokens_output_mensal:
      input.limiteTokensOutputMensal === undefined
        ? current?.limiteTokensOutputMensal ?? null
        : normalizeNullableInteger(input.limiteTokensOutputMensal),
    limite_tokens_total_mensal:
      input.limiteTokensTotalMensal === undefined
        ? current?.limiteTokensTotalMensal ?? null
        : normalizeNullableInteger(input.limiteTokensTotalMensal),
    limite_custo_mensal:
      input.limiteCustoMensal === undefined
        ? current?.limiteCustoMensal ?? null
        : normalizeNullableDecimal(input.limiteCustoMensal),
    auto_bloquear: input.autoBloquear === undefined ? current?.autoBloquear !== false : input.autoBloquear !== false,
    bloqueado: input.bloqueado === undefined ? current?.bloqueado === true : input.bloqueado === true,
    bloqueado_motivo:
      input.bloqueadoMotivo === undefined ? current?.bloqueadoMotivo ?? null : input.bloqueadoMotivo?.trim() || null,
    observacoes: input.observacoes === undefined ? current?.observacoes ?? null : input.observacoes?.trim() || null,
    permitir_excedente:
      input.permitirExcedente === undefined ? current?.permitirExcedente === true : input.permitirExcedente === true,
    custo_token_excedente:
      input.custoTokenExcedente === undefined
        ? current?.custoTokenExcedente ?? 0
        : normalizeNullableDecimal(input.custoTokenExcedente) ?? 0,
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from("projetos_planos")
    .upsert(payload as never, { onConflict: "projeto_id" })
    .select(PROJETO_PLANO_SELECT_WITH_OVERAGE)
    .single();

  if (error && isProjetoPlanoOptionalColumnError(error)) {
    const {
      permitir_excedente: _permitirExcedente,
      custo_token_excedente: _custoTokenExcedente,
      plano_id: _planoId,
      ...legacyPayload
    } = payload;
    const fallbackResponse = await supabase
      .from("projetos_planos")
      .upsert(legacyPayload as never, { onConflict: "projeto_id" })
      .select(PROJETO_PLANO_SELECT_CORE)
      .single();
    data = fallbackResponse.data;
    error = fallbackResponse.error;
  }

  if (error || !data) {
    console.error("[billing] failed to update project snapshot", error);
    await appendBillingFailureLog({
      projetoId: input.projetoId,
      etapa: "update_projeto_plano_snapshot",
      error: error ?? new Error("Projeto plano nao retornado apos upsert."),
      payload: {
        planoId: input.planoId ?? null,
        nomePlano: input.nomePlano ?? null,
        modoCompat: Boolean(error && isProjetoPlanoOptionalColumnError(error)),
      },
    });
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
    console.error("[billing] failed to load user limit", error);
    return null;
  }

  return data ? mapUsuarioLimite(data as UsuarioLimiteIaRow) : null;
}

export async function getCicloAtual(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos_ciclos_uso")
    .select("id, projeto_id, data_inicio, data_fim, tokens_input, tokens_output, custo_total, fechado, created_at, limite_tokens_total, custo_token_excedente, permitir_excedente, alerta_80, alerta_100, bloqueado, excedente_tokens, excedente_custo, plano_id")
    .eq("projeto_id", projetoId)
    .eq("fechado", false)
    .order("data_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[billing] failed to load current usage cycle", error);
    return null;
  }

  return data ? mapCycle(data as ProjetoCicloUsoRow) : null;
}

export async function createProjetoUsageCycle(input: {
  projetoId: string;
  startDate?: Date;
  closeExisting?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const startDate = input.startDate ?? new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setSeconds(endDate.getSeconds() - 1);

  if (input.closeExisting !== false) {
    const { error: closeError } = await supabase
      .from("projetos_ciclos_uso")
      .update({ fechado: true } as never)
      .eq("projeto_id", input.projetoId)
      .eq("fechado", false);

    if (closeError) {
      console.error("[billing] failed to close previous usage cycles", closeError);
    }
  }

  const snapshot = await ensureProjetoPlanoBilling(input.projetoId);

  const { data, error } = await supabase
    .from("projetos_ciclos_uso")
    .insert(({
      projeto_id: input.projetoId,
      data_inicio: startDate.toISOString(),
      data_fim: endDate.toISOString(),
      tokens_input: 0,
      tokens_output: 0,
      custo_total: 0,
      fechado: false,
      limite_tokens_total: snapshot?.limiteTokensTotalMensal ?? null,
      custo_token_excedente: snapshot?.custoTokenExcedente ?? 0,
      permitir_excedente: snapshot?.permitirExcedente === true,
      alerta_80: false,
      alerta_100: false,
      bloqueado: false,
      excedente_tokens: 0,
      excedente_custo: 0,
      plano_id: snapshot?.planoId ?? null,
      created_at: new Date().toISOString(),
    }) as never)
    .select("id, projeto_id, data_inicio, data_fim, tokens_input, tokens_output, custo_total, fechado, created_at, limite_tokens_total, custo_token_excedente, permitir_excedente, alerta_80, alerta_100, bloqueado, excedente_tokens, excedente_custo, plano_id")
    .single();

  if (error || !data) {
    console.error("[billing] failed to create usage cycle", error);
    return null;
  }

  return mapCycle(data as ProjetoCicloUsoRow);
}

export async function syncProjetoUsageCycleWithSnapshot(projetoId: string, snapshot?: ProjetoPlanoBilling | null) {
  const cycle = await getCicloAtual(projetoId);
  if (!cycle) {
    return null;
  }

  const currentSnapshot = snapshot ?? (await getProjetoPlanoBilling(projetoId));
  if (!currentSnapshot) {
    return cycle;
  }

  const totalTokens = cycle.totals.totalTokens;
  const limiteTokensTotal = currentSnapshot.limiteTokensTotalMensal;
  const permitirExcedente = currentSnapshot.permitirExcedente === true;
  const custoTokenExcedente = currentSnapshot.custoTokenExcedente ?? 0;
  const excedenteTokens =
    permitirExcedente && limiteTokensTotal !== null && limiteTokensTotal > 0 ? Math.max(0, totalTokens - limiteTokensTotal) : 0;
  const excedenteCusto = Number((excedenteTokens * custoTokenExcedente).toFixed(6));
  const alerta80 = limiteTokensTotal !== null && limiteTokensTotal > 0 ? totalTokens / limiteTokensTotal >= 0.8 : false;
  const alerta100 = limiteTokensTotal !== null && limiteTokensTotal > 0 ? totalTokens / limiteTokensTotal >= 1 : false;
  const bloqueado = permitirExcedente
    ? false
    : limiteTokensTotal !== null && limiteTokensTotal > 0
      ? totalTokens >= limiteTokensTotal
      : false;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos_ciclos_uso")
    .update({
      limite_tokens_total: limiteTokensTotal,
      custo_token_excedente: custoTokenExcedente,
      permitir_excedente: permitirExcedente,
      alerta_80: alerta80,
      alerta_100: alerta100,
      bloqueado,
      excedente_tokens: excedenteTokens,
      excedente_custo: excedenteCusto,
      plano_id: currentSnapshot.planoId ?? null,
    } as never)
    .eq("id", cycle.id)
    .select("id, projeto_id, data_inicio, data_fim, tokens_input, tokens_output, custo_total, fechado, created_at, limite_tokens_total, custo_token_excedente, permitir_excedente, alerta_80, alerta_100, bloqueado, excedente_tokens, excedente_custo, plano_id")
    .single();

  if (error || !data) {
    console.error("[billing] failed to sync usage cycle with snapshot", error);
    return cycle;
  }

  return mapCycle(data as ProjetoCicloUsoRow);
}

export async function ensureProjetoUsageCycle(projetoId: string, referenceDate = new Date()) {
  const current = await getCicloAtual(projetoId);
  if (current) {
    const currentEnd = new Date(current.dataFim);
    if (currentEnd.getTime() >= referenceDate.getTime()) {
      return current;
    }
  }

  const bounds = buildMonthlyCycleBounds(referenceDate);
  return createProjetoUsageCycle({
    projetoId,
    startDate: new Date(bounds.startIso),
    closeExisting: true,
  });
}

export async function syncProjetoPlanoSnapshotFromPlan(input: {
  projetoId: string;
  planoId?: string | null;
  plano?: PlanoBillingRecord | null;
  clearBlock?: boolean;
}) {
  let plano = input.plano ?? null;

  if (!plano && input.planoId) {
    plano = await getBillingPlanCatalogById(input.planoId);

    if (!plano) {
      console.error("[billing] failed to load plan for snapshot sync");
      return null;
    }
  }

  if (!plano) {
    return null;
  }

  return updateProjetoPlanoBilling({
    projetoId: input.projetoId,
    planoId: plano.id,
    nomePlano: plano.nome,
    limiteTokensTotalMensal: plano.limiteTokensTotalMensal,
    limiteCustoMensal: plano.limiteCustoMensal,
    permitirExcedente: plano.permitirExcedente,
    custoTokenExcedente: plano.custoTokenExcedente,
    autoBloquear: true,
    bloqueado: input.clearBlock ? false : undefined,
    bloqueadoMotivo: input.clearBlock ? null : undefined,
  });
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

export async function getPlanoProjeto(projetoId: string): Promise<BillingProjectPlan | null> {
  const [projeto, snapshot, cicloAtual] = await Promise.all([
    getProjetoRowById(projetoId),
    ensureProjetoPlanoBilling(projetoId),
    getCicloAtual(projetoId),
  ]);

  if (!projeto || !snapshot) {
    return null;
  }

  const fallbackConsumo = await getBillingUsageTotals({ projetoId });
  const modoCobranca = projeto.modo_cobranca ?? "plano";

  const plano: ProjetoPlanoBilling =
    modoCobranca === "ilimitado"
        ? {
            ...snapshot,
            nomePlano: "Ilimitado",
            limiteTokensInputMensal: null,
            limiteTokensOutputMensal: null,
            limiteTokensTotalMensal: null,
            limiteCustoMensal: null,
            bloqueado: false,
            bloqueadoMotivo: null,
            permitirExcedente: true,
            custoTokenExcedente: 0,
          }
        : snapshot;

  return {
    projetoId,
    projetoNome: projeto.nome?.trim() || "Projeto sem nome",
    modoCobranca,
    plano,
    cicloAtual,
    consumoAtual: cicloAtual
      ? { ...cicloAtual.totals, source: "ciclo" }
      : { ...fallbackConsumo, source: "consumos" },
  };
}

export async function getBillingSnapshot(input: {
  projetoId: string;
  usuarioId: string;
  referenceDate?: Date;
}) {
  const window = buildCurrentMonthWindow(input.referenceDate);
  const [projectPlan, usuarioLimite, current] = await Promise.all([
    getPlanoProjeto(input.projetoId),
    getUsuarioLimiteBilling(input.usuarioId, input.projetoId),
    getBillingUsageTotals({ projetoId: input.projetoId, usuarioId: input.usuarioId, window }),
  ]);

  return {
    window,
    modeloPadrao: projectPlan?.plano.modeloReferencia ?? getDefaultOpenAIModel(),
    projetoPlano: projectPlan?.plano ?? null,
    usuarioLimite,
    consumoProjeto: projectPlan?.consumoAtual ?? normalizeTotals(),
    consumoUsuario: current,
    limitesEfetivos: {
      tokensInputMensal: usuarioLimite?.limiteTokensInputMensal ?? projectPlan?.plano.limiteTokensInputMensal ?? null,
      tokensOutputMensal: usuarioLimite?.limiteTokensOutputMensal ?? projectPlan?.plano.limiteTokensOutputMensal ?? null,
      tokensTotalMensal: usuarioLimite?.limiteTokensTotalMensal ?? projectPlan?.plano.limiteTokensTotalMensal ?? null,
      custoMensal: usuarioLimite?.limiteCustoMensal ?? projectPlan?.plano.limiteCustoMensal ?? null,
    },
  } satisfies BillingSnapshot;
}

export async function getProjetoBillingOverview(projetoId: string, referenceDate?: Date) {
  const current = await getPlanoProjeto(projetoId);
  if (!current) {
    return null;
  }

  return {
    window: buildCurrentMonthWindow(referenceDate),
    modoCobranca: current.modoCobranca,
    plano: current.plano,
    cicloAtual: current.cicloAtual,
    consumoAtual: current.consumoAtual,
  } satisfies ProjetoBillingOverview;
}

export async function listBillingUsageByProject(projetoIds?: string[]) {
  const base = await listProjetosBillingBase(projetoIds);

  return base.projetos.map<BillingUsageByProject>((projeto) => {
    const snapshot = base.snapshots.get(projeto.id) ?? {
      id: "",
      projetoId: projeto.id,
      planoId: null,
      nomePlano: "padrao",
      modeloReferencia: getDefaultOpenAIModel(),
      limiteTokensInputMensal: null,
      limiteTokensOutputMensal: null,
      limiteTokensTotalMensal: null,
      limiteCustoMensal: null,
      autoBloquear: true,
      bloqueado: false,
      bloqueadoMotivo: null,
      observacoes: null,
      permitirExcedente: false,
      custoTokenExcedente: 0,
    };
    const cicloAtual = base.ciclos.get(projeto.id) ?? null;
    const fallbackConsumo = base.fallbackUsage.get(projeto.id) ?? normalizeTotals();
    const modoCobranca = projeto.modo_cobranca ?? "plano";
    const plano: ProjetoPlanoBilling =
      modoCobranca === "ilimitado"
        ? {
            ...snapshot,
            planoId: null,
            nomePlano: "Ilimitado",
            limiteTokensInputMensal: null,
            limiteTokensOutputMensal: null,
            limiteTokensTotalMensal: null,
            limiteCustoMensal: null,
            bloqueado: false,
            bloqueadoMotivo: null,
            permitirExcedente: true,
            custoTokenExcedente: 0,
          }
        : snapshot;
    const consumoAtual = cicloAtual
      ? { ...cicloAtual.totals, source: "ciclo" as const }
      : { ...fallbackConsumo, source: "consumos" as const };

    const usageCalculation = calculateBillingUsage({
      consumoAtual,
      plano,
    });

    return {
      projetoId: projeto.id,
      projetoNome: projeto.nome?.trim() || "Projeto sem nome",
      modoCobranca,
      plano,
      cicloAtual,
      consumoAtual,
      percentualTokens: usageCalculation.percentualTokens,
      percentualCusto: usageCalculation.percentualCusto,
      percentualUso: usageCalculation.percentualUso,
      status: modoCobranca === "ilimitado" ? "ativo" : plano.bloqueado ? "bloqueado" : "ativo",
    };
  });
}

export async function registrarUso(
  projetoId: string,
  tokens: number,
  custo: number,
  details?: {
    tokensInput?: number;
    tokensOutput?: number;
    usuarioId?: string | null;
    origem?: string | null;
    referenciaId?: string | null;
  },
) {
  const supabase = getSupabaseAdminClient();
  const cycle = await ensureProjetoUsageCycle(projetoId);
  const totalTokens = Math.max(0, Math.round(tokens));
  const originalTokensInput = Math.max(0, details?.tokensInput ?? 0);
  const originalTokensOutput = Math.max(0, details?.tokensOutput ?? Math.max(0, totalTokens - originalTokensInput));
  const tokensAvulsosConsumidos = await consumirTokensAvulsos(projetoId, totalTokens);
  const tokensCobradosPlano = Math.max(0, totalTokens - tokensAvulsosConsumidos);
  const tokenSplit = splitUsageTokens(tokensCobradosPlano, originalTokensInput, originalTokensOutput);
  const tokensInput = tokenSplit.tokensInput;
  const tokensOutput = tokenSplit.tokensOutput;
  const custoOriginal = Math.max(0, Number(custo ?? 0));
  const custoTotal =
    totalTokens > 0 ? Number(((custoOriginal * tokensCobradosPlano) / totalTokens).toFixed(6)) : 0;

  if (cycle && tokensCobradosPlano > 0) {
    const { error: cycleError } = await supabase
      .from("projetos_ciclos_uso")
      .update({
        tokens_input: cycle.totals.tokensInput + tokensInput,
        tokens_output: cycle.totals.tokensOutput + tokensOutput,
        custo_total: Number(cycle.totals.custoTotal + custoTotal),
      } as never)
      .eq("id", cycle.id);

    if (cycleError) {
      console.error("[billing] failed to append usage to current cycle", cycleError);
    } else {
      const nextCycleTotalTokens = cycle.totals.totalTokens + tokensCobradosPlano;
      await atualizarAlertasCiclo({
        cycle,
        totalTokens: nextCycleTotalTokens,
      });
      await atualizarExcedenteCiclo({
        cycle,
        totalTokens: nextCycleTotalTokens,
      });
      await atualizarBloqueioCiclo({
        cycle,
        totalTokens: nextCycleTotalTokens,
      });
    }
  }

  if (tokensCobradosPlano > 0 || custoTotal > 0) {
    const { error: consumoError } = await supabase
      .from("consumos")
      .insert(({
        projeto_id: projetoId,
        usuario_id: details?.usuarioId ?? null,
        origem: details?.origem?.trim() || "chat",
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        custo_total: custoTotal,
        referencia_id: details?.referenciaId ?? null,
        created_at: new Date().toISOString(),
      }) as never);

    if (consumoError) {
      console.error("[billing] failed to insert legacy usage row", consumoError);
    }
  }

  return verificarLimite(projetoId);
}

export async function verifyProjetoBillingAccess(projetoId: string) {
  const current = await getPlanoProjeto(projetoId);
  if (!current) {
    return {
      allowed: true,
      code: "allowed" as const,
      message: null,
      current: null,
    };
  }

  if (current.modoCobranca === "ilimitado") {
    return {
      allowed: true,
      code: "unlimited_mode" as const,
      message: null,
      current,
    };
  }

  if (current.plano.bloqueado) {
    return {
      allowed: false,
      code: "project_manually_blocked" as const,
      message: current.plano.bloqueadoMotivo || "Projeto bloqueado para consumo de IA.",
      current,
    };
  }

  if (current.cicloAtual?.bloqueado) {
    return {
      allowed: false,
      code: "project_tokens_total_limit_reached" as const,
      message: "Projeto bloqueado por limite mensal total de tokens.",
      current,
    };
  }

  if (
    current.plano.autoBloquear &&
    current.plano.limiteTokensTotalMensal !== null &&
    current.consumoAtual.totalTokens >= current.plano.limiteTokensTotalMensal
  ) {
    return {
      allowed: false,
      code: "project_tokens_total_limit_reached" as const,
      message: "Projeto atingiu o limite mensal total de tokens.",
      current,
    };
  }

  if (
    current.plano.autoBloquear &&
    current.plano.limiteCustoMensal !== null &&
    current.consumoAtual.custoTotal >= current.plano.limiteCustoMensal
  ) {
    return {
      allowed: false,
      code: "project_cost_limit_reached" as const,
      message: "Projeto atingiu o limite mensal de custo.",
      current,
    };
  }

  if (
    current.plano.autoBloquear &&
    current.plano.limiteTokensInputMensal !== null &&
    current.consumoAtual.tokensInput >= current.plano.limiteTokensInputMensal
  ) {
    return {
      allowed: false,
      code: "project_tokens_input_limit_reached" as const,
      message: "Projeto atingiu o limite mensal de tokens de entrada.",
      current,
    };
  }

  if (
    current.plano.autoBloquear &&
    current.plano.limiteTokensOutputMensal !== null &&
    current.consumoAtual.tokensOutput >= current.plano.limiteTokensOutputMensal
  ) {
    return {
      allowed: false,
      code: "project_tokens_output_limit_reached" as const,
      message: "Projeto atingiu o limite mensal de tokens de saida.",
      current,
    };
  }

  return {
    allowed: true,
    code: "allowed" as const,
    message: null,
    current,
  };
}

export async function verificarLimite(projetoId: string) {
  const access = await verifyProjetoBillingAccess(projetoId);

  if (access.allowed || !access.current || access.current.modoCobranca === "ilimitado") {
    return access;
  }

  const reason = access.message;
  const next = await updateProjetoPlanoBilling({
    projetoId,
    planoId: access.current.plano.planoId,
    nomePlano: access.current.plano.nomePlano,
    modeloReferencia: access.current.plano.modeloReferencia,
    limiteTokensInputMensal: access.current.plano.limiteTokensInputMensal,
    limiteTokensOutputMensal: access.current.plano.limiteTokensOutputMensal,
    limiteTokensTotalMensal: access.current.plano.limiteTokensTotalMensal,
    limiteCustoMensal: access.current.plano.limiteCustoMensal,
    autoBloquear: access.current.plano.autoBloquear,
    bloqueado: true,
    bloqueadoMotivo: reason,
    observacoes: access.current.plano.observacoes,
  });

  return {
    ...access,
    current: next ? { ...access.current, plano: next } : access.current,
  };
}

export async function evaluateBillingAccess(input: {
  projetoId: string;
  usuarioId: string;
  referenceDate?: Date;
}) {
  const snapshot = await getBillingSnapshot(input);
  const modoCobranca = await getProjetoBillingMode(input.projetoId);

  if (modoCobranca === "ilimitado") {
    return buildDecision("unlimited_mode", snapshot, null);
  }

  if (snapshot.projetoPlano?.bloqueado) {
    return buildDecision(
      "project_manually_blocked",
      snapshot,
      snapshot.projetoPlano.bloqueadoMotivo || "Projeto bloqueado manualmente para consumo de IA.",
    );
  }

  if (
    snapshot.projetoPlano?.autoBloquear &&
    snapshot.projetoPlano.limiteTokensInputMensal !== null &&
    snapshot.consumoProjeto.tokensInput >= snapshot.projetoPlano.limiteTokensInputMensal
  ) {
    return buildDecision("project_tokens_input_limit_reached", snapshot, "Projeto atingiu o limite mensal de tokens de entrada.");
  }

  if (
    snapshot.projetoPlano?.autoBloquear &&
    snapshot.projetoPlano.limiteTokensOutputMensal !== null &&
    snapshot.consumoProjeto.tokensOutput >= snapshot.projetoPlano.limiteTokensOutputMensal
  ) {
    return buildDecision("project_tokens_output_limit_reached", snapshot, "Projeto atingiu o limite mensal de tokens de saida.");
  }

  if (
    snapshot.projetoPlano?.autoBloquear &&
    snapshot.projetoPlano.limiteTokensTotalMensal !== null &&
    snapshot.consumoProjeto.totalTokens >= snapshot.projetoPlano.limiteTokensTotalMensal
  ) {
    return buildDecision("project_tokens_total_limit_reached", snapshot, "Projeto atingiu o limite mensal total de tokens.");
  }

  if (
    snapshot.projetoPlano?.autoBloquear &&
    snapshot.projetoPlano.limiteCustoMensal !== null &&
    snapshot.consumoProjeto.custoTotal >= snapshot.projetoPlano.limiteCustoMensal
  ) {
    return buildDecision("project_cost_limit_reached", snapshot, "Projeto atingiu o limite mensal de custo.");
  }

  return buildDecision("allowed", snapshot, null);
}
