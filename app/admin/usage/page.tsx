"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Coins, FolderKanban, UserRound, Users } from "lucide-react";
import { getCurrentProjectUser } from "@/lib/auth";
import { canAccessGlobalAdmin } from "@/lib/access";

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
  totalUsuarios: number;
  totalProjetos: number;
  porUsuario: UsageGroup[];
  porProjeto: UsageGroup[];
  porUsuarioProjeto: UsageUserProjectGroup[];
  agentesPorProjeto: Array<{
    id: string;
    projetoId: string;
    nome: string;
    ativo: boolean;
  }>;
};

type UserProjectView = {
  projetoId: string;
  projetoNome: string;
  tokensInput: number;
  tokensOutput: number;
  custoTotal: number;
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
  const router = useRouter();
  const [overview, setOverview] = useState<UsageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUsuarioId, setSelectedUsuarioId] = useState<string | null>(null);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const currentUser = await getCurrentProjectUser();
      if (!canAccessGlobalAdmin(currentUser)) {
        router.replace("/admin/projetos");
        return;
      }

      const response = await fetch("/api/admin/ia-usage", { cache: "no-store" });
      const payload = (await response.json()) as { overview?: UsageOverview };
      setOverview(payload.overview ?? null);
      setSelectedUsuarioId(payload.overview?.porUsuario[0]?.id ?? null);
      setLoading(false);
    };

    void load();
  }, [router]);

  const projetosDoUsuario = useMemo<UserProjectView[]>(() => {
    if (!overview) {
      return [];
    }

    if (!overview.isAdmin || !selectedUsuarioId) {
      return overview.porProjeto.map((item) => ({
        projetoId: item.id,
        projetoNome: item.nome,
        tokensInput: item.tokensInput,
        tokensOutput: item.tokensOutput,
        custoTotal: item.custoTotal,
      }));
    }

    return overview.porUsuarioProjeto
      .filter((item) => item.usuarioId === selectedUsuarioId)
      .map((item) => ({
        projetoId: item.projetoId,
        projetoNome: item.projetoNome,
        tokensInput: item.tokensInput,
        tokensOutput: item.tokensOutput,
        custoTotal: item.custoTotal,
      }));
  }, [overview, selectedUsuarioId]);

  const selectedProjetoRealId = useMemo(() => {
    if (!overview) {
      return null;
    }

    if (!overview.isAdmin) {
      return selectedProjetoId ?? overview.porProjeto[0]?.id ?? null;
    }

    return selectedProjetoId ?? projetosDoUsuario[0]?.projetoId ?? null;
  }, [overview, projetosDoUsuario, selectedProjetoId]);

  const agentesDoProjeto = useMemo(() => {
    if (!overview || !selectedProjetoRealId) {
      return [];
    }

    return overview.agentesPorProjeto.filter((item) => item.projetoId === selectedProjetoRealId);
  }, [overview, selectedProjetoRealId]);

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <h1 className="text-4xl font-extrabold text-white">Uso de Tokens</h1>
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
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
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-slate-400"><Users size={14} />Usuarios</p>
          <p className="mt-3 text-3xl font-extrabold text-white">{loading ? "..." : formatNumber(overview?.totalUsuarios ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-slate-400"><FolderKanban size={14} />Projetos</p>
          <p className="mt-3 text-3xl font-extrabold text-white">{loading ? "..." : formatNumber(overview?.totalProjetos ?? 0)}</p>
        </div>
      </section>

      {overview?.isAdmin ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 px-6 py-5">
                <h2 className="inline-flex items-center gap-2 text-xl font-bold text-white"><UserRound size={18} />Usuarios</h2>
              </div>
              <div className="divide-y divide-white/10">
                {overview.porUsuario.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedUsuarioId(item.id);
                      setSelectedProjetoId(null);
                    }}
                    className={`grid w-full gap-3 px-6 py-4 text-left md:grid-cols-[minmax(0,1fr)_120px_120px_140px] md:items-center ${selectedUsuarioId === item.id ? "bg-cyan-500/10" : "hover:bg-white/5"}`}
                  >
                    <p className="font-semibold text-white">{item.nome}</p>
                    <p className="text-sm text-slate-300">{formatNumber(item.tokensInput)}</p>
                    <p className="text-sm text-slate-300">{formatNumber(item.tokensOutput)}</p>
                    <p className="text-sm font-semibold text-emerald-300">{formatCurrency(item.custoTotal)}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="border-b border-white/10 px-6 py-5">
                  <h2 className="inline-flex items-center gap-2 text-xl font-bold text-white"><BriefcaseBusiness size={18} />Projetos do usuario</h2>
                </div>
                <div className="divide-y divide-white/10">
                  {projetosDoUsuario.map((item) => (
                    <button
                      key={item.projetoId}
                      type="button"
                      onClick={() => setSelectedProjetoId(item.projetoId)}
                      className={`grid w-full gap-3 px-6 py-4 text-left md:grid-cols-[minmax(0,1fr)_120px_120px_140px] md:items-center ${selectedProjetoRealId === item.projetoId ? "bg-emerald-500/10" : "hover:bg-white/5"}`}
                    >
                      <p className="font-semibold text-white">{item.projetoNome}</p>
                      <p className="text-sm text-slate-300">{formatNumber(item.tokensInput)}</p>
                      <p className="text-sm text-slate-300">{formatNumber(item.tokensOutput)}</p>
                      <p className="text-sm font-semibold text-emerald-300">{formatCurrency(item.custoTotal)}</p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="border-b border-white/10 px-6 py-5">
                  <h2 className="inline-flex items-center gap-2 text-xl font-bold text-white"><Coins size={18} />Agentes do projeto</h2>
                </div>
                <div className="divide-y divide-white/10">
                  {agentesDoProjeto.length ? agentesDoProjeto.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-6 py-4">
                      <p className="font-semibold text-white">{item.nome}</p>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${item.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                        {item.ativo ? "ativo" : "inativo"}
                      </span>
                    </div>
                  )) : <div className="px-6 py-4 text-sm text-slate-400">Nenhum agente encontrado para este projeto.</div>}
                </div>
              </section>
            </div>
          </section>
        </>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-xl font-bold text-white">Seus projetos</h2>
            </div>
            <div className="divide-y divide-white/10">
              {(overview?.porProjeto ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedProjetoId(item.id)}
                  className={`grid w-full gap-3 px-6 py-4 text-left md:grid-cols-[minmax(0,1fr)_120px_120px_140px] md:items-center ${selectedProjetoRealId === item.id ? "bg-cyan-500/10" : "hover:bg-white/5"}`}
                >
                  <p className="font-semibold text-white">{item.nome}</p>
                  <p className="text-sm text-slate-300">{formatNumber(item.tokensInput)}</p>
                  <p className="text-sm text-slate-300">{formatNumber(item.tokensOutput)}</p>
                  <p className="text-sm font-semibold text-emerald-300">{formatCurrency(item.custoTotal)}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="inline-flex items-center gap-2 text-xl font-bold text-white"><Coins size={18} />Agentes do projeto</h2>
            </div>
            <div className="divide-y divide-white/10">
              {agentesDoProjeto.length ? agentesDoProjeto.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-6 py-4">
                  <p className="font-semibold text-white">{item.nome}</p>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${item.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                    {item.ativo ? "ativo" : "inativo"}
                  </span>
                </div>
              )) : <div className="px-6 py-4 text-sm text-slate-400">Nenhum agente encontrado para este projeto.</div>}
            </div>
          </section>
        </section>
      )}
    </main>
  );
}
