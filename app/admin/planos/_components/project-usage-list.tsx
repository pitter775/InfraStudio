"use client";

import { ChevronRight, Coins } from "lucide-react";
import { formatCurrency, formatNumber, getUsageProgressValue } from "./billing-helpers";
import type { PlanListItem } from "./plans-list";

export type ProjectUsageListItem = {
  projetoId: string;
  projetoNome: string;
  modoCobranca: "plano" | "manual" | "ilimitado";
  plano: {
    nomePlano: string;
    limiteTokensTotalMensal: number | null;
    limiteCustoMensal?: number | null;
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
  planos: PlanListItem[];
  unlimitedPlanId: string;
  loading: boolean;
  updatingProjetoId: string | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onChangePlano: (projetoId: string, planoId: string) => void;
};

export function ProjectUsageList({
  rows,
  planos,
  unlimitedPlanId,
  loading,
  updatingProjetoId,
  searchValue,
  onSearchChange,
  onChangePlano,
}: ProjectUsageListProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Projetos</h2>
          <p className="mt-1 text-sm text-slate-400">Nome, plano, uso, tokens, custo e status.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/8 bg-white/[0.04] p-3">
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar projeto"
          className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/8 bg-white/[0.04]">
        {loading ? <div className="px-5 py-5 text-sm text-slate-400">Carregando projetos...</div> : null}
        {!loading && !rows.length ? <div className="px-5 py-5 text-sm text-slate-400">Nenhum projeto encontrado.</div> : null}

        {!loading ? (
          <div className="divide-y divide-white/8">
            {rows.map((item) => {
              const status = resolveProjectStatus(item);
              const progressValue = getUsageProgressValue(item.percentualUso);
              const tokenLimitLabel =
                item.plano.limiteTokensTotalMensal === null ? "sem limite" : formatNumber(item.plano.limiteTokensTotalMensal);
              const currentPlanId =
                item.modoCobranca === "ilimitado"
                  ? unlimitedPlanId
                  : planos.find((plano) => plano.nome === item.plano.nomePlano)?.id ?? unlimitedPlanId;

              return (
                <article
                  key={item.projetoId}
                  className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.2fr)_220px_170px] lg:items-center"
                >
                  <div className="flex gap-3">
                    <div className={`mt-1 h-auto min-h-12 w-1 rounded-full ${status.tone} sm:w-1.5`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-white">{item.projetoNome}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${status.badge}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                        <span>{item.modoCobranca}</span>
                        <span>Tokens: {formatNumber(item.consumoAtual.totalTokens)}</span>
                        <span>Custo: {formatCurrency(item.consumoAtual.custoTotal)}</span>
                        {item.cicloAtual?.excedenteTokens ? <span>Excedente: {formatNumber(item.cicloAtual.excedenteTokens)}</span> : null}
                      </div>

                      <div className="mt-3">
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                          <span className="text-slate-300">
                            {formatNumber(item.consumoAtual.totalTokens)} / {tokenLimitLabel} tokens
                          </span>
                          <span className="font-medium text-white">{item.percentualUso === null ? "ilimitado" : `${Math.round(item.percentualUso)}%`}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/8">
                          <div
                            className={`h-full rounded-full transition-all ${status.tone}`}
                            style={{ width: `${progressValue}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-1.5 text-sm text-slate-400">
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Plano</p>
                      <select
                        value={currentPlanId}
                        onChange={(event) => onChangePlano(item.projetoId, event.target.value)}
                        disabled={updatingProjetoId === item.projetoId}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value={unlimitedPlanId}>Ilimitado</option>
                        {planos
                          .filter((plano) => plano.ativo)
                          .map((plano) => (
                            <option key={plano.id} value={plano.id}>
                              {plano.nome}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-2 text-xs text-slate-400">
                    <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-slate-950/30 px-3 py-2">
                      <Coins size={14} className="text-slate-500" />
                      <span>Custo atual: {formatCurrency(item.consumoAtual.custoTotal)}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-slate-950/30 px-3 py-2">
                      <ChevronRight size={14} className="text-slate-500" />
                      <span>Limite tokens: {tokenLimitLabel}</span>
                    </div>
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
