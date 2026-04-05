"use client";

import { useEffect, useState } from "react";
import { CreditCard, LoaderCircle, RefreshCcw, XCircle } from "lucide-react";

type AssinaturaRow = {
  assinaturaId: string | null;
  projetoId: string;
  projetoNome: string;
  modoCobranca: "plano" | "manual" | "ilimitado";
  planoId: string | null;
  planoNome: string;
  status: "ativo" | "cancelado" | "trial" | "suspenso" | null;
  renovarAutomatico: boolean;
  dataInicio: string | null;
  dataFim: string | null;
  usoPercentual: number | null;
  statusUso: "ativo" | "bloqueado";
};

type ProjetoOption = {
  id: string;
  nome: string;
};

type PlanoOption = {
  id: string;
  nome: string;
  ativo: boolean;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Não iniciado";
  }

  return new Date(value).toLocaleDateString("pt-BR");
}

export default function AdminAssinaturasPage() {
  const [assinaturas, setAssinaturas] = useState<AssinaturaRow[]>([]);
  const [projetos, setProjetos] = useState<ProjetoOption[]>([]);
  const [planos, setPlanos] = useState<PlanoOption[]>([]);
  const [projetoId, setProjetoId] = useState("");
  const [planoId, setPlanoId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingProjetoId, setUpdatingProjetoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [assinaturasResponse, projetosResponse, planosResponse] = await Promise.all([
      fetch("/api/admin/assinaturas", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/admin/projetos", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/admin/planos", { cache: "no-store" }).then((response) => response.json()),
    ]);

    setAssinaturas(assinaturasResponse.assinaturas ?? []);
    setProjetos((projetosResponse.projetos ?? []).map((item: { id: string; nome: string }) => ({ id: item.id, nome: item.nome })));
    setPlanos((planosResponse.planos ?? []).map((item: PlanoOption) => ({ id: item.id, nome: item.nome, ativo: item.ativo })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async (trocarPlano: boolean) => {
    if (!projetoId || !planoId) {
      return;
    }

    setSaving(true);
    setFeedback(null);
    const response = await fetch("/api/admin/assinaturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projetoId, planoId, trocarPlano }),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedback(payload.error ?? "Não foi possível salvar a assinatura.");
      setSaving(false);
      return;
    }

    await load();
    setSaving(false);
    setFeedback(trocarPlano ? "Plano trocado e novo ciclo criado." : "Assinatura criada.");
  };

  const cancelar = async (assinaturaId: string) => {
    const response = await fetch(`/api/admin/assinaturas/${assinaturaId}`, { method: "PATCH" });
    if (response.ok) {
      await load();
      setFeedback("Assinatura cancelada.");
    }
  };

  const handleInlinePlanChange = async (item: AssinaturaRow, nextPlanoId: string) => {
    if (!nextPlanoId || nextPlanoId === item.planoId) {
      return;
    }

    setUpdatingProjetoId(item.projetoId);
    setFeedback(null);

    const response = await fetch("/api/admin/assinaturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projetoId: item.projetoId,
        planoId: nextPlanoId,
        trocarPlano: true,
      }),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedback(payload.error ?? "Não foi possível trocar o plano.");
      setUpdatingProjetoId(null);
      return;
    }

    await load();
    setUpdatingProjetoId(null);
    setFeedback(`Plano de ${item.projetoNome} atualizado imediatamente.`);
  };

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
          <CreditCard size={14} />
          Assinaturas
        </div>
        <h1 className="text-4xl font-extrabold text-white">Assinaturas por projeto</h1>
        <p className="mt-4 max-w-3xl text-slate-400">Mantenha uma assinatura ativa por projeto, troque plano com snapshot e abra um novo ciclo automaticamente.</p>
      </section>

      {feedback ? <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</section> : null}

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-2xl font-bold text-white">Nova assinatura ou troca de plano</h2>
        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_auto_auto]">
          <select value={projetoId} onChange={(event) => setProjetoId(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none">
            <option value="">Selecione o projeto</option>
            {projetos.map((projeto) => (
              <option key={projeto.id} value={projeto.id}>{projeto.nome}</option>
            ))}
          </select>
          <select value={planoId} onChange={(event) => setPlanoId(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none">
            <option value="">Selecione o plano</option>
            {planos.filter((plano) => plano.ativo).map((plano) => (
              <option key={plano.id} value={plano.id}>{plano.nome}</option>
            ))}
          </select>
          <button type="button" disabled={saving || !projetoId || !planoId} onClick={() => void handleCreate(false)} className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-5 py-3 text-sm font-semibold text-sky-50 disabled:opacity-60">
            {saving ? <LoaderCircle size={16} className="mx-auto animate-spin" /> : "Criar assinatura"}
          </button>
          <button type="button" disabled={saving || !projetoId || !planoId} onClick={() => void handleCreate(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            <RefreshCcw size={16} />
            Trocar plano
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-2xl font-bold text-white">Projetos com plano</h2>
        <div className="mt-6 space-y-4">
          {loading ? <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-5 text-sm text-slate-400">Carregando assinaturas...</div> : null}
          {!loading && !assinaturas.length ? <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-5 text-sm text-slate-400">Nenhuma assinatura encontrada.</div> : null}
          {assinaturas.map((item) => (
            <article key={item.projetoId} className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-bold text-white">{item.projetoNome}</h3>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${item.statusUso === "bloqueado" ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/15 text-emerald-300"}`}>
                      {item.statusUso}
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">{item.modoCobranca}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">Plano atual: {item.planoNome}</p>
                  <p className="mt-1 text-sm text-slate-400">Status: {item.status ?? "sem assinatura"} | Início: {formatDate(item.dataInicio)} | Fim: {formatDate(item.dataFim)}</p>
                  <p className="mt-1 text-sm text-slate-400">Uso atual: {item.usoPercentual === null ? "sem limite" : `${Math.round(item.usoPercentual)}%`}</p>
                </div>

                <div className="w-full max-w-md space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Trocar plano neste projeto</p>
                    <select
                      value={item.planoId ?? ""}
                      onChange={(event) => void handleInlinePlanChange(item, event.target.value)}
                      disabled={item.modoCobranca !== "plano" || updatingProjetoId === item.projetoId}
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        {item.modoCobranca === "plano" ? item.planoNome || "Selecione o plano" : "Disponível apenas em modo plano"}
                      </option>
                      {planos
                        .filter((plano) => plano.ativo)
                        .map((plano) => (
                          <option key={plano.id} value={plano.id}>
                            {plano.nome}
                          </option>
                        ))}
                    </select>
                    <p className="mt-2 text-xs text-slate-400">
                      {item.modoCobranca === "plano"
                        ? "Ao mudar aqui, a assinatura, o snapshot e o ciclo são atualizados imediatamente."
                        : `Projeto em modo ${item.modoCobranca}. Altere o modo de cobrança para plano para habilitar a troca.`}
                    </p>
                  </div>

                  {item.assinaturaId ? (
                    <button
                      type="button"
                      onClick={() => void cancelar(item.assinaturaId!)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100"
                    >
                      <XCircle size={16} />
                      Cancelar assinatura
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
