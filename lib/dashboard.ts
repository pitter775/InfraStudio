import "server-only";

import type { AppUser } from "@/lib/app-user";
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
  contexto: Record<string, unknown> | null;
};

type DashboardMessageRow = {
  id: string;
  chat_id: string | null;
  role: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  custo: number | null;
  created_at: string | null;
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

type DashboardTopChat = {
  chatId: string;
  titulo: string;
  leadNome: string | null;
  projetoNome: string | null;
  agenteNome: string | null;
  mensagens: number;
  tokensInput: number;
  tokensOutput: number;
  totalTokens: number;
  custo: number;
  updatedAt: string;
};

type DashboardRecentActivity = {
  id: string;
  chatId: string;
  titulo: string;
  leadNome: string | null;
  agenteNome: string | null;
  role: string;
  totalTokens: number;
  tokensInput: number;
  tokensOutput: number;
  custo: number;
  createdAt: string;
};

type DashboardUsageSummary = {
  periodLabel: string;
  startDate: string;
  endDate: string;
  costModel: string;
  costCurrency: "USD";
  tokensInput: number;
  tokensOutput: number;
  totalTokens: number;
  totalCost: number;
  hasCostData: boolean;
  processedMessages: number;
  activeChats: number;
  activeAgents: number;
  topChats: DashboardTopChat[];
  topAgents: Array<{ agenteNome: string; chats: number; totalTokens: number }>;
  recentActivity: DashboardRecentActivity[];
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
  usage: DashboardUsageSummary;
};

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const inclusiveEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    startIso: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")} 00:00:00`,
    endIso: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")} 00:00:00`,
    startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
    endDate: `${inclusiveEnd.getFullYear()}-${String(inclusiveEnd.getMonth() + 1).padStart(2, "0")}-${String(inclusiveEnd.getDate()).padStart(2, "0")}`,
    label: start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };
}

function getContextName(contexto: Record<string, unknown> | null, key: "lead" | "projeto" | "agente") {
  const section = contexto?.[key] as { nome?: string | null } | undefined;
  return typeof section?.nome === "string" && section.nome.trim() ? section.nome.trim() : null;
}

function resolveMessageCost(message: DashboardMessageRow) {
  return Number(message.custo ?? 0);
}

