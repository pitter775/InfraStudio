"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, Coins, UserRound } from "lucide-react";

type UsageGroup = {
  id: string;
  nome: string;
  tokensInput: number;
  tokensOutput: number;
  custoTotal: number;
};

type UsageUserProjectGroup = {
  usuarioId: string;
  usuarioNome: string;
  projetoId: string;
  projetoNome: string;
  tokensInput: number;
  tokensOutput: number;
  custoTotal: number;
};

type UsageOverview = {
  isAdmin: boolean;
  tokensInput: number;
  tokensOutput: number;
  custoTotal: number;
  porUsuario: UsageGroup[];
  porProjeto: UsageGroup[];
  porUsuarioProjeto: UsageUserProjectGroup[];
};

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);
}

export default function AdminUsagePage() {
  const [overview, setOverview] = useState<UsageOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/admin/ia-usage", { cache: "no-store" });
      const payload = (await response.json()) as { overview?: UsageOverview };
      setOverview(payload.overview ?? null);
      setLoading(false);
    };

    void load();
  }, []);

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <h1 className="text-4xl font-extrabold text-white">Uso de Tokens</h1>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Tokens input</p>
          <p className="mt-3 text-3xl font-extrabold text-white">{loading ? "..." : formatNumber(overview?.tokensInput ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Tokens output</p>
          <p className="mt-3 text-3xl font-extrabold text-white">{loading ? "..." : formatNumber(overview?.tokensOutput ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Custo total</p>
          <p className="mt-3 text-3xl font-extrabold text-white">{loading ? "..." : formatCurrency(overview?.custoTotal ?? 0)}</p>
        </div>
      </section>

      {overview?.isAdmin ? (
        <>
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="inline-flex items-center gap-2 text-xl font-bold text-white"><UserRound size={18} />Por usuario</h2>
            </div>
            <div className="divide-y divide-white/10">
              {overview.porUsuario.map((item) => (
                <div key={item.id} className="grid gap-3 px-6 py-4 md:grid-cols-[minmax(0,1fr)_160px_160px_160px] md:items-center">
                  <p className="font-semibold text-white">{item.nome}</p>
                  <p className="text-sm text-slate-300">In: {formatNumber(item.tokensInput)}</p>
                  <p className="text-sm text-slate-300">Out: {formatNumber(item.tokensOutput)}</p>
                  <p className="text-sm font-semibold text-emerald-300">{formatCurrency(item.custoTotal)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="inline-flex items-center gap-2 text-xl font-bold text-white"><BriefcaseBusiness size={18} />Por projeto</h2>
            </div>
            <div className="divide-y divide-white/10">
              {overview.porProjeto.map((item) => (
                <div key={item.id} className="grid gap-3 px-6 py-4 md:grid-cols-[minmax(0,1fr)_160px_160px_160px] md:items-center">
                  <p className="font-semibold text-white">{item.nome}</p>
                  <p className="text-sm text-slate-300">In: {formatNumber(item.tokensInput)}</p>
                  <p className="text-sm text-slate-300">Out: {formatNumber(item.tokensOutput)}</p>
                  <p className="text-sm font-semibold text-emerald-300">{formatCurrency(item.custoTotal)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="inline-flex items-center gap-2 text-xl font-bold text-white"><Coins size={18} />Usuario + projeto</h2>
            </div>
            <div className="divide-y divide-white/10">
              {overview.porUsuarioProjeto.map((item) => (
                <div key={`${item.usuarioId}-${item.projetoId}`} className="grid gap-3 px-6 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_140px_140px] md:items-center">
                  <p className="font-semibold text-white">{item.usuarioNome}</p>
                  <p className="text-sm text-slate-300">{item.projetoNome}</p>
                  <p className="text-sm text-slate-300">{formatNumber(item.tokensInput)}</p>
                  <p className="text-sm text-slate-300">{formatNumber(item.tokensOutput)}</p>
                  <p className="text-sm font-semibold text-emerald-300">{formatCurrency(item.custoTotal)}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-xl font-bold text-white">Seu consumo</h2>
          </div>
          <div className="divide-y divide-white/10">
            {(overview?.porProjeto ?? []).map((item) => (
              <div key={item.id} className="grid gap-3 px-6 py-4 md:grid-cols-[minmax(0,1fr)_160px_160px_160px] md:items-center">
                <p className="font-semibold text-white">{item.nome}</p>
                <p className="text-sm text-slate-300">In: {formatNumber(item.tokensInput)}</p>
                <p className="text-sm text-slate-300">Out: {formatNumber(item.tokensOutput)}</p>
                <p className="text-sm font-semibold text-emerald-300">{formatCurrency(item.custoTotal)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
