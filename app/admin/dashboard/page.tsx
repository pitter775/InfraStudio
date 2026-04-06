"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  BriefcaseBusiness,
  Coins,
  Layers3,
  MessageSquare,
  Sparkles,
  Users,
  Waypoints,
} from "lucide-react";
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

function MiniAreaChart({ values }: { values: number[] }) {
  if (!values.length || values.every((value) => value <= 0)) {
    return <div className="h-24 rounded-2xl border border-white/8 bg-white/[0.03]" />;
  }

  const width = 320;
  const height = 96;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - (value / max) * (height - 12) - 6;
    return `${x},${y}`;
  });

  const line = points.join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full overflow-visible">
      <defs>
        <linearGradient id="dashboard-area-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(56,189,248,0.38)" />
          <stop offset="100%" stopColor="rgba(56,189,248,0.02)" />
        </linearGradient>
      </defs>
      <path d={`M ${area}`} fill="url(#dashboard-area-fill)" />
      <polyline
        points={line}
        fill="none"
        stroke="rgba(103,232,249,0.95)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
      });
      setLoading(false);
    };

    void loadDashboard();
  }, []);

  const { usersCount, scope, userName, projetos, agentes, apis, widgets, chats, usage } = state;
  const activeProjects = projetos.filter((projeto) => projeto.status === "ativo").length;
  const totalChatTokens = chats.reduce((sum, chat) => sum + Number(chat.totalTokens ?? 0), 0);
  const totalChatCost = chats.reduce((sum, chat) => sum + Number(chat.totalCusto ?? 0), 0);
  const topChatSeries = (usage?.topChats ?? []).slice(0, 6).reverse().map((chat) => chat.totalTokens);

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

  return (
    <main className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="px-2 py-2">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200">
            <Activity size={13} />
            {scope === "global" ? "Dashboard" : "Meu dashboard"}
          </div>
          <h1 className="text-[2rem] font-extrabold tracking-tight text-white">
            {scope === "global" ? "Visão geral da operação" : `Visão geral de ${userName}`}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            {scope === "global"
              ? "Projetos, uso de IA, volume de chats e custo em uma leitura mais limpa, densa e menor."
              : "Um painel consolidado só com os projetos, chats e consumo de IA que fazem parte do seu contexto."}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {overviewCards.map((item) => {
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
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pulso de IA</p>
                <h2 className="mt-1 text-lg font-bold text-white">{usage?.periodLabel ?? "Mes atual"}</h2>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Mensagens</p>
                <p className="text-sm font-bold text-white">{formatInteger(usage?.processedMessages ?? 0)}</p>
              </div>
            </div>
            <MiniAreaChart values={topChatSeries} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="relative rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                <div className="pointer-events-none absolute right-3 top-3 text-cyan-200/20">
                  <Sparkles size={18} />
                </div>
                <p className="text-slate-500">Entrada</p>
                <p className="mt-1 font-bold text-white">{formatCompact(usage?.tokensInput ?? 0)}</p>
              </div>
              <div className="relative rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                <div className="pointer-events-none absolute right-3 top-3 text-indigo-200/20">
                  <Waypoints size={18} />
                </div>
                <p className="text-slate-500">Saída</p>
                <p className="mt-1 font-bold text-white">{formatCompact(usage?.tokensOutput ?? 0)}</p>
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
            <RingChart value={usage?.activeChats ?? 0} total={Math.max(chats.length, 1)} label="Chats com IA" accent="rgba(34,197,94,0.95)" icon={MessageSquare} />
            <RingChart value={activeProjects} total={Math.max(projetos.length, 1)} label="Projetos ativos" accent="rgba(251,191,36,0.95)" icon={BriefcaseBusiness} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Workspace</p>
              <h2 className="mt-1 text-lg font-bold text-white">Projetos e capacidade instalada</h2>
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

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
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

      <section className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Origens</p>
            <h2 className="mt-1 text-lg font-bold text-white">Consumo por canal e tipo de conversa</h2>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Top</p>
            <p className="text-sm font-bold text-white">{formatInteger(usage?.topOrigins.length ?? 0)} origens</p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {(usage?.topOrigins ?? []).slice(0, 4).map((origin) => (
            <div key={origin.origem} className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-3">
              <p className="text-sm font-bold text-white">{origin.label}</p>
              <p className="mt-2 text-xl font-extrabold text-white">{formatCompact(origin.totalTokens)}</p>
              <p className="mt-1 text-xs text-slate-400">{formatInteger(origin.mensagens)} mensagens</p>
              <p className="mt-2 text-[11px] text-emerald-300">
                {origin.custo > 0 ? formatCurrency(origin.custo, usage?.costCurrency ?? "USD") : "sem valor"}
              </p>
            </div>
          ))}

          {!(usage?.topOrigins ?? []).length && (
            <div className="rounded-[20px] border border-white/8 bg-slate-950/30 px-4 py-5 text-sm text-slate-400 lg:col-span-2 xl:col-span-4">
              Ainda nao ha consumo classificado por origem suficiente para este quadro.
            </div>
          )}
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
