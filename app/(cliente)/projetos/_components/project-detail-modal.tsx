"use client";

import { Plus, RefreshCw, X } from "lucide-react";
import { formatCurrency, formatNumber, getProgressValue, getProjectStatus } from "./billing-helpers";
import { StatusBadge } from "./status-badge";
import type { ProjetoCardData } from "./types";
import { UsageBar } from "./usage-bar";

type ProjectDetailModalProps = {
  item: ProjetoCardData | null;
  open: boolean;
  onClose: () => void;
  onAction: (action: "trocar-plano" | "comprar-tokens", item: ProjetoCardData) => void;
};

export function ProjectDetailModal({ item, open, onClose, onAction }: ProjectDetailModalProps) {
  if (!open || !item) {
    return null;
  }

  const status = getProjectStatus(item);
  const plan = item.billing?.plan ?? null;
  const usage = item.billing?.currentUsage ?? null;
  const progressValue = getProgressValue(item);

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/80 px-4 py-4 backdrop-blur-sm sm:items-center sm:py-8">
      <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-[#08101f] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Detalhe do projeto</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-extrabold text-white">{item.projetoNome}</h2>
              <StatusBadge status={status} />
            </div>
            <p className="mt-2 text-sm text-slate-400">Periodo: {item.billing?.windowLabel ?? "ciclo atual"}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
            aria-label="Fechar detalhes"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-6">
          <section className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Plano atual</p>
              <p className="mt-2 text-lg font-semibold text-white">{plan?.nomePlano ?? "Sem plano"}</p>
            </article>

            <article className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Status atual</p>
              <p className="mt-2 text-lg font-semibold text-white">{status.label}</p>
            </article>
          </section>

          <section className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-300">
                {formatNumber(usage?.totalTokens ?? 0)} / {plan?.limiteTokensTotalMensal === null ? "sem limite" : formatNumber(plan?.limiteTokensTotalMensal)} tokens
              </span>
              <span className="font-medium text-white">{plan?.limiteTokensTotalMensal === null ? "ilimitado" : `${Math.round(progressValue)}%`}</span>
            </div>

            <div className="mt-3">
              <UsageBar toneClassName={status.tone} value={progressValue} />
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Uso detalhado</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatNumber(usage?.totalTokens ?? 0)} tokens</p>
            </article>

            <article className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Custo</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(usage?.custoTotal ?? 0)}</p>
            </article>

            <article className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Limite do plano</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {plan?.limiteTokensTotalMensal === null ? "Sem limite" : `${formatNumber(plan?.limiteTokensTotalMensal)} tokens`}
              </p>
            </article>
          </section>

          <section className="flex flex-col gap-2 border-t border-white/8 pt-5 sm:flex-row">
            <button
              type="button"
              onClick={() => onAction("trocar-plano", item)}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
            >
              <RefreshCw size={14} className="mr-2" />
              Trocar plano
            </button>

            <button
              type="button"
              onClick={() => onAction("comprar-tokens", item)}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
            >
              <Plus size={14} className="mr-2" />
              Comprar tokens
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
