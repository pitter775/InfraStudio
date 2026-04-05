"use client";

import { ChevronRight, Coins, Eye, Plus, RefreshCw } from "lucide-react";
import { formatCurrency, formatNumber, getUsageProgressValue } from "./billing-helpers";

export type ProjectUsageListItem = {
  projetoId: string;
  projetoNome: string;
  plano: {
    nomePlano: string;
    limiteTokensTotalMensal: number | null;
    permitirExcedente?: boolean;
    bloqueado?: boolean;
  };
  consumoAtual: {
    totalTokens: number;
    custoTotal: number;
  };
  percentualUso: number | null;
  status: "ativo" | "bloqueado";
  cicloAtual?: {
    alerta80?: boolean;
    alerta100?: boolean;
    bloqueado?: boolean;
    permitirExcedente?: boolean;
    excedenteTokens?: number;
  } | null;
};

function resolveProjectStatus(item: ProjectUsageListItem) {
  if (item.status === "bloqueado" || item.cicloAtual?.bloqueado || item.plano.bloqueado) {
    return {
      label: "bloqueado",
      tone: "bg-rose-500",
      badge: "bg-rose-500/15 text-rose-200",
    };
  }

  if ((item.cicloAtual?.permitirExcedente || item.plano.permitirExcedente) && (item.cicloAtual?.excedenteTokens ?? 0) > 0) {
    return {
      label: "excedente",
      tone: "bg-sky-500",
      badge: "bg-sky-500/15 text-sky-200",
    };
  }

  if (item.cicloAtual?.alerta100 || (item.percentualUso ?? 0) >= 100) {
    return {
      label: "acima do limite",
      tone: "bg-orange-500",
      badge: "bg-orange-500/15 text-orange-200",
    };
  }

  if (item.cicloAtual?.alerta80 || (item.percentualUso ?? 0) >= 80) {
    return {
      label: "alerta 80",
      tone: "bg-amber-400",
      badge: "bg-amber-400/15 text-amber-100",
    };
  }

  return {
    label: "normal",
    tone: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-200",
  };
}

type ProjectUsageListProps = {
  rows: ProjectUsageListItem[];
  loading: boolean;
};

export function ProjectUsageList({ rows, loading }: ProjectUsageListProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Projetos</h2>
          <p className="mt-1 text-sm text-slate-400">Uso atual, status operacional e acoes rapidas.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white/[0.04]">
        {loading ? <div className="px-5 py-5 text-sm text-slate-400">Carregando projetos...</div> : null}
        {!loading && !rows.length ? <div className="px-5 py-5 text-sm text-slate-400">Nenhum projeto encontrado.</div> : null}

        {!loading ? (
          <div className="divide-y divide-white/8">
            {rows.map((item) => {
              const status = resolveProjectStatus(item);
              const progressValue = getUsageProgressValue(item.percentualUso);
              const tokenLimitLabel =
                item.plano.limiteTokensTotalMensal === null ? "sem limite" : formatNumber(item.plano.limiteTokensTotalMensal);

              return (
                <article key={item.projetoId} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(220px,0.9fr)_auto] lg:items-center">
                  <div className="flex gap-4">
                    <div className={`mt-1 h-auto min-h-16 w-1.5 rounded-full ${status.tone}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-white">{item.projetoNome}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${status.badge}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                        <span>Plano: {item.plano.nomePlano}</span>
                        <span>{formatCurrency(item.consumoAtual.custoTotal)}</span>
                        {item.cicloAtual?.excedenteTokens ? <span>Excedente: {formatNumber(item.cicloAtual.excedenteTokens)}</span> : null}
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-300">
                            {formatNumber(item.consumoAtual.totalTokens)} / {tokenLimitLabel} tokens
                          </span>
                          <span className="font-medium text-white">{item.percentualUso === null ? "ilimitado" : `${Math.round(item.percentualUso)}%`}</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
                          <div
                            className={`h-full rounded-full transition-all ${status.tone}`}
                            style={{ width: `${progressValue}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2 lg:grid-cols-1">
                    <div className="flex items-center gap-2">
                      <Coins size={14} className="text-slate-500" />
                      <span>Custo atual: {formatCurrency(item.consumoAtual.custoTotal)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronRight size={14} className="text-slate-500" />
                      <span>Limite: {tokenLimitLabel}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button type="button" className="rounded-2xl bg-white/6 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10">
                      <RefreshCw size={14} className="mr-2 inline-block" />
                      Trocar plano
                    </button>
                    <button type="button" className="rounded-2xl bg-white/6 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10">
                      <Plus size={14} className="mr-2 inline-block" />
                      Adicionar tokens
                    </button>
                    <button type="button" className="rounded-2xl bg-white/6 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10">
                      <Eye size={14} className="mr-2 inline-block" />
                      Ver detalhes
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
