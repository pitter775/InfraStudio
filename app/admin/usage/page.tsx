"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, FolderKanban, LoaderCircle, ShieldAlert } from "lucide-react";

type UsageRow = {
  projetoId: string;
  projetoNome: string;
  modoCobranca: "plano" | "manual" | "ilimitado";
  plano: {
    nomePlano: string;
    limiteTokensTotalMensal: number | null;
    limiteCustoMensal: number | null;
  };
  consumoAtual: {
    totalTokens: number;
    custoTotal: number;
  };
  percentualUso: number | null;
  status: "ativo" | "bloqueado";
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function AdminUsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/admin/uso", { cache: "no-store" });
      const payload = (await response.json()) as { uso?: UsageRow[] };
      setRows(payload.uso ?? []);
      setLoading(false);
    };

    void load();
  }, []);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, item) => {
        acc.tokens += item.consumoAtual.totalTokens;
        acc.custo += item.consumoAtual.custoTotal;
        acc.bloqueados += item.status === "bloqueado" ? 1 : 0;
        return acc;
      },
      { tokens: 0, custo: 0, bloqueados: 0 },
    );
  }, [rows]);

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <h1 className="text-4xl font-extrabold text-white">Uso de Tokens</h1>
        <p className="mt-4 max-w-3xl text-slate-400">Resumo do ciclo atual usando `projetos_ciclos_uso` e fallback para `consumos` quando necessario.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-slate-400"><Coins size={14} />Tokens atuais</p>
          <p className="mt-3 text-3xl font-extrabold text-white">{loading ? "..." : totals.tokens.toLocaleString("pt-BR")}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Custo atual</p>
          <p className="mt-3 text-3xl font-extrabold text-white">{loading ? "..." : formatCurrency(totals.custo)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-slate-400"><FolderKanban size={14} />Projetos</p>
          <p className="mt-3 text-3xl font-extrabold text-white">{loading ? "..." : rows.length.toLocaleString("pt-BR")}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-slate-400"><ShieldAlert size={14} />Bloqueados</p>
          <p className="mt-3 text-3xl font-extrabold text-white">{loading ? "..." : totals.bloqueados.toLocaleString("pt-BR")}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
        <div className="border-b border-white/10 px-6 py-5">
          <h2 className="text-2xl font-bold text-white">Projetos no ciclo atual</h2>
        </div>

        <div className="divide-y divide-white/10">
          {loading ? (
            <div className="px-6 py-6 text-sm text-slate-400">
              <LoaderCircle size={16} className="mb-2 animate-spin" />
              Carregando dados...
            </div>
          ) : null}

          {!loading && !rows.length ? <div className="px-6 py-6 text-sm text-slate-400">Nenhum projeto encontrado.</div> : null}

          {rows.map((item) => (
            <div key={item.projetoId} className="grid gap-4 px-6 py-5 md:grid-cols-[minmax(0,1fr)_180px_180px_120px] md:items-center">
              <div>
                <p className="font-semibold text-white">{item.projetoNome}</p>
                <p className="mt-1 text-sm text-slate-400">Plano: {item.plano.nomePlano} | Modo: {item.modoCobranca}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tokens</p>
                <p className="mt-2 text-lg font-bold text-white">{item.consumoAtual.totalTokens.toLocaleString("pt-BR")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Custo</p>
                <p className="mt-2 text-lg font-bold text-white">{formatCurrency(item.consumoAtual.custoTotal)}</p>
              </div>
              <div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${item.status === "bloqueado" ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/15 text-emerald-300"}`}>
                  {item.percentualUso === null ? item.status : `${Math.round(item.percentualUso)}%`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