async function listScopedProjects(user: AppUser) {
  return user.isMaster ? await listProjetosWithStats() : await listProjetosByUsuarioWithStats(user.id);
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

  const emptyUsage: DashboardUsageSummary = {
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
    topChats: [],
    topAgents: [],
    recentActivity: [],
  };

  if (!projectIds.length && !user.isMaster) {
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
    .select("id, titulo, projeto_id, total_tokens, total_custo, updated_at, contexto")
    .order("updated_at", { ascending: false });
  let membershipsQuery = supabase.from("usuarios_projetos").select("usuario_id", { count: "exact" });

  if (!user.isMaster) {
    agentesQuery = agentesQuery.in("projeto_id", projectIds);
    apisQuery = apisQuery.in("projeto_id", projectIds);
    widgetsQuery = widgetsQuery.in("projeto_id", projectIds);
    chatsQuery = chatsQuery.in("projeto_id", projectIds);
    membershipsQuery = membershipsQuery.in("projeto_id", projectIds);
  }

  const [agentesResponse, apisResponse, widgetsResponse, chatsResponse, membershipsResponse] = await Promise.all([
    agentesQuery,
    apisQuery,
    widgetsQuery,
    chatsQuery,
    membershipsQuery,
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
  const chats = ((chatsResponse.data ?? []) as DashboardChatRow[]).map((item) => ({
    id: item.id,
    titulo: item.titulo?.trim() || "Nova conversa",
    totalTokens: item.total_tokens ?? 0,
    totalCusto: Number(item.total_custo ?? 0),
    projetoId: item.projeto_id,
    updatedAt: item.updated_at ?? new Date().toISOString(),
  }));

  const chatIds = ((chatsResponse.data ?? []) as DashboardChatRow[]).map((item) => item.id);
  if (!chatIds.length) {
    return {
      scope: user.isMaster ? "global" : "user",
      userName: user.name,
      usersCount: membershipsResponse.count ?? (user.isMaster ? 0 : 1),
      projetos: mapProjects(projectRows),
      agentes,
      apis,
      widgets,
      chats,
      usage: emptyUsage,
    };
  }

  const { data: messagesData } = await supabase
    .from("mensagens")
    .select("id, chat_id, role, tokens_input, tokens_output, custo, created_at")
    .in("chat_id", chatIds)
    .gte("created_at", range.startIso)
    .lt("created_at", range.endIso)
    .order("created_at", { ascending: false });

  const chatMap = new Map(((chatsResponse.data ?? []) as DashboardChatRow[]).map((item) => [item.id, item]));
  const processedMessages = ((messagesData ?? []) as DashboardMessageRow[]).filter(
    (message) => message.chat_id && ((message.tokens_input ?? 0) > 0 || (message.tokens_output ?? 0) > 0),
  );

  const tokensInput = processedMessages.reduce((sum, message) => sum + (message.tokens_input ?? 0), 0);
  const tokensOutput = processedMessages.reduce((sum, message) => sum + (message.tokens_output ?? 0), 0);
  const totalCost = processedMessages.reduce((sum, message) => sum + resolveMessageCost(message), 0);

  const perChat = new Map<string, DashboardTopChat>();
  for (const message of processedMessages) {
    const chatId = message.chat_id!;
    const chat = chatMap.get(chatId);
    const aggregate =
      perChat.get(chatId) ??
      {
        chatId,
        titulo: chat?.titulo?.trim() || "Conversa sem titulo",
        leadNome: getContextName(chat?.contexto ?? null, "lead"),
        projetoNome: getContextName(chat?.contexto ?? null, "projeto"),
        agenteNome: getContextName(chat?.contexto ?? null, "agente"),
        mensagens: 0,
        tokensInput: 0,
        tokensOutput: 0,
        totalTokens: 0,
        custo: 0,
        updatedAt: chat?.updated_at ?? new Date().toISOString(),
      };

    aggregate.mensagens += 1;
    aggregate.tokensInput += message.tokens_input ?? 0;
    aggregate.tokensOutput += message.tokens_output ?? 0;
    aggregate.totalTokens += (message.tokens_input ?? 0) + (message.tokens_output ?? 0);
    aggregate.custo += resolveMessageCost(message);
    perChat.set(chatId, aggregate);
  }

  const perAgent = new Map<string, { agenteNome: string; chats: number; totalTokens: number }>();
  for (const item of perChat.values()) {
    const agenteNome = item.agenteNome ?? "Sem agente";
    const aggregate = perAgent.get(agenteNome) ?? { agenteNome, chats: 0, totalTokens: 0 };
    aggregate.chats += 1;
    aggregate.totalTokens += item.totalTokens;
    perAgent.set(agenteNome, aggregate);
  }

  const recentActivity = processedMessages.slice(0, 8).map((message) => {
    const chat = chatMap.get(message.chat_id!);
    return {
      id: message.id,
      chatId: message.chat_id!,
      titulo: chat?.titulo?.trim() || "Conversa sem titulo",
      leadNome: getContextName(chat?.contexto ?? null, "lead"),
      agenteNome: getContextName(chat?.contexto ?? null, "agente"),
      role: message.role ?? "assistant",
      totalTokens: (message.tokens_input ?? 0) + (message.tokens_output ?? 0),
      tokensInput: message.tokens_input ?? 0,
      tokensOutput: message.tokens_output ?? 0,
      custo: resolveMessageCost(message),
      createdAt: message.created_at ?? new Date().toISOString(),
    };
  });

  return {
    scope: user.isMaster ? "global" : "user",
    userName: user.name,
    usersCount: membershipsResponse.count ?? (user.isMaster ? 0 : 1),
    projetos: mapProjects(projectRows),
    agentes,
    apis,
    widgets,
    chats,
    usage: {
      periodLabel: range.label.charAt(0).toUpperCase() + range.label.slice(1),
      startDate: range.startDate,
      endDate: range.endDate,
      costModel: getDefaultOpenAIModel(),
      costCurrency: "USD",
      tokensInput,
      tokensOutput,
      totalTokens: tokensInput + tokensOutput,
      totalCost,
      hasCostData: totalCost > 0,
      processedMessages: processedMessages.length,
      activeChats: perChat.size,
      activeAgents: perAgent.size,
      topChats: [...perChat.values()].sort((left, right) => right.totalTokens - left.totalTokens).slice(0, 8),
      topAgents: [...perAgent.values()].sort((left, right) => right.totalTokens - left.totalTokens).slice(0, 5),
      recentActivity,
    },
  };
}
