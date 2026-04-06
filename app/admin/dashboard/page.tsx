"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  BriefcaseBusiness,
  CircleAlert,
  Coins,
  Layers3,
  MessageSquare,
  ShieldCheck,
  ShieldX,
  Sparkles,
  TriangleAlert,
  Users,
  Waypoints,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getCurrentProjectUser } from "@/lib/auth";
import type { IaUsageSummary } from "@/lib/ia-usage-types";

type Projeto = {
  id: string;
  nome: string;
  slug: string | null;
  tipo: string | null;
  descricao: string;
  status: string;
};

type Agente = {
  id: string;
  projetoId: string | null;
};

type Api = {
  id: string;
  projetoId: string | null;
};

type ChatWidget = {
  id?: string;
  projetoId: string | null;
};

type ChatRecord = {
  id: string;
  titulo: string;
  totalTokens: number;
  totalCusto: number;
  projetoId: string | null;
  updatedAt: string;
  canal?: string | null;
};

type DashboardState = {
  usersCount: number;
  scope: "global" | "user";
  userName: string;
  projetos: Projeto[];
  agentes: Agente[];
  apis: Api[];
  widgets: ChatWidget[];
  chats: ChatRecord[];
  usage: IaUsageSummary | null;
  projection: {
    averageDailyTokens: number;
    daysUntilLimit: number | null;
    remainingCycleDays: number;
    remainingTokens: number | null;
    limitedProjects: number;
  } | null;
  globalStatus: {
    tone: "ok" | "attention" | "critical" | "blocked";
    label: string;
    detail: string;
    affectedProjects: number;
    usagePercent: number | null;
  };
  channelUsage: Array<{
    canal: string;
    label: string;
    totalTokens: number;
    totalChats: number;
  }>;
};

function formatInteger(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number, currency: "BRL" | "USD" = "USD") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeTitle(value: string, max = 34) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) {
    return compact;
  }

  return `${compact.slice(0, max - 1).trimEnd()}...`;
}

function formatChartTokens(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  return formatInteger(value);
}

