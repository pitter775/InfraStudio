"use client";

import { useEffect, useState } from "react";
import { Bot, CalendarRange, Coins, MessageSquare, Sparkles, Waypoints } from "lucide-react";

type TopChat = {
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

type TopAgent = {
  agenteNome: string;
  chats: number;
  totalTokens: number;
};

type RecentActivity = {
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

type IaUsageSummary = {
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
  topChats: TopChat[];
  topAgents: TopAgent[];
  recentActivity: RecentActivity[];
};

function formatInteger(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatCurrency(value: number, currency: "USD" | "BRL" = "USD") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);
}

function formatTokensWithCost(tokens: number, cost?: number | null, currency: "USD" | "BRL" = "USD") {
  const label = `${formatInteger(tokens)} tokens`;
  if (!cost || cost <= 0) {
    return label;
  }

  return `${label} | ${formatCurrency(cost, currency)}`;
}

function summarizeTitle(value: string, max = 52) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) {
    return compact;
  }

  return `${compact.slice(0, max - 1).trimEnd()}...`;
}

function getDefaultMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export default function AdminIaTokensPage() {
  const defaultRange = getDefaultMonthRange();
  const [summary, setSummary] = useState<IaUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);

  const load = async (range?: { startDate: string; endDate: string }) => {
    const params = new URLSearchParams();
    params.set("startDate", range?.startDate ?? startDate);
    params.set("endDate", range?.endDate ?? endDate);

    setLoading(true);
    const response = await fetch(`/api/admin/ia-usage?${params.toString()}`);
    const payload = (await response.json()) as { summary?: IaUsageSummary };
    const nextSummary = payload.summary ?? null;
    setSummary(nextSummary);

    if (nextSummary) {
      setStartDate(nextSummary.startDate);
      setEndDate(nextSummary.endDate);
    }

    setLoading(false);
  };

  useEffect(() => {
    void load({ startDate: defaultRange.startDate, endDate: defaultRange.endDate });
  }, []);

  const stats = summary
    ? [
        {
          label: "Tokens do periodo",
          value: formatTokensWithCost(summary.totalTokens, summary.totalCost, summary.costCurrency),
          detail: summary.hasCostData
            ? `${formatInteger(summary.tokensInput)} entrada | ${formatInteger(summary.tokensOutput)} saida | ${formatCurrency(summary.totalCost, summary.costCurrency)}`
            : `${formatInteger(summary.tokensInput)} entrada | ${formatInteger(summary.tokensOutput)} saida`,
          icon: Sparkles,
        },
        {
          label: "Custo estimado",
          value: summary.hasCostData ? formatCurrency(summary.totalCost, summary.costCurrency) : "Pendente",
          detail: summary.hasCostData ? `Estimado com ${summary.costModel}` : "Ainda sem mensagens com consumo no intervalo",
          icon: Coins,
        },
        {
          label: "Mensagens processadas",
          value: formatInteger(summary.processedMessages),
          detail: `${formatInteger(summary.activeChats)} chats com uso no intervalo`,
          icon: MessageSquare,
        },
        {
          label: "Agentes com uso",
          value: formatInteger(summary.activeAgents),
          detail: "Ranking por consumo no filtro atual",
          icon: Bot,
        },
      ]
    : [];

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
          <Sparkles size={14} />
          IA Tokens
        </div>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-white">Consumo de IA da plataforma</h1>
            <p className="mt-4 max-w-3xl text-slate-400">
              Acompanhe o volume de tokens processados no chat, compare meses e filtre o intervalo que quiser.
            </p>
          </div>

          <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-200">Periodo ativo</p>
            <p className="mt-2 text-2xl font-extrabold text-white">{summary?.periodLabel ?? "Carregando..."}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
            <CalendarRange size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Filtrar intervalo</h2>
            <p className="text-sm text-slate-400">Escolha um periodo para comparar meses ou analisar um recorte especifico.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto]">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-300">De</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-blue-400/50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-300">Ate</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-blue-400/50"
            />
          </label>

          <button
            type="button"
            onClick={() => void load()}
            className="mt-auto rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Aplicar filtro
          </button>

          <button
            type="button"
            onClick={() => {
              setStartDate(defaultRange.startDate);
              setEndDate(defaultRange.endDate);
              void load(defaultRange);
            }}
            className="mt-auto rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
          >
            Mes atual
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {loading ? (
          <div className="col-span-full rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
            Carregando consumo de IA...
          </div>
        ) : null}

        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                <Icon size={20} />
              </div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
              <p className="mt-3 text-3xl font-extrabold text-white">{item.value}</p>
              <p className="mt-2 text-sm text-slate-400">{item.detail}</p>
            </div>
          );
        })}
      </section>

      {summary ? (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Total geral no periodo</p>
            <p className="mt-3 text-3xl font-extrabold text-white">{formatTokensWithCost(summary.totalTokens, summary.totalCost, summary.costCurrency)}</p>
            <p className="mt-2 text-sm text-cyan-50">
              Entre {summary.startDate.split("-").reverse().join("/")} e {summary.endDate.split("-").reverse().join("/")}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Distribuicao</p>
            <p className="mt-3 text-lg font-bold text-white">
              {formatInteger(summary.tokensInput)} entrada | {formatInteger(summary.tokensOutput)} saida
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {formatInteger(summary.processedMessages)} mensagens processadas em {formatInteger(summary.activeChats)} chats.
            </p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-2xl font-bold text-white">Conversas com maior consumo</h2>
            <p className="mt-1 text-sm text-slate-400">Ranking do intervalo com base nos tokens processados por chat.</p>
          </div>

          <div className="divide-y divide-white/8">
            {summary?.topChats.length ? (
              summary.topChats.map((chat, index) => (
                <div key={chat.chatId} className="grid gap-4 px-6 py-5 md:grid-cols-[48px_minmax(0,1.3fr)_180px_140px] md:items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-lg font-extrabold text-orange-200">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white" title={chat.titulo}>
                      {summarizeTitle(chat.titulo)}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Lead: {chat.leadNome ?? "Nao identificado"} | Agente: {chat.agenteNome ?? "Sem agente"}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {chat.projetoNome ?? "Sem projeto"} | {chat.mensagens} mensagens com token
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total tokens</p>
                    <p className="mt-2 text-xl font-bold text-white">{formatInteger(chat.totalTokens)}</p>
                    <p className="mt-1 text-xs text-emerald-300">
                      {chat.custo > 0 ? formatCurrency(chat.custo, summary.costCurrency) : "Sem valor monetario salvo"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      In {formatInteger(chat.tokensInput)} / Out {formatInteger(chat.tokensOutput)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Atualizado</p>
                    <p className="mt-2 text-sm font-semibold text-white">{new Date(chat.updatedAt).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-sm text-slate-400">Nenhum consumo de IA encontrado no intervalo atual.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-2xl font-bold text-white">Agentes com maior uso</h2>
              <p className="mt-1 text-sm text-slate-400">Consumo agregado por agente no intervalo.</p>
            </div>

            <div className="space-y-3 p-5">
              {summary?.topAgents.length ? (
                summary.topAgents.map((agent) => (
                  <div key={agent.agenteNome} className="rounded-2xl border border-white/8 bg-slate-950/30 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">{agent.agenteNome}</p>
                        <p className="mt-1 text-sm text-slate-400">{formatInteger(agent.chats)} chats com consumo</p>
                      </div>
                      <p className="text-lg font-extrabold text-white">{formatInteger(agent.totalTokens)} tokens</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">Ainda nao ha agentes com mensagens tokenizadas neste intervalo.</p>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-200">
                  <Waypoints size={20} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Atividade recente</h2>
                  <p className="mt-1 text-sm text-slate-400">Mensagens mais recentes que consumiram tokens no intervalo.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-5">
              {summary?.recentActivity.length ? (
                summary.recentActivity.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/8 bg-slate-950/30 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">{item.titulo}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {item.leadNome ?? "Lead nao identificado"} | {item.agenteNome ?? "Sem agente"}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {item.role} | {new Date(item.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold text-white">{formatInteger(item.totalTokens)} tokens</p>
                        <p className="mt-1 text-xs text-emerald-300">
                          {item.custo > 0 ? formatCurrency(item.custo, summary.costCurrency) : "Sem valor monetario salvo"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          In {formatInteger(item.tokensInput)} / Out {formatInteger(item.tokensOutput)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">Sem atividade recente com consumo de IA neste intervalo.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
