import "server-only";

import type { AppUser } from "@/lib/app-user";
import { canAccessGlobalAdmin } from "@/lib/access";
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

  const [agentesResponse, apisResponse, widgetsResponse, chatsResponse, membershipsResponse, usage] = await Promise.all([
    agentesQuery,
    apisQuery,
    widgetsQuery,
    chatsQuery,
    membershipsQuery,
    getIaUsageSummaryForProjects(canAccessGlobalAdmin(user) ? null : projectIds, {
      startDate: range.startDate,
      endDate: range.endDate,
    }),
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
    }));

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
  };
}