function DailyUsageChart({ usage }: { usage: IaUsageSummary | null }) {
  const data = usage?.dailyUsage ?? [];
  const hasUsage = data.some((item) => item.totalTokens > 0);

  if (!hasUsage) {
    return <div className="h-[280px] rounded-[24px] border border-white/8 bg-white/[0.03]" />;
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="dashboardTokensStroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(148,163,184,0.85)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={formatChartTokens}
            tick={{ fill: "rgba(148,163,184,0.85)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: "rgba(34,211,238,0.2)", strokeWidth: 1 }}
            contentStyle={{
              borderRadius: "18px",
              border: "1px solid rgba(255,255,255,0.08)",
              backgroundColor: "rgba(2,6,23,0.94)",
              color: "#fff",
            }}
            formatter={(value, name) => {
              const numericValue = Number(value ?? 0);
              return [
                name === "cost" ? formatCurrency(numericValue, usage?.costCurrency ?? "USD") : `${formatInteger(numericValue)} tokens`,
                name === "cost" ? "Custo" : "Tokens",
              ];
            }}
            labelFormatter={(label) => `Dia ${label}`}
          />
          <Line
            type="monotone"
            dataKey="totalTokens"
            name="tokens"
            stroke="url(#dashboardTokensStroke)"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 4, fill: "#67e8f9", stroke: "#082f49", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChannelUsageChart({
  data,
  currency,
}: {
  data: Array<{ canal: string; label: string; totalTokens: number; totalChats: number }>;
  currency: "BRL" | "USD";
}) {
  if (!data.length) {
    return <div className="h-[220px] rounded-[24px] border border-white/8 bg-white/[0.03]" />;
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "rgba(148,163,184,0.85)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={formatChartTokens} tick={{ fill: "rgba(148,163,184,0.85)", fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.02)" }}
            contentStyle={{
              borderRadius: "18px",
              border: "1px solid rgba(255,255,255,0.08)",
              backgroundColor: "rgba(2,6,23,0.94)",
              color: "#fff",
            }}
            formatter={(value, name, item) => {
              const numericValue = Number(value ?? 0);
              if (name === "totalTokens") {
                return [`${formatInteger(numericValue)} tokens`, "Tokens"];
              }

              return [formatCurrency(numericValue, currency), item.payload.label];
            }}
          />
          <Bar dataKey="totalTokens" radius={[10, 10, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.canal}
                fill={entry.canal === "whatsapp" ? "#22c55e" : entry.canal === "web" ? "#38bdf8" : entry.canal === "api" ? "#f59e0b" : "#a78bfa"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RingChart({
  value,
  total,
  label,
  accent,
  icon: Icon,
}: {
  value: number;
  total: number;
  label: string;
  accent: string;
  icon: typeof Bot;
}) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const safeTotal = Math.max(total, 1);
  const ratio = Math.max(0, Math.min(value / safeTotal, 1));
  const dashOffset = circumference * (1 - ratio);

  return (
    <div className="relative flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
      <div className="pointer-events-none absolute right-4 top-4 text-slate-600/70">
        <Icon size={24} />
      </div>
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 72 72" className="h-16 w-16 -rotate-90">
          <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke={accent}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">
          {Math.round(ratio * 100)}%
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <p className="mt-1 text-sm font-bold text-white">{formatInteger(value)}</p>
        <p className="text-xs text-slate-400">de {formatInteger(total)}</p>
      </div>
    </div>
  );
}

function FocusProjectCard({
  project,
  totalProjects,
}: {
  project: {
    id: string;
    nome: string;
    status: string;
    totalAgentes: number;
    totalApis: number;
    totalWidgets: number;
    totalChats: number;
    totalTokens: number;
  } | null;
  totalProjects: number;
}) {
  if (!project) {
    return null;
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-gradient-to-br from-cyan-500/10 via-slate-950/30 to-blue-500/10 p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
        {totalProjects <= 1 ? "Seu projeto" : "Projeto em foco"}
      </p>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-bold text-white">{project.nome}</h3>
          <p className="mt-1 text-sm text-slate-400">{project.status}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.05] px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Consumo</p>
          <p className="text-sm font-bold text-white">{formatCompact(project.totalTokens)}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Chats</p>
          <p className="mt-1 text-lg font-bold text-white">{formatInteger(project.totalChats)}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Agentes</p>
          <p className="mt-1 text-lg font-bold text-white">{formatInteger(project.totalAgentes)}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">APIs</p>
          <p className="mt-1 text-lg font-bold text-white">{formatInteger(project.totalApis)}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Widgets</p>
          <p className="mt-1 text-lg font-bold text-white">{formatInteger(project.totalWidgets)}</p>
        </div>
      </div>
    </div>
  );
}

function BaseSummaryPanel({
  agentes,
  apis,
  widgets,
  chats,
  totalChatTokens,
  averageTokensPerChat,
}: {
  agentes: number;
  apis: number;
  widgets: number;
  chats: number;
  totalChatTokens: number;
  averageTokensPerChat: number;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/18 to-cyan-400/10 text-cyan-100">
          <Layers3 size={18} />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Base consolidada</p>
          <h2 className="mt-1 text-lg font-bold text-white">Resumo rapido</h2>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-white/8 bg-slate-950/30 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Recursos</p>
          <p className="mt-1 text-lg font-bold text-white">{formatInteger(agentes + apis + widgets)}</p>
          <p className="mt-1 text-xs text-slate-400">{formatInteger(agentes)} agentes | {formatInteger(apis)} APIs | {formatInteger(widgets)} widgets</p>
        </div>
        <div className="rounded-[18px] border border-white/8 bg-slate-950/30 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Historico</p>
          <p className="mt-1 text-lg font-bold text-white">{formatInteger(chats)}</p>
          <p className="mt-1 text-xs text-slate-400">{formatCompact(totalChatTokens)} tokens acumulados</p>
        </div>
        <div className="rounded-[18px] border border-white/8 bg-slate-950/30 px-4 py-3 sm:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Media por chat</p>
              <p className="mt-1 text-lg font-bold text-white">{formatInteger(averageTokensPerChat)}</p>
            </div>
            <p className="text-xs text-slate-400">tokens no periodo filtrado</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<DashboardState>({
    usersCount: 0,
    scope: "user",
    userName: "",
    projetos: [],
    agentes: [],
    apis: [],
    widgets: [],
    chats: [],
    usage: null,
    projection: null,
    globalStatus: {
      tone: "ok",
      label: "Tudo ok",
      detail: "",
      affectedProjects: 0,
      usagePercent: null,
    },
    channelUsage: [],
  });

  useEffect(() => {
    const loadDashboard = async () => {
      const currentUser = await getCurrentProjectUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      if (!response.ok) {
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as Partial<DashboardState>;
      setState({
        usersCount: payload.usersCount ?? 0,
        scope: payload.scope ?? (currentUser.role === "admin" ? "global" : "user"),
        userName: payload.userName ?? currentUser.name,
        projetos: payload.projetos ?? [],
        agentes: payload.agentes ?? [],
        apis: payload.apis ?? [],
        widgets: payload.widgets ?? [],
        chats: payload.chats ?? [],
        usage: payload.usage ?? null,
        projection: payload.projection ?? null,
        globalStatus: payload.globalStatus ?? {
          tone: "ok",
          label: "Tudo ok",
          detail: "",
          affectedProjects: 0,
          usagePercent: null,
        },
        channelUsage: payload.channelUsage ?? [],
      });
      setLoading(false);
    };

    void loadDashboard();
  }, []);

  const { usersCount, scope, userName, projetos, agentes, apis, widgets, chats, usage, projection, globalStatus, channelUsage } = state;
  const activeProjects = projetos.filter((projeto) => projeto.status === "ativo").length;
  const totalChatTokens = chats.reduce((sum, chat) => sum + Number(chat.totalTokens ?? 0), 0);
  const totalChatCost = chats.reduce((sum, chat) => sum + Number(chat.totalCusto ?? 0), 0);
  const peakDailyTokens = Math.max(...(usage?.dailyUsage ?? []).map((item) => item.totalTokens), 0);
  const latestDailyUsage = [...(usage?.dailyUsage ?? [])].reverse().find((item) => item.totalTokens > 0) ?? null;
  const isCompactUserView = scope === "user" && projetos.length <= 2;

  const projectRows = projetos
    .map((projeto) => {
      const totalAgentes = agentes.filter((agente) => agente.projetoId === projeto.id).length;
      const totalApis = apis.filter((api) => api.projetoId === projeto.id).length;
      const totalWidgets = widgets.filter((widget) => widget.projetoId === projeto.id).length;
      const totalChats = chats.filter((chat) => chat.projetoId === projeto.id).length;
      const totalTokens = chats
        .filter((chat) => chat.projetoId === projeto.id)
        .reduce((sum, chat) => sum + Number(chat.totalTokens ?? 0), 0);

      return {
        id: projeto.id,
        nome: projeto.nome,
        status: projeto.status,
        totalAgentes,
        totalApis,
        totalWidgets,
        totalChats,
        totalTokens,
      };
    })
    .sort((left, right) => right.totalTokens - left.totalTokens || right.totalChats - left.totalChats)
    .slice(0, 5);

  const maxProjectTokens = Math.max(...projectRows.map((item) => item.totalTokens), 1);
  const maxTopChatTokens = Math.max(...(usage?.topChats ?? []).map((chat) => chat.totalTokens), 1);
  const maxTopAgentTokens = Math.max(...(usage?.topAgents ?? []).map((item) => item.totalTokens), 1);
  const focusProject = projectRows[0] ?? null;
  const averageTokensPerChat = usage?.activeChats ? Math.round((usage.totalTokens || 0) / usage.activeChats) : 0;
  const statusTone =
    globalStatus.tone === "ok"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : globalStatus.tone === "attention"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
        : globalStatus.tone === "critical"
          ? "border-orange-400/20 bg-orange-400/10 text-orange-200"
          : "border-rose-400/20 bg-rose-400/10 text-rose-200";
  const statusIcon =
    globalStatus.tone === "ok"
      ? ShieldCheck
      : globalStatus.tone === "attention"
        ? CircleAlert
        : globalStatus.tone === "critical"
          ? TriangleAlert
          : ShieldX;
  const GlobalStatusIcon = statusIcon;

  const overviewCards = [
    {
      label: "Projetos",
      value: formatInteger(projetos.length),
      detail: `${formatInteger(activeProjects)} ativos`,
      icon: BriefcaseBusiness,
      tone: "text-cyan-200",
    },
    {
      label: "Usuários",
      value: formatInteger(usersCount),
      detail: scope === "global" ? "Equipe com acesso" : "Contexto dos seus projetos",
      icon: Users,
      tone: "text-emerald-200",
    },
    {
      label: "Chats",
      value: formatInteger(chats.length),
      detail: `${formatInteger(usage?.activeChats ?? 0)} com IA no periodo`,
      icon: MessageSquare,
      tone: "text-orange-200",
    },
    {
      label: "Tokens",
      value: formatCompact(usage?.totalTokens ?? totalChatTokens),
      detail: usage ? `${usage.periodLabel}` : "Histórico geral",
      icon: Sparkles,
      tone: "text-fuchsia-200",
    },
    {
      label: "Custo",
      value: formatCurrency(usage?.totalCost ?? totalChatCost, usage?.costCurrency ?? "USD"),
      detail: usage?.hasCostData ? `Estimado em ${usage?.costModel ?? "gpt-4o-mini"}` : "Sem custo calculado",
      icon: Coins,
      tone: "text-lime-200",
    },
    {
      label: "Agentes",
      value: formatInteger(agentes.length),
      detail: `${formatInteger(widgets.length)} widgets | ${formatInteger(apis.length)} APIs`,
      icon: Bot,
      tone: "text-indigo-200",
    },
  ];
  const visibleOverviewCards = isCompactUserView ? overviewCards.filter((item) => ["Chats", "Tokens", "Custo", "Agentes"].includes(item.label)) : overviewCards;

  return (
    <main className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="px-2 py-2">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200">
            <Activity size={13} />
            {scope === "global" ? "Dashboard" : "Meu dashboard"}
          </div>
          <div className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${statusTone}`}>
            <GlobalStatusIcon size={13} />
            {globalStatus.label}
          </div>
          <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-white sm:text-[2.15rem]">
            {scope === "global" ? "Visão geral da operação" : `Visão geral de ${userName}`}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            {scope === "global"
              ? "Projetos, uso de IA, volume de chats e custo em uma leitura mais limpa, densa e menor."
              : "Um painel consolidado só com os projetos, chats e consumo de IA que fazem parte do seu contexto."}
          </p>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">{globalStatus.detail}</span>
            {globalStatus.usagePercent !== null ? (
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">pico {Math.round(globalStatus.usagePercent)}%</span>
            ) : null}
            {globalStatus.affectedProjects > 0 ? (
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">{globalStatus.affectedProjects} projeto(s)</span>
            ) : null}
          </div>

          <div className={`mt-5 grid gap-3 ${isCompactUserView ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
            {visibleOverviewCards.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label} className="relative rounded-[20px] border border-white/8 bg-white/[0.04] p-4 shadow-[0_18px_36px_rgba(2,8,23,0.18)]">
                  <div className={`pointer-events-none absolute right-4 top-4 ${item.tone} opacity-20`}>
                    <Icon size={30} />
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-extrabold text-white">{item.value}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Tendencia de consumo</p>
                <h2 className="mt-1 text-lg font-bold text-white">Tokens por dia</h2>
                <p className="mt-1 text-xs text-slate-400">{usage?.periodLabel ?? "Mes atual"}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Pico diario</p>
                <p className="text-sm font-bold text-white">{formatCompact(peakDailyTokens)}</p>
              </div>
            </div>
            <DailyUsageChart usage={usage} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="relative rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                <div className="pointer-events-none absolute right-3 top-3 text-cyan-200/20">
                  <Sparkles size={18} />
                </div>
                <p className="text-slate-500">Ultimo dia</p>
                <p className="mt-1 font-bold text-white">{formatCompact(latestDailyUsage?.totalTokens ?? 0)}</p>
              </div>
              <div className="relative rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                <div className="pointer-events-none absolute right-3 top-3 text-indigo-200/20">
                  <Waypoints size={18} />
                </div>
                <p className="text-slate-500">Mensagens</p>
                <p className="mt-1 font-bold text-white">{formatInteger(usage?.processedMessages ?? 0)}</p>
              </div>
              <div className="relative rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                <div className="pointer-events-none absolute right-3 top-3 text-emerald-200/20">
                  <Coins size={18} />
                </div>
                <p className="text-slate-500">Custo</p>
                <p className="mt-1 font-bold text-white">{formatCurrency(usage?.totalCost ?? 0, usage?.costCurrency ?? "USD")}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Projecao</p>
              <h3 className="mt-1 text-base font-bold text-white">Ritmo do ciclo atual</h3>
              <p className="mt-3 text-2xl font-extrabold text-white">{formatCompact(Math.round(projection?.averageDailyTokens ?? 0))}</p>
              <p className="mt-1 text-xs text-slate-400">tokens por dia em media</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Previsao</span>
                  <span className="font-semibold text-white">
                    {projection?.daysUntilLimit === null
                      ? "sem limite"
                      : `~${projection?.daysUntilLimit ?? 0} dias`}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Saldo</span>
                  <span className="font-semibold text-white">
                    {projection?.remainingTokens === null ? "livre" : formatCompact(projection?.remainingTokens ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Ciclo</span>
                  <span className="font-semibold text-white">{projection?.remainingCycleDays ?? 0} dias restantes</span>
                </div>
              </div>
            </div>
            <RingChart value={activeProjects} total={Math.max(projetos.length, 1)} label="Projetos ativos" accent="rgba(251,191,36,0.95)" icon={BriefcaseBusiness} />
          </div>
        </div>
      </section>

      {!isCompactUserView ? (
        <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <BaseSummaryPanel
            agentes={agentes.length}
            apis={apis.length}
            widgets={widgets.length}
            chats={chats.length}
            totalChatTokens={totalChatTokens}
            averageTokensPerChat={averageTokensPerChat}
          />

          <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Canais</p>
                <h2 className="mt-1 text-lg font-bold text-white">Consumo por canal</h2>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Top</p>
                <p className="text-sm font-bold text-white">{formatInteger(channelUsage.length)} canais</p>
              </div>
            </div>
            <ChannelUsageChart data={channelUsage} currency={usage?.costCurrency ?? "USD"} />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {channelUsage.map((channel) => (
                <div key={channel.canal} className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-3">
                  <p className="text-sm font-bold text-white">{channel.label}</p>
                  <p className="mt-2 text-lg font-extrabold text-white">{formatCompact(channel.totalTokens)}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatInteger(channel.totalChats)} chats</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        {isCompactUserView ? (
          <div className="xl:col-span-2">
            <FocusProjectCard project={focusProject} totalProjects={projetos.length} />
          </div>
        ) : null}

        <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Ranking</p>
              <h2 className="mt-1 text-lg font-bold text-white">Top projetos por consumo</h2>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Estrutura</p>
              <p className="text-sm font-bold text-white">
                {formatInteger(agentes.length)} ag. | {formatInteger(apis.length)} APIs
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {projectRows.map((project) => (
              <div key={project.id} className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{project.nome}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{project.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{formatCompact(project.totalTokens)}</p>
                    <p className="text-[11px] text-slate-400">{formatInteger(project.totalChats)} chats</p>
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                    style={{ width: `${Math.max((project.totalTokens / maxProjectTokens) * 100, project.totalTokens > 0 ? 10 : 0)}%` }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                  <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1">{project.totalAgentes} agentes</span>
                  <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1">{project.totalApis} APIs</span>
                  <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1">{project.totalWidgets} widgets</span>
                </div>
              </div>
            ))}

            {!projectRows.length && (
              <div className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-5 text-sm text-slate-400">
                Nenhum projeto com dados suficientes para consolidar no dashboard.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Consumo</p>
              <h2 className="mt-1 text-lg font-bold text-white">Chats com mais peso em IA</h2>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Top</p>
              <p className="text-sm font-bold text-white">{formatInteger(usage?.topChats.length ?? 0)} chats</p>
            </div>
          </div>

          <div className="space-y-3">
            {(usage?.topChats ?? []).slice(0, 5).map((chat) => (
              <div key={chat.chatId} className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{summarizeTitle(chat.titulo)}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {chat.projetoNome ?? "Sem projeto"} | {chat.agenteNome ?? "Sem agente"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{formatCompact(chat.totalTokens)}</p>
                    <p className="text-[11px] text-emerald-300">{chat.custo > 0 ? formatCurrency(chat.custo, usage?.costCurrency ?? "USD") : "sem valor"}</p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-400"
                    style={{ width: `${Math.max((chat.totalTokens / maxTopChatTokens) * 100, chat.totalTokens > 0 ? 12 : 0)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>In {formatInteger(chat.tokensInput)} / Out {formatInteger(chat.tokensOutput)}</span>
                  <span>{formatDateTime(chat.updatedAt)}</span>
                </div>
              </div>
            ))}

            {!(usage?.topChats ?? []).length && (
              <div className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-5 text-sm text-slate-400">
                Ainda não há chats com consumo de IA para montar este ranking.
              </div>
            )}
          </div>
        </div>
      </section>

      {!isCompactUserView ? (
      <section className="grid gap-4 xl:grid-cols-[1fr]">
        <div className="hidden rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/18 to-cyan-400/10 text-cyan-100">
              <Layers3 size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Distribuicao</p>
              <h2 className="mt-1 text-lg font-bold text-white">Base consolidada</h2>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recursos</p>
              <p className="mt-2 text-lg font-bold text-white">{formatInteger(agentes.length + apis.length + widgets.length)}</p>
              <p className="mt-1 text-xs text-slate-400">
                {formatInteger(agentes.length)} agentes | {formatInteger(apis.length)} APIs | {formatInteger(widgets.length)} widgets
              </p>
            </div>
            <div className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Histórico de chats</p>
              <p className="mt-2 text-lg font-bold text-white">{formatInteger(chats.length)}</p>
              <p className="mt-1 text-xs text-slate-400">{formatCompact(totalChatTokens)} tokens acumulados</p>
            </div>
            <div className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Média por chat</p>
              <p className="mt-2 text-lg font-bold text-white">
                {formatInteger(usage?.activeChats ? Math.round((usage.totalTokens || 0) / usage.activeChats) : 0)}
              </p>
              <p className="mt-1 text-xs text-slate-400">tokens no periodo filtrado</p>
            </div>
            <div className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Usuários com acesso</p>
              <p className="mt-2 text-lg font-bold text-white">{formatInteger(usersCount)}</p>
              <p className="mt-1 text-xs text-slate-400">{scope === "global" ? "visão administrativa geral" : "base relacionada aos seus projetos"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/18 to-amber-400/10 text-orange-100">
              <Waypoints size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Atividade recente</p>
              <h2 className="mt-1 text-lg font-bold text-white">Últimas mensagens com consumo</h2>
            </div>
          </div>

          <div className="space-y-3">
            {(usage?.recentActivity ?? []).slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{summarizeTitle(item.titulo, 42)}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.leadNome ?? "Lead não identificado"} | {item.agenteNome ?? "Sem agente"}
                  </p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    {item.role} | {formatDateTime(item.createdAt)}
                  </p>
                  <p className="mt-2 text-[11px] text-cyan-200">{item.origemLabel ?? "Sem classificacao"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{formatCompact(item.totalTokens)}</p>
                  <p className="mt-1 text-[11px] text-emerald-300">{item.custo > 0 ? formatCurrency(item.custo, usage?.costCurrency ?? "USD") : "sem valor"}</p>
                </div>
              </div>
            ))}

            {!(usage?.recentActivity ?? []).length && (
              <div className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-5 text-sm text-slate-400">
                Nenhuma atividade recente com consumo de IA neste intervalo.
              </div>
            )}
          </div>
        </div>
      </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr]">
        <div className="hidden rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Canais</p>
              <h2 className="mt-1 text-lg font-bold text-white">Consumo por canal</h2>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Top</p>
              <p className="text-sm font-bold text-white">{formatInteger(channelUsage.length)} canais</p>
            </div>
          </div>
          <ChannelUsageChart data={channelUsage} currency={usage?.costCurrency ?? "USD"} />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {channelUsage.map((channel) => (
              <div key={channel.canal} className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-3">
                <p className="text-sm font-bold text-white">{channel.label}</p>
                <p className="mt-2 text-lg font-extrabold text-white">{formatCompact(channel.totalTokens)}</p>
                <p className="mt-1 text-xs text-slate-400">{formatInteger(channel.totalChats)} chats</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-[24px] border border-white/10 bg-white/[0.05] p-4 ${isCompactUserView ? "hidden" : ""}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Agentes</p>
              <h2 className="mt-1 text-lg font-bold text-white">Top agentes</h2>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Top</p>
              <p className="text-sm font-bold text-white">{formatInteger(usage?.topAgents.length ?? 0)} agentes</p>
            </div>
          </div>
          <div className="space-y-3">
            {(usage?.topAgents ?? []).slice(0, 5).map((agent) => {
              return (
                <div key={agent.agenteNome} className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{agent.agenteNome}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatInteger(agent.chats)} chats no periodo</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{formatCompact(agent.totalTokens)}</p>
                      <p className="text-[11px] text-slate-400">tokens</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                      style={{ width: `${Math.max((agent.totalTokens / maxTopAgentTokens) * 100, agent.totalTokens > 0 ? 12 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {!(usage?.topAgents ?? []).length && (
              <div className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-5 text-sm text-slate-400">
                Ainda nao ha agentes com consumo suficiente para ranking.
              </div>
            )}
          </div>
        </div>
      </section>

      {loading ? (
        <section className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-400">
          Carregando dados consolidados do dashboard...
        </section>
      ) : null}
    </main>
  );
}
