"use client";

import { PencilLine, Plus, Power, Trash2 } from "lucide-react";
import { formatCurrency, formatNumber } from "./billing-helpers";

export type PlanListItem = {
  id: string;
  nome: string;
  precoMensal: number;
  limiteTokensTotalMensal: number | null;
  limiteCustoMensal: number | null;
  isFree: boolean;
  ativo: boolean;
  permitirExcedente: boolean;
  custoTokenExcedente: number;
};

type PlansListProps = {
  planos: PlanListItem[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (planoId: string) => void;
  onToggleActive: (planoId: string, ativo: boolean) => void;
  onDelete: (planoId: string) => void;
};

export function PlansList({ planos, loading, onCreate, onEdit, onToggleActive, onDelete }: PlansListProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Planos</h2>
          <p className="mt-1 text-sm text-slate-400">Base de planos editavel na propria tela.</p>
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500/15 px-4 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 sm:justify-start"
        >
          <Plus size={15} />
          Novo plano
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/8 bg-white/[0.04]">
        {loading ? <div className="px-5 py-5 text-sm text-slate-400">Carregando planos...</div> : null}
        {!loading && !planos.length ? <div className="px-5 py-5 text-sm text-slate-400">Nenhum plano encontrado.</div> : null}

        {!loading ? (
          <div className="divide-y divide-white/8">
            {planos.map((plano) => (
              <div key={plano.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold text-white">{plano.nome}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${plano.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/50 text-slate-300"}`}>
                        {plano.ativo ? "ativo" : "inativo"}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${plano.permitirExcedente ? "bg-sky-500/15 text-sky-300" : "bg-slate-800/80 text-slate-400"}`}>
                        {plano.permitirExcedente ? "com excedente" : "sem excedente"}
                      </span>
                      {plano.isFree ? (
                        <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
                          free
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Preco</p>
                        <p className="mt-1 text-sm font-semibold text-white">{formatCurrency(plano.precoMensal)}/mes</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Tokens</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {plano.limiteTokensTotalMensal === null ? "Sem limite" : formatNumber(plano.limiteTokensTotalMensal)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Custo</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {plano.limiteCustoMensal === null ? "Sem limite" : formatCurrency(plano.limiteCustoMensal)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => onEdit(plano.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/6 px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                    >
                      <PencilLine size={15} />
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleActive(plano.id, !plano.ativo)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/6 px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                    >
                      <Power size={15} />
                      {plano.ativo ? "Inativar" : "Ativar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDelete(plano.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500/10 px-3 py-2.5 text-sm font-medium text-rose-100 transition hover:bg-rose-500/15"
                    >
                      <Trash2 size={15} />
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
