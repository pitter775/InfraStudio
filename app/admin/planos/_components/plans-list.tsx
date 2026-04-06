"use client";

import { PencilLine } from "lucide-react";
import { formatCurrency, formatNumber } from "./billing-helpers";

export type PlanListItem = {
  id: string;
  nome: string;
  precoMensal: number;
  limiteTokensTotalMensal: number | null;
  limiteCustoMensal: number | null;
  ativo: boolean;
  permitirExcedente: boolean;
};

type PlansListProps = {
  planos: PlanListItem[];
  loading: boolean;
  onEdit: (planoId: string) => void;
};

export function PlansList({ planos, loading, onEdit }: PlansListProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Planos</h2>
          <p className="mt-1 text-sm text-slate-400">Lista secundaria com limites base.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white/[0.04]">
        {loading ? <div className="px-5 py-5 text-sm text-slate-400">Carregando planos...</div> : null}
        {!loading && !planos.length ? <div className="px-5 py-5 text-sm text-slate-400">Nenhum plano encontrado.</div> : null}

        {!loading ? (
          <div className="divide-y divide-white/8">
            {planos.map((plano) => (
              <div key={plano.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-semibold text-white">{plano.nome}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${plano.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/50 text-slate-300"}`}>
                      {plano.ativo ? "ativo" : "inativo"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${plano.permitirExcedente ? "bg-sky-500/15 text-sky-300" : "bg-slate-800/80 text-slate-400"}`}>
                      {plano.permitirExcedente ? "com excedente" : "sem excedente"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                    <span>{formatCurrency(plano.precoMensal)}/mes</span>
                    <span>{formatNumber(plano.limiteTokensTotalMensal)} tokens</span>
                    <span>{formatCurrency(plano.limiteCustoMensal ?? 0)} custo</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onEdit(plano.id)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/6 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                >
                  <PencilLine size={15} />
                  Editar plano
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
