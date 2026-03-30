"use client";

import { useEffect, useState } from "react";
import { BarChart3, LoaderCircle } from "lucide-react";

type UsoRow = {
  projetoId: string;
  projetoNome: string;
  modoCobranca: "plano" | "manual" | "ilimitado";
  plano: {
    nomePlano: string;
    limiteTokensTotalMensal: number | null;
    limiteCustoMensal: number | null;
    bloqueado: boolean;
  };
  consumoAtual: {
    totalTokens: number;
    custoTotal: number;
    source: "ciclo" | "consumos";
  };
  percentualTokens: number | null;
  percentualCusto: number | null;
  percentualUso: number | null;
  status: "ativo" | "bloqueado";
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatBar(percent: number | null) {
  const value = Math.max(0, Math.min(Math.round(percent ?? 0), 100));
  const filled = Math.round(value / 10);
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)} ${value}%`;
}

export default function AdminUsoPage() {
  const [rows, setRows] = useState<UsoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/admin/uso", { cache: "no-store" });
      const payload = (await response.json()) as { uso?: UsoRow[] };
      setRows(payload.uso ?? []);
      setLoading(false);
    };

    void load();
  }, []);

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
          <BarChart3 size={14} />
          Uso por Projeto
        </div>
        <h1 className="text-4xl font-extrabold text-white">Ciclo atual por projeto</h1>
        <p className="mt-4 max-w-3xl text-slate-400">Visao consolidada de tokens, custo, limite e bloqueio no ciclo aberto de cada projeto.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-400">
            <LoaderCircle size={16} className="mb-2 animate-spin" />
            Carregando uso por projeto...
          </div>
        ) : null}

        {rows.map((row) => (
          <article key={row.projetoId} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_18px_38px_rgba(2,8,23,0.22)]">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-white">{row.projetoNome}</h2>
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${row.status === "bloqueado" ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/15 text-emerald-300"}`}>
                {row.status}
              </span>
            </div>

            <p className="mt-3 text-sm text-slate-300">Plano: {row.plano.nomePlano}</p>
            <p className="mt-1 text-sm text-slate-400">Modo: {row.modoCobranca} | Origem: {row.consumoAtual.source}</p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Uso mensal</p>
              <p className="mt-3 text-lg font-bold text-white">{formatBar(row.percentualUso)}</p>
              <p className="mt-3 text-sm text-slate-300">
                Tokens: {row.consumoAtual.totalTokens.toLocaleString("pt-BR")} / {(row.plano.limiteTokensTotalMensal ?? 0).toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Custo: {formatCurrency(row.consumoAtual.custoTotal)} / {formatCurrency(row.plano.limiteCustoMensal ?? 0)}
              </p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
