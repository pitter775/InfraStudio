import "server-only";

import { getDefaultOpenAIModel, resolvePricingModel } from "@/lib/openai-pricing";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type BillingMode = "plano" | "manual" | "ilimitado";
export type ProjetoAssinaturaStatus = "ativo" | "cancelado" | "trial" | "suspenso";

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
  max_agentes: number | null;
  max_apis: number | null;
  max_whatsapp: number | null;
  ativo: boolean | null;
};

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

type ProjetoAssinaturaJoinedRow = {
  id: string;
  projeto_id: string;
  plano_id: string;
  status: ProjetoAssinaturaStatus | null;
  data_inicio: string | null;
  data_fim: string | null;
  renovar_automatico: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  planos: PlanoRow | PlanoRow[] | null;
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
};

type ConsumoAggregateRow = {
  projeto_id?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  custo_total?: number | null;
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

export type PlanoBillingRecord = {
  id: string;
  nome: string;
  precoMensal: number;
  limiteTokensTotalMensal: number | null;
  limiteCustoMensal: number | null;
  maxAgentes: number;
  maxApis: number;
  maxWhatsapp: number;
  ativo: boolean;
};

export type ProjetoAssinaturaBilling = {
  id: string;
  projetoId: string;
  planoId: string;
  status: ProjetoAssinaturaStatus;
  dataInicio: string | null;
  dataFim: string | null;
  renovarAutomatico: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  plano: PlanoBillingRecord | null;
};

export type ProjetoCicloUso = {
  id: string;
  projetoId: string;
  dataInicio: string;
  dataFim: string;
  fechado: boolean;
  createdAt: string;
  totals: BillingUsageTotals;
};

export type BillingProjectPlan = {
  projetoId: string;
  projetoNome: string;
  modoCobranca: BillingMode;
  plano: ProjetoPlanoBilling;
  assinaturaAtual: ProjetoAssinaturaBilling | null;
  cicloAtual: ProjetoCicloUso | null;
  consumoAtual: BillingUsageTotals & { source: "ciclo" | "consumos" };
};

export type BillingUsageByProject = BillingProjectPlan & {
  percentualTokens: number | null;
  percentualCusto: number | null;
  percentualUso: number | null;
  status: "ativo" | "bloqueado";
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
  assinaturaAtual: ProjetoAssinaturaBilling | null;
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

function mapPlano(row: PlanoRow): PlanoBillingRecord {
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
  };
}

function normalizeJoinedPlano(value: PlanoRow | PlanoRow[] | null | undefined) {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapAssinatura(row: ProjetoAssinaturaJoinedRow): ProjetoAssinaturaBilling {
  const plano = normalizeJoinedPlano(row.planos);

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
    plano: plano ? mapPlano(plano) : null,
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
      assinaturas: new Map<string, ProjetoAssinaturaBilling>(),
      ciclos: new Map<string, ProjetoCicloUso>(),
      fallbackUsage: new Map<string, BillingUsageTotals>(),
    };
  }

  const projetos = projetosData as ProjetoRow[];
  if (!projetos.length) {
    return {
      projetos,
      snapshots: new Map<string, ProjetoPlanoBilling>(),
      assinaturas: new Map<string, ProjetoAssinaturaBilling>(),
      ciclos: new Map<string, ProjetoCicloUso>(),
      fallbackUsage: new Map<string, BillingUsageTotals>(),
    };
  }

  const ids = projetos.map((item) => item.id);
  const window = buildCurrentMonthWindow();
  const [snapshotsResponse, assinaturasResponse, ciclosResponse, consumosResponse] = await Promise.all([
    supabase
      .from("projetos_planos")
      .select("id, projeto_id, nome_plano, modelo_referencia, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal, auto_bloquear, bloqueado, bloqueado_motivo, observacoes")
      .in("projeto_id", ids),
    supabase
      .from("projetos_assinaturas")
      .select("id, projeto_id, plano_id, status, data_inicio, data_fim, renovar_automatico, created_at, updated_at, planos(id, nome, preco_mensal, limite_tokens_total_mensal, limite_custo_mensal, max_agentes, max_apis, max_whatsapp, ativo)")
      .in("projeto_id", ids)
      .in("status", ["ativo", "trial"])
      .order("created_at", { ascending: false }),
    supabase
      .from("projetos_ciclos_uso")
      .select("id, projeto_id, data_inicio, data_fim, tokens_input, tokens_output, custo_total, fechado, created_at")
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

  const assinaturas = new Map<string, ProjetoAssinaturaBilling>();
  for (const row of (assinaturasResponse.data ?? []) as ProjetoAssinaturaJoinedRow[]) {
    if (!assinaturas.has(row.projeto_id)) {
      assinaturas.set(row.projeto_id, mapAssinatura(row));
    }
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

  return { projetos, snapshots, assinaturas, ciclos, fallbackUsage };
}

export async function getProjetoPlanoBilling(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos_planos")
    .select("id, projeto_id, nome_plano, modelo_referencia, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal, auto_bloquear, bloqueado, bloqueado_motivo, observacoes")
    .eq("projeto_id", projetoId)
    .maybeSingle();

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

  if (error || !data) {
    console.error("[billing] failed to ensure project snapshot", error);
    return null;
  }

  return mapProjetoPlano(data as ProjetoPlanoRow);
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
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("projetos_planos")
    .upsert(payload as never, { onConflict: "projeto_id" })
    .select("id, projeto_id, nome_plano, modelo_referencia, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal, auto_bloquear, bloqueado, bloqueado_motivo, observacoes")
    .single();

  if (error || !data) {
    console.error("[billing] failed to update project snapshot", error);
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

export async function getAssinaturaAtivaProjeto(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos_assinaturas")
    .select("id, projeto_id, plano_id, status, data_inicio, data_fim, renovar_automatico, created_at, updated_at, planos(id, nome, preco_mensal, limite_tokens_total_mensal, limite_custo_mensal, max_agentes, max_apis, max_whatsapp, ativo)")
    .eq("projeto_id", projetoId)
    .in("status", ["ativo", "trial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[billing] failed to load active subscription", error);
    return null;
  }

  return data ? mapAssinatura(data as ProjetoAssinaturaJoinedRow) : null;
}

export async function getCicloAtual(projetoId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("projetos_ciclos_uso")
    .select("id, projeto_id, data_inicio, data_fim, tokens_input, tokens_output, custo_total, fechado, created_at")
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
      created_at: new Date().toISOString(),
    }) as never)
    .select("id, projeto_id, data_inicio, data_fim, tokens_input, tokens_output, custo_total, fechado, created_at")
    .single();

  if (error || !data) {
    console.error("[billing] failed to create usage cycle", error);
    return null;
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
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("planos")
      .select("id, nome, preco_mensal, limite_tokens_total_mensal, limite_custo_mensal, max_agentes, max_apis, max_whatsapp, ativo")
      .eq("id", input.planoId)
      .maybeSingle();

    if (error || !data) {
      console.error("[billing] failed to load plan for snapshot sync", error);
      return null;
    }

    plano = mapPlano(data as PlanoRow);
  }

  if (!plano) {
    return null;
  }

  return updateProjetoPlanoBilling({
    projetoId: input.projetoId,
    nomePlano: plano.nome,
    limiteTokensTotalMensal: plano.limiteTokensTotalMensal,
    limiteCustoMensal: plano.limiteCustoMensal,
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
  const [projeto, snapshot, assinaturaAtual, cicloAtual] = await Promise.all([
    getProjetoRowById(projetoId),
    ensureProjetoPlanoBilling(projetoId),
    getAssinaturaAtivaProjeto(projetoId),
    getCicloAtual(projetoId),
  ]);

  if (!projeto || !snapshot) {
    return null;
  }

  const fallbackConsumo = await getBillingUsageTotals({ projetoId });
  const modoCobranca = projeto.modo_cobranca ?? "plano";
  const planoAssinado = assinaturaAtual?.plano;

  const plano: ProjetoPlanoBilling =
    modoCobranca === "plano" && planoAssinado
      ? {
          ...snapshot,
          nomePlano: planoAssinado.nome,
          limiteTokensTotalMensal: planoAssinado.limiteTokensTotalMensal,
          limiteCustoMensal: planoAssinado.limiteCustoMensal,
          bloqueado: snapshot.bloqueado,
          bloqueadoMotivo: snapshot.bloqueadoMotivo,
        }
      : modoCobranca === "ilimitado"
        ? {
            ...snapshot,
            nomePlano: "Ilimitado",
            limiteTokensInputMensal: null,
            limiteTokensOutputMensal: null,
            limiteTokensTotalMensal: null,
            limiteCustoMensal: null,
            bloqueado: false,
            bloqueadoMotivo: null,
          }
        : snapshot;

  return {
    projetoId,
    projetoNome: projeto.nome?.trim() || "Projeto sem nome",
    modoCobranca,
    plano,
    assinaturaAtual,
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
    assinaturaAtual: current.assinaturaAtual,
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
    };
    const assinaturaAtual = base.assinaturas.get(projeto.id) ?? null;
    const cicloAtual = base.ciclos.get(projeto.id) ?? null;
    const fallbackConsumo = base.fallbackUsage.get(projeto.id) ?? normalizeTotals();
    const modoCobranca = projeto.modo_cobranca ?? "plano";
    const plano: ProjetoPlanoBilling =
      modoCobranca === "plano" && assinaturaAtual?.plano
        ? {
            ...snapshot,
            nomePlano: assinaturaAtual.plano.nome,
            limiteTokensTotalMensal: assinaturaAtual.plano.limiteTokensTotalMensal,
            limiteCustoMensal: assinaturaAtual.plano.limiteCustoMensal,
          }
        : modoCobranca === "ilimitado"
          ? {
              ...snapshot,
              nomePlano: "Ilimitado",
              limiteTokensInputMensal: null,
              limiteTokensOutputMensal: null,
              limiteTokensTotalMensal: null,
              limiteCustoMensal: null,
              bloqueado: false,
              bloqueadoMotivo: null,
            }
          : snapshot;
    const consumoAtual = cicloAtual
      ? { ...cicloAtual.totals, source: "ciclo" as const }
      : { ...fallbackConsumo, source: "consumos" as const };

    const percentualTokens = computePercent(consumoAtual.totalTokens, plano.limiteTokensTotalMensal);
    const percentualCusto = computePercent(consumoAtual.custoTotal, plano.limiteCustoMensal);
    const percentualUso = clampPercent(Math.max(percentualTokens ?? 0, percentualCusto ?? 0));

    return {
      projetoId: projeto.id,
      projetoNome: projeto.nome?.trim() || "Projeto sem nome",
      modoCobranca,
      plano,
      assinaturaAtual,
      cicloAtual,
      consumoAtual,
      percentualTokens,
      percentualCusto,
      percentualUso,
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
  const tokensInput = Math.max(0, details?.tokensInput ?? 0);
  const tokensOutput = Math.max(0, details?.tokensOutput ?? Math.max(0, tokens - tokensInput));
  const custoTotal = Math.max(0, Number(custo ?? 0));

  if (cycle) {
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
    }
  }

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

  return verifyProjetoBillingAccess(projetoId);
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
