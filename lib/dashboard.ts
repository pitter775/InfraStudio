import "server-only";

import type { AppUser } from "@/lib/app-user";
import { canAccessGlobalAdmin } from "@/lib/access";
import { listBillingUsageByProject } from "@/lib/billing-access";
import { isAgentTestChatContext } from "@/lib/chats";
import { getIaUsageSummaryForProjects } from "@/lib/ia-usage";
import type { IaUsageSummary } from "@/lib/ia-usage-types";
import { listProjetosByUsuarioWithStats, listProjetosWithStats, type ProjetoOverviewRecord } from "@/lib/projetos";
import { getDefaultOpenAIModel } from "@/lib/openai-pricing";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type DashboardAgenteRow = {
  id: string;
  projeto_id: string | null;
};

type DashboardApiRow = {
  id: string;
  projeto_id: string | null;
};

type DashboardWidgetRow = {
  id: string;
  projeto_id: string | null;
};

type DashboardChatRow = {
  id: string;
  titulo: string | null;
  projeto_id: string | null;
  total_tokens: number | null;
  total_custo: number | null;
  updated_at: string | null;
  canal: string | null;
  contexto: Record<string, unknown> | null;
};

type DashboardProject = {
  id: string;
  nome: string;
  slug: string | null;
  tipo: string | null;
  descricao: string;
  status: string;
};

type DashboardChat = {
  id: string;
  titulo: string;
  totalTokens: number;
  totalCusto: number;
  projetoId: string | null;
  updatedAt: string;
  canal: string | null;
};

type DashboardProjection = {
  averageDailyTokens: number;
  daysUntilLimit: number | null;
  remainingCycleDays: number;
  remainingTokens: number | null;
  limitedProjects: number;
};

type DashboardGlobalStatus = {
  tone: "ok" | "attention" | "critical" | "blocked";
  label: string;
  detail: string;
  affectedProjects: number;
  usagePercent: number | null;
};

type DashboardChannelUsage = {
  canal: string;
  label: string;
  totalTokens: number;
  totalChats: number;
};

export type DashboardOverview = {
  scope: "global" | "user";
  userName: string;
  usersCount: number;
  projetos: DashboardProject[];
  agentes: Array<{ id: string; projetoId: string | null }>;
  apis: Array<{ id: string; projetoId: string | null }>;
  widgets: Array<{ id: string; projetoId: string | null }>;
  chats: DashboardChat[];
  usage: IaUsageSummary;
  projection: DashboardProjection | null;
  globalStatus: DashboardGlobalStatus;
  channelUsage: DashboardChannelUsage[];
};

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const inclusiveEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
    endDate: `${inclusiveEnd.getFullYear()}-${String(inclusiveEnd.getMonth() + 1).padStart(2, "0")}-${String(inclusiveEnd.getDate()).padStart(2, "0")}`,
    label: start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };
}

async function listScopedProjects(user: AppUser) {
  return canAccessGlobalAdmin(user) ? await listProjetosWithStats() : await listProjetosByUsuarioWithStats(user.id);
}

function mapProjects(projects: ProjetoOverviewRecord[]): DashboardProject[] {
  return projects.map((project) => ({
    id: project.id,
    nome: project.nome,
    slug: project.slug,
    tipo: project.tipo,
    descricao: project.descricao,
    status: project.status,
  }));
}

function diffDaysInclusive(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(diff / 86_400_000) + 1);
}

