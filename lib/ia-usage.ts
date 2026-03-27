import "server-only";

import { estimateOpenAICostUsd, getDefaultOpenAIModel } from "@/lib/openai-pricing";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppUser } from "@/lib/app-user";
import { isAdminUser } from "@/lib/access";

type ChatUsageRow = {
  id: string;
  titulo: string | null;
  projeto_id: string | null;
  total_tokens: number | null;
  total_custo: number | null;
  created_at: string | null;
  updated_at: string | null;
  contexto: Record<string, unknown> | null;
};

type MessageUsageRow = {
  id: string;
  chat_id: string | null;
  role: string | null;
  conteudo: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  custo: number | null;
  created_at: string | null;
};

type ChatUsageAggregate = {
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

type AgentUsageAggregate = {
  agenteNome: string;
  chats: number;
  totalTokens: number;
};

type RecentUsageItem = {
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

export type IaUsageSummary = {
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
  topChats: ChatUsageAggregate[];
  topAgents: AgentUsageAggregate[];
  recentActivity: RecentUsageItem[];
};

type ConsumoRow = {
  usuario_id: string | null;
  projeto_id: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  custo_total: number | null;
};

export type TokenUsageGroup = {
  id: string;
  nome: string;
  tokensInput: number;
  tokensOutput: number;
  custoTotal: number;
};

export type TokenUsageUserProjectGroup = {
  usuarioId: string;
  usuarioNome: string;
  projetoId: string;
  projetoNome: string;
  tokensInput: number;
  tokensOutput: number;
  custoTotal: number;
};

export type TokenUsageProjectAgent = {
  id: string;
  projetoId: string;
  nome: string;
  ativo: boolean;
};

export type TokenUsageOverview = {
  isAdmin: boolean;
  tokensInput: number;
  tokensOutput: number;
  custoTotal: number;
  totalUsuarios: number;
  totalProjetos: number;
  porUsuario: TokenUsageGroup[];
  porProjeto: TokenUsageGroup[];
  porUsuarioProjeto: TokenUsageUserProjectGroup[];
  agentesPorProjeto: TokenUsageProjectAgent[];
};

type IaUsageRange = {
  startDate?: string | null;
  endDate?: string | null;
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

function resolveRange(range?: IaUsageRange) {
  const fallback = getMonthRange();

  if (!range?.startDate || !range?.endDate) {
    return fallback;
  }

  const [startYear, startMonth, startDay] = range.startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = range.endDate.split("-").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const inclusiveEnd = new Date(endYear, endMonth - 1, endDay);
  const endExclusive = new Date(endYear, endMonth - 1, endDay + 1);

  if (Number.isNaN(start.getTime()) || Number.isNaN(inclusiveEnd.getTime()) || start > inclusiveEnd) {
    return fallback;
  }

  const sameMonth =
    start.getFullYear() === inclusiveEnd.getFullYear() && start.getMonth() === inclusiveEnd.getMonth();

  const label = sameMonth
    ? start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : `${start.toLocaleDateString("pt-BR")} a ${inclusiveEnd.toLocaleDateString("pt-BR")}`;

  return {
    startIso: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")} 00:00:00`,
    endIso: `${endExclusive.getFullYear()}-${String(endExclusive.getMonth() + 1).padStart(2, "0")}-${String(endExclusive.getDate()).padStart(2, "0")} 00:00:00`,
    startDate: range.startDate,
    endDate: range.endDate,
    label,
  };
}

function getContextName(contexto: Record<string, unknown> | null, key: "lead" | "projeto" | "agente") {
  const section = contexto?.[key] as { nome?: string | null } | undefined;
  return typeof section?.nome === "string" && section.nome.trim() ? section.nome.trim() : null;
}

function resolveMessageCost(message: MessageUsageRow) {
  const savedCost = Number(message.custo ?? 0);
  if (savedCost > 0) {
    return savedCost;
  }

  return estimateOpenAICostUsd(message.tokens_input ?? 0, message.tokens_output ?? 0, getDefaultOpenAIModel());
}

function sumTokenUsage(items: Array<{ tokensInput: number; tokensOutput: number; custoTotal: number }>) {
  return items.reduce(
    (acc, item) => {
      acc.tokensInput += item.tokensInput;
      acc.tokensOutput += item.tokensOutput;
      acc.custoTotal += item.custoTotal;
      return acc;
    },
    { tokensInput: 0, tokensOutput: 0, custoTotal: 0 },
  );
}

export async function getTokenUsageOverview(user: AppUser): Promise<TokenUsageOverview> {
  const supabase = getSupabaseAdminClient();
  const admin = isAdminUser(user);
  let query = supabase
    .from("consumos")
    .select("usuario_id, projeto_id, tokens_input, tokens_output, custo_total");

  if (!admin) {
    query = query.eq("usuario_id", user.id);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("[ia-usage] failed to list consumos", error);
    return {
      isAdmin: admin,
      tokensInput: 0,
      tokensOutput: 0,
      custoTotal: 0,
      totalUsuarios: 0,
      totalProjetos: 0,
      porUsuario: [],
      porProjeto: [],
      porUsuarioProjeto: [],
      agentesPorProjeto: [],
    };
  }

  const consumos = data as ConsumoRow[];
  const usuarioIds = Array.from(new Set(consumos.map((item) => item.usuario_id).filter(Boolean) as string[]));
  const projetoIds = Array.from(new Set(consumos.map((item) => item.projeto_id).filter(Boolean) as string[]));

  const [usuariosResponse, projetosResponse] = await Promise.all([
    usuarioIds.length
      ? supabase.from("usuarios").select("id, nome, email").in("id", usuarioIds)
      : Promise.resolve({ data: [], error: null }),
    projetoIds.length
      ? supabase.from("projetos").select("id, nome").in("id", projetoIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const agentesResponse = projetoIds.length
    ? await supabase.from("agentes").select("id, projeto_id, nome, ativo").in("projeto_id", projetoIds)
    : { data: [], error: null };

  const usuariosMap = new Map(
    ((usuariosResponse.data ?? []) as Array<{ id: string; nome: string | null; email: string | null }>).map((item) => [
      item.id,
      item.nome?.trim() || item.email?.trim() || "Usuário",
    ]),
  );
  const projetosMap = new Map(
    ((projetosResponse.data ?? []) as Array<{ id: string; nome: string | null }>).map((item) => [
      item.id,
      item.nome?.trim() || "Projeto",
    ]),
  );

  const porUsuarioMap = new Map<string, TokenUsageGroup>();
  const porProjetoMap = new Map<string, TokenUsageGroup>();
  const porUsuarioProjetoMap = new Map<string, TokenUsageUserProjectGroup>();

  for (const item of consumos) {
    const usuarioId = item.usuario_id ?? "sem-usuario";
    const projetoId = item.projeto_id ?? "sem-projeto";
    const tokensInput = item.tokens_input ?? 0;
    const tokensOutput = item.tokens_output ?? 0;
    const custoTotal = item.custo_total ?? 0;

    const porUsuario = porUsuarioMap.get(usuarioId) ?? {
      id: usuarioId,
      nome: usuariosMap.get(usuarioId) ?? "Usuário",
      tokensInput: 0,
      tokensOutput: 0,
      custoTotal: 0,
    };
    porUsuario.tokensInput += tokensInput;
    porUsuario.tokensOutput += tokensOutput;
    porUsuario.custoTotal += custoTotal;
    porUsuarioMap.set(usuarioId, porUsuario);

    const porProjeto = porProjetoMap.get(projetoId) ?? {
      id: projetoId,
      nome: projetosMap.get(projetoId) ?? "Projeto",
      tokensInput: 0,
      tokensOutput: 0,
      custoTotal: 0,
    };
    porProjeto.tokensInput += tokensInput;
    porProjeto.tokensOutput += tokensOutput;
    porProjeto.custoTotal += custoTotal;
    porProjetoMap.set(projetoId, porProjeto);

    const composedKey = `${usuarioId}:${projetoId}`;
    const porUsuarioProjeto = porUsuarioProjetoMap.get(composedKey) ?? {
      usuarioId,
      usuarioNome: usuariosMap.get(usuarioId) ?? "Usuário",
      projetoId,
      projetoNome: projetosMap.get(projetoId) ?? "Projeto",
      tokensInput: 0,
      tokensOutput: 0,
      custoTotal: 0,
    };
    porUsuarioProjeto.tokensInput += tokensInput;
    porUsuarioProjeto.tokensOutput += tokensOutput;
    porUsuarioProjeto.custoTotal += custoTotal;
    porUsuarioProjetoMap.set(composedKey, porUsuarioProjeto);
  }

  const porUsuario = Array.from(porUsuarioMap.values()).sort((left, right) => right.custoTotal - left.custoTotal || right.tokensInput + right.tokensOutput - (left.tokensInput + left.tokensOutput));
  const porProjeto = Array.from(porProjetoMap.values()).sort((left, right) => right.custoTotal - left.custoTotal || right.tokensInput + right.tokensOutput - (left.tokensInput + left.tokensOutput));
  const porUsuarioProjeto = Array.from(porUsuarioProjetoMap.values()).sort((left, right) => right.custoTotal - left.custoTotal || right.tokensInput + right.tokensOutput - (left.tokensInput + left.tokensOutput));
  const totals = sumTokenUsage(porUsuario);
  const agentesPorProjeto = ((agentesResponse.data ?? []) as Array<{ id: string; projeto_id: string | null; nome: string | null; ativo: boolean | null }>)
    .filter((item) => item.projeto_id)
    .map((item) => ({
      id: item.id,
      projetoId: item.projeto_id!,
      nome: item.nome?.trim() || "Agente",
      ativo: item.ativo !== false,
    }))
    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));

  return {
    isAdmin: admin,
    tokensInput: totals.tokensInput,
    tokensOutput: totals.tokensOutput,
    custoTotal: totals.custoTotal,
    totalUsuarios: porUsuario.length,
    totalProjetos: porProjeto.length,
    porUsuario,
    porProjeto,
    porUsuarioProjeto,
    agentesPorProjeto,
  };
}

export async function getIaUsageSummary(projetoId?: string | null, range?: IaUsageRange): Promise<IaUsageSummary> {
  const supabase = getSupabaseAdminClient();
  const { startIso, endIso, startDate, endDate, label } = resolveRange(range);

  let chatsQuery = supabase
    .from("chats")
    .select("id, titulo, projeto_id, total_tokens, total_custo, created_at, updated_at, contexto")
    .order("updated_at", { ascending: false });

  if (projetoId) {
    chatsQuery = chatsQuery.eq("projeto_id", projetoId);
  }

  const { data: chatsData, error: chatsError } = await chatsQuery;

  if (chatsError || !chatsData) {
    console.error("[ia-usage] failed to list chats", chatsError);
    return {
      periodLabel: label,
      startDate,
      endDate,
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
  }

  const chats = chatsData as ChatUsageRow[];
  const chatMap = new Map(chats.map((chat) => [chat.id, chat]));
  const chatIds = chats.map((chat) => chat.id);

  if (chatIds.length === 0) {
    return {
      periodLabel: label,
      startDate,
      endDate,
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
  }

  const { data: messagesData, error: messagesError } = await supabase
    .from("mensagens")
    .select("id, chat_id, role, conteudo, tokens_input, tokens_output, custo, created_at")
    .in("chat_id", chatIds)
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: false });

  if (messagesError || !messagesData) {
    console.error("[ia-usage] failed to list messages", messagesError);
    return {
      periodLabel: label,
      startDate,
      endDate,
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
  }

  const messages = (messagesData as MessageUsageRow[]).filter((message) => message.chat_id);
  const processedMessages = messages.filter((message) => (message.tokens_input ?? 0) > 0 || (message.tokens_output ?? 0) > 0);

  const tokensInput = processedMessages.reduce((sum, message) => sum + (message.tokens_input ?? 0), 0);
  const tokensOutput = processedMessages.reduce((sum, message) => sum + (message.tokens_output ?? 0), 0);
  const totalCost = processedMessages.reduce((sum, message) => sum + resolveMessageCost(message), 0);
  const hasCostData = processedMessages.some((message) => resolveMessageCost(message) > 0);

  const perChat = new Map<string, ChatUsageAggregate>();
  for (const message of processedMessages) {
    const chatId = message.chat_id!;
    const chat = chatMap.get(chatId);
    const existing = perChat.get(chatId);
    const aggregate =
      existing ??
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
        updatedAt: chat?.updated_at ?? message.created_at ?? new Date().toISOString(),
      };

    aggregate.mensagens += 1;
    aggregate.tokensInput += message.tokens_input ?? 0;
    aggregate.tokensOutput += message.tokens_output ?? 0;
    aggregate.totalTokens += (message.tokens_input ?? 0) + (message.tokens_output ?? 0);
    aggregate.custo += resolveMessageCost(message);
    perChat.set(chatId, aggregate);
  }

  const topChats = [...perChat.values()].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 8);

  const perAgent = new Map<string, AgentUsageAggregate>();
  for (const chat of perChat.values()) {
    const agentName = chat.agenteNome ?? "Sem agente";
    const aggregate = perAgent.get(agentName) ?? {
      agenteNome: agentName,
      chats: 0,
      totalTokens: 0,
    };

    aggregate.chats += 1;
    aggregate.totalTokens += chat.totalTokens;
    perAgent.set(agentName, aggregate);
  }

  const topAgents = [...perAgent.values()].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 5);

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
    periodLabel: label.charAt(0).toUpperCase() + label.slice(1),
    startDate,
    endDate,
    costModel: getDefaultOpenAIModel(),
    costCurrency: "USD",
    tokensInput,
    tokensOutput,
    totalTokens: tokensInput + tokensOutput,
    totalCost,
    hasCostData,
    processedMessages: processedMessages.length,
    activeChats: perChat.size,
    activeAgents: perAgent.size,
    topChats,
    topAgents,
    recentActivity,
  };
}
