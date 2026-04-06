"use client";

import { AlertTriangle, RefreshCw, Plus } from "lucide-react";
import { formatCurrency, formatNumber, getProgressValue, getProjectStatus } from "./billing-helpers";
import { StatusBadge } from "./status-badge";
import type { ProjetoCardData } from "./types";
import { UsageBar } from "./usage-bar";

type ProjectCardProps = {
  item: ProjetoCardData;
  onOpenDetails: (item: ProjetoCardData) => void;
  onAction: (action: "trocar-plano" | "comprar-tokens", item: ProjetoCardData) => void;
};

export function ProjectCard({ item, onOpenDetails, onAction }: ProjectCardProps) {
  const status = getProjectStatus(item);
  const tokenLimit = item.billing?.plan.limiteTokensTotalMensal ?? null;
  const totalTokens = item.billing?.currentUsage.totalTokens ?? 0;
  const cost = item.billing?.currentUsage.custoTotal ?? 0;
  const progressValue = getProgressValue(item);
  const planName = item.billing?.plan.nomePlano ?? "Sem plano";
  const periodLabel = item.billing?.windowLabel ?? "ciclo atual";

  return (
    <article className="grid gap-4 rounded-3xl border border-white/8 bg-white/[0.03] px-5 py-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.8fr)] lg:items-center">
      <div className="flex gap-4">
        <div className={`mt-1 h-auto min-h-16 w-1.5 rounded-full ${status.tone}`} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-white">{item.projetoNome}</h3>
            <StatusBadge status={status} />
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
            <span>Plano: {planName}</span>
            <span>Periodo: {periodLabel}</span>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-300">
                {formatNumber(totalTokens)} / {tokenLimit === null ? "sem limite" : formatNumber(tokenLimit)} tokens
              </span>
              <span className="font-medium text-white">{tokenLimit === null ? "ilimitado" : `${Math.round(progressValue)}%`}</span>
            </div>

            <UsageBar toneClassName={status.tone} value={progressValue} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 text-sm text-slate-400 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Custo atual</p>
          <p className="mt-1 text-base font-semibold text-white">{formatCurrency(cost)}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Limite do plano</p>
          <p className="mt-1 text-base font-semibold text-white">{tokenLimit === null ? "Sem limite" : `${formatNumber(tokenLimit)} tokens`}</p>
        </div>

        {!item.billing ? (
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-xs text-slate-300">
              <AlertTriangle size={14} />
              Billing indisponivel para este projeto.
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-1">
          <button
            type="button"
            onClick={() => onAction("trocar-plano", item)}
            className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
          >
            <RefreshCw size={14} className="mr-2" />
            Trocar plano
          </button>

          <button
            type="button"
            onClick={() => onAction("comprar-tokens", item)}
            className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
          >
            <Plus size={14} className="mr-2" />
            Comprar tokens
          </button>

          <button
            type="button"
            onClick={() => onOpenDetails(item)}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
          >
            Ver detalhes
          </button>
        </div>
      </div>
    </article>
  );
}