function buildDashboardProjection(input: {
  usage: IaUsageSummary;
  billingUsage: Awaited<ReturnType<typeof listBillingUsageByProject>>;
}) {
  const elapsedDays = diffDaysInclusive(input.usage.startDate, new Date().toISOString().slice(0, 10));
  const averageDailyTokens = elapsedDays > 0 ? input.usage.totalTokens / elapsedDays : 0;

  const limitedProjects = input.billingUsage.filter(
    (item) => item.modoCobranca !== "ilimitado" && (item.cicloAtual?.limiteTokensTotal ?? item.plano.limiteTokensTotalMensal) !== null,
  );

  if (!limitedProjects.length) {
    return {
      averageDailyTokens,
      daysUntilLimit: null,
      remainingCycleDays: diffDaysInclusive(new Date().toISOString().slice(0, 10), input.usage.endDate) - 1,
      remainingTokens: null,
      limitedProjects: 0,
    } satisfies DashboardProjection;
  }

  const totalLimit = limitedProjects.reduce(
    (sum, item) => sum + Math.max(0, item.cicloAtual?.limiteTokensTotal ?? item.plano.limiteTokensTotalMensal ?? 0),
    0,
  );
  const totalUsed = limitedProjects.reduce((sum, item) => sum + item.consumoAtual.totalTokens, 0);
  const remainingTokens = Math.max(0, totalLimit - totalUsed);
  const daysUntilLimit = averageDailyTokens > 0 ? Math.ceil(remainingTokens / averageDailyTokens) : null;

  return {
    averageDailyTokens,
    daysUntilLimit,
    remainingCycleDays: Math.max(0, diffDaysInclusive(new Date().toISOString().slice(0, 10), input.usage.endDate) - 1),
    remainingTokens,
    limitedProjects: limitedProjects.length,
  } satisfies DashboardProjection;
}

function buildDashboardGlobalStatus(billingUsage: Awaited<ReturnType<typeof listBillingUsageByProject>>) {
  const blocked = billingUsage.filter((item) => item.status === "bloqueado" || item.cicloAtual?.bloqueado).length;
  const percents = billingUsage.map((item) => item.percentualUso).filter((value): value is number => value !== null);
  const usagePercent = percents.length ? Math.max(...percents) : null;

  if (blocked > 0) {
    return {
      tone: "blocked",
      label: "Bloqueado",
      detail: `${blocked} projeto(s) com bloqueio no ciclo`,
      affectedProjects: blocked,
      usagePercent,
    } satisfies DashboardGlobalStatus;
  }

  if (usagePercent !== null && usagePercent >= 100) {
    return {
      tone: "critical",
      label: "Critico",
      detail: "Consumo acima do limite configurado",
      affectedProjects: billingUsage.filter((item) => (item.percentualUso ?? 0) >= 100).length,
      usagePercent,
    } satisfies DashboardGlobalStatus;
  }

  if (usagePercent !== null && usagePercent >= 80) {
    return {
      tone: "attention",
      label: "Atencao",
      detail: "Operacao perto do limite do ciclo",
      affectedProjects: billingUsage.filter((item) => (item.percentualUso ?? 0) >= 80).length,
      usagePercent,
    } satisfies DashboardGlobalStatus;
  }

  return {
    tone: "ok",
    label: "Tudo ok",
    detail: "Consumo sob controle no ciclo atual",
    affectedProjects: 0,
    usagePercent,
  } satisfies DashboardGlobalStatus;
}

function mapChannelLabel(value: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized.includes("whatsapp")) {
    return { canal: "whatsapp", label: "WhatsApp" };
  }
  if (normalized.includes("api")) {
    return { canal: "api", label: "API" };
  }
  if (normalized.includes("web") || normalized.includes("widget") || normalized.includes("site")) {
    return { canal: "web", label: "Web" };
  }
  return { canal: normalized || "outros", label: normalized || "Outros" };
}

function buildChannelUsage(chats: DashboardChat[]) {
  const usage = new Map<string, DashboardChannelUsage>();

  for (const chat of chats) {
    const channel = mapChannelLabel(chat.canal);
    const current = usage.get(channel.canal) ?? {
      canal: channel.canal,
      label: channel.label,
      totalTokens: 0,
      totalChats: 0,
    };

    current.totalTokens += chat.totalTokens;
    current.totalChats += 1;
    usage.set(channel.canal, current);
  }

  return [...usage.values()].sort((left, right) => right.totalTokens - left.totalTokens).slice(0, 4);
}

export async function getDashboardOverview(user: AppUser): Promise<DashboardOverview> {
  const supabase = getSupabaseAdminClient();
  const projectRows = await listScopedProjects(user);
  const projectIds = projectRows.map((project) => project.id);
  const range = getMonthRange();

  const emptyUsage: IaUsageSummary = {
    periodLabel: range.label.charAt(0).toUpperCase() + range.label.slice(1),
    startDate: range.startDate,
    endDate: range.endDate,
    costModel: getDefaultOpenAIModel(),
    costCurrency: "USD",
    tokensInput: 0,
    tokensOutput: 0,
    totalTokens: 0,
    totalCost: 0,
    hasCostData: false,
    processedMessages: 0,
    activeChats: 0,
    activeAgents: 0,
    dailyUsage: [],
    topChats: [],
    topAgents: [],
    topOrigins: [],
    recentActivity: [],
  };

  if (!projectIds.length && !canAccessGlobalAdmin(user)) {
    return {
      scope: "user",
      userName: user.name,
      usersCount: 1,
      projetos: [],
      agentes: [],
      apis: [],
      widgets: [],
      chats: [],
      usage: emptyUsage,
      projection: null,
      globalStatus: buildDashboardGlobalStatus([]),
      channelUsage: [],
    };
  }

  let agentesQuery = supabase.from("agentes").select("id, projeto_id");
  let apisQuery = supabase.from("apis").select("id, projeto_id");
  let widgetsQuery = supabase.from("chat_widgets").select("id, projeto_id");
  let chatsQuery = supabase
    .from("chats")
    .select("id, titulo, projeto_id, total_tokens, total_custo, updated_at, canal, contexto")
    .order("updated_at", { ascending: false });
  let membershipsQuery = supabase.from("usuarios_projetos").select("usuario_id", { count: "exact" });

  if (!canAccessGlobalAdmin(user)) {
    agentesQuery = agentesQuery.in("projeto_id", projectIds);
    apisQuery = apisQuery.in("projeto_id", projectIds);
    widgetsQuery = widgetsQuery.in("projeto_id", projectIds);
    chatsQuery = chatsQuery.in("projeto_id", projectIds);
    membershipsQuery = membershipsQuery.in("projeto_id", projectIds);
  }

  const [agentesResponse, apisResponse, widgetsResponse, chatsResponse, membershipsResponse, usage, billingUsage] = await Promise.all([
    agentesQuery,
    apisQuery,
    widgetsQuery,
    chatsQuery,
    membershipsQuery,
    getIaUsageSummaryForProjects(canAccessGlobalAdmin(user) ? null : projectIds, {
      startDate: range.startDate,
      endDate: range.endDate,
    }),
    listBillingUsageByProject(canAccessGlobalAdmin(user) ? undefined : projectIds),
  ]);

  const agentes = ((agentesResponse.data ?? []) as DashboardAgenteRow[]).map((item) => ({
    id: item.id,
    projetoId: item.projeto_id,
  }));
  const apis = ((apisResponse.data ?? []) as DashboardApiRow[]).map((item) => ({
    id: item.id,
    projetoId: item.projeto_id,
  }));
  const widgets = ((widgetsResponse.data ?? []) as DashboardWidgetRow[]).map((item) => ({
    id: item.id,
    projetoId: item.projeto_id,
  }));
  const chats = ((chatsResponse.data ?? []) as DashboardChatRow[])
    .filter((item) => item.canal !== "admin_agent_test" && !isAgentTestChatContext(item.contexto))
    .map((item) => ({
      id: item.id,
      titulo: item.titulo?.trim() || "Nova conversa",
      totalTokens: item.total_tokens ?? 0,
      totalCusto: Number(item.total_custo ?? 0),
      projetoId: item.projeto_id,
      updatedAt: item.updated_at ?? new Date().toISOString(),
      canal: item.canal,
    }));

  const globalStatus = buildDashboardGlobalStatus(billingUsage);
  const channelUsage = buildChannelUsage(chats);

  return {
    scope: canAccessGlobalAdmin(user) ? "global" : "user",
    userName: user.name,
    usersCount: membershipsResponse.count ?? (canAccessGlobalAdmin(user) ? 0 : 1),
    projetos: mapProjects(projectRows),
    agentes,
    apis,
    widgets,
    chats,
    usage,
    projection: buildDashboardProjection({ usage, billingUsage }),
    globalStatus,
    channelUsage,
  };
}
