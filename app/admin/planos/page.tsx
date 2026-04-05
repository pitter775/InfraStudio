"use client";

import { useEffect, useState } from "react";
import { Coins, LoaderCircle, PencilLine, Plus, Power, Trash2 } from "lucide-react";

type Plano = {
  id: string;
  nome: string;
  precoMensal: number;
  limiteTokensTotalMensal: number | null;
  limiteCustoMensal: number | null;
  maxAgentes: number;
  maxApis: number;
  maxWhatsapp: number;
  ativo: boolean;
};

type PlanoForm = {
  id?: string;
  nome: string;
  precoMensal: string;
  limiteTokensTotalMensal: string;
  limiteCustoMensal: string;
  maxAgentes: string;
  maxApis: string;
  maxWhatsapp: string;
  ativo: boolean;
};

const emptyForm: PlanoForm = {
  nome: "",
  precoMensal: "0",
  limiteTokensTotalMensal: "",
  limiteCustoMensal: "",
  maxAgentes: "1",
  maxApis: "1",
  maxWhatsapp: "0",
  ativo: true,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function AdminPlanosPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [form, setForm] = useState<PlanoForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingPlanoId, setDeletingPlanoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadPlanos = async () => {
    setLoading(true);
    setFeedback(null);
    const response = await fetch("/api/admin/planos", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { planos?: Plano[]; error?: string } | null;

    if (!response.ok) {
      setPlanos([]);
      setFeedback(payload?.error ?? "Nao foi possivel carregar os planos.");
      setLoading(false);
      return;
    }

    setPlanos(payload?.planos ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadPlanos();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setFeedback(null);

    const endpoint = form.id ? `/api/admin/planos/${form.id}` : "/api/admin/planos";
    const method = form.id ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedback(payload.error ?? "Não foi possível salvar o plano.");
      setSaving(false);
      return;
    }

    await loadPlanos();
    resetForm();
    setSaving(false);
    setFeedback(form.id ? "Plano atualizado." : "Plano criado.");
  };

  const togglePlano = async (plano: Plano) => {
    const response = await fetch(`/api/admin/planos/${plano.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !plano.ativo }),
    });

    if (response.ok) {
      await loadPlanos();
    }
  };

  const handleDeletePlano = async (plano: Plano) => {
    const confirmed = window.confirm(`Excluir o plano "${plano.nome}"? Essa ação não pode ser desfeita.`);
    if (!confirmed) {
      return;
    }

    setDeletingPlanoId(plano.id);
    setFeedback(null);

    const response = await fetch(`/api/admin/planos/${plano.id}`, {
      method: "DELETE",
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setFeedback(payload?.error ?? "Não foi possível excluir o plano.");
      setDeletingPlanoId(null);
      return;
    }

    await loadPlanos();
    if (form.id === plano.id) {
      resetForm();
    }
    setDeletingPlanoId(null);
    setFeedback("Plano excluido.");
  };

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
          <Coins size={14} />
          Planos
        </div>
        <h1 className="text-4xl font-extrabold text-white">Planos SaaS</h1>
        <p className="mt-4 max-w-3xl text-slate-400">Crie, ajuste limites e controle quais planos ficam disponíveis para assinatura.</p>
      </section>

      {feedback ? <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</section> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Planos cadastrados</p>
          <p className="mt-3 text-4xl font-black text-white">{planos.length}</p>
          <p className="mt-2 text-sm text-slate-400">Quantidade total de planos disponíveis no cadastro SaaS.</p>
        </article>
        <article className="rounded-3xl border border-emerald-400/15 bg-emerald-500/10 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100/80">Planos ativos</p>
          <p className="mt-3 text-4xl font-black text-white">{planos.filter((plano) => plano.ativo).length}</p>
          <p className="mt-2 text-sm text-emerald-50/80">Esses planos podem ser aplicados imediatamente nas assinaturas.</p>
        </article>
        <article className="rounded-3xl border border-cyan-400/15 bg-cyan-500/10 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100/80">Lista rápida</p>
          <p className="mt-3 text-sm font-semibold text-white">
            {planos.length ? planos.map((plano) => plano.nome).join(" • ") : "Nenhum plano carregado ainda."}
          </p>
          <p className="mt-2 text-sm text-cyan-50/80">Os cards abaixo mostram preco, limites e capacidade por plano.</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white">{form.id ? "Editar plano" : "Novo plano"}</h2>
              <p className="mt-1 text-sm text-slate-400">Os limites daqui alimentam snapshot, assinatura e bloqueio automático.</p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200"
            >
              Limpar
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-200">Nome do plano</span>
              <input value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome do plano" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-200">Preço mensal</span>
              <input value={form.precoMensal} onChange={(event) => setForm((current) => ({ ...current, precoMensal: event.target.value }))} placeholder="Preço mensal" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-200">Limite tokens total mensal</span>
              <input value={form.limiteTokensTotalMensal} onChange={(event) => setForm((current) => ({ ...current, limiteTokensTotalMensal: event.target.value }))} placeholder="Limite tokens total mensal" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-200">Limite de custo mensal</span>
              <input value={form.limiteCustoMensal} onChange={(event) => setForm((current) => ({ ...current, limiteCustoMensal: event.target.value }))} placeholder="Limite de custo mensal" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
            </label>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="grid min-w-0 gap-2">
                <span className="text-sm font-semibold text-slate-200">Max agentes</span>
                <input value={form.maxAgentes} onChange={(event) => setForm((current) => ({ ...current, maxAgentes: event.target.value }))} placeholder="Max agentes" className="min-w-0 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
              </label>
              <label className="grid min-w-0 gap-2">
                <span className="text-sm font-semibold text-slate-200">Max APIs</span>
                <input value={form.maxApis} onChange={(event) => setForm((current) => ({ ...current, maxApis: event.target.value }))} placeholder="Max APIs" className="min-w-0 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
              </label>
              <label className="grid min-w-0 gap-2">
                <span className="text-sm font-semibold text-slate-200">Max WhatsApp</span>
                <input value={form.maxWhatsapp} onChange={(event) => setForm((current) => ({ ...current, maxWhatsapp: event.target.value }))} placeholder="Max WhatsApp" className="min-w-0 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
              </label>
            </div>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200">
              <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${form.ativo ? "text-emerald-200" : "text-slate-500"}`}>
                {form.ativo ? "Ativo" : "Inativo"}
              </span>
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(event) => setForm((current) => ({ ...current, ativo: event.target.checked }))}
                  className="peer sr-only"
                />
                <span className="h-7 w-12 rounded-full bg-white/10 transition-colors peer-checked:bg-emerald-500/30" />
                <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 peer-checked:bg-emerald-200" />
              </span>
            </label>
            <button
              type="button"
              disabled={saving || !form.nome.trim()}
              onClick={() => void handleSubmit()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-50 disabled:opacity-60"
            >
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : form.id ? <PencilLine size={16} /> : <Plus size={16} />}
              {form.id ? "Salvar alteracoes" : "Criar plano"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white">Lista de planos</h2>
              <p className="mt-1 text-sm text-slate-400">{planos.length} plano(s) configurado(s).</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-5 text-sm text-slate-400">Carregando planos...</div> : null}
            {!loading && !planos.length ? <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-5 text-sm text-slate-400">Nenhum plano cadastrado ainda.</div> : null}
            {planos.map((plano) => (
              <article key={plano.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-bold text-white">{plano.nome}</h3>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${plano.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-200"}`}>
                        {plano.ativo ? "ativo" : "inativo"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{formatCurrency(plano.precoMensal)} / mês</p>
                    <p className="mt-2 text-sm text-slate-400">
                      Tokens: {(plano.limiteTokensTotalMensal ?? 0).toLocaleString("pt-BR")} | Custo: {formatCurrency(plano.limiteCustoMensal ?? 0)}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Agentes: {plano.maxAgentes} | APIs: {plano.maxApis} | WhatsApp: {plano.maxWhatsapp}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          id: plano.id,
                          nome: plano.nome,
                          precoMensal: String(plano.precoMensal),
                          limiteTokensTotalMensal: plano.limiteTokensTotalMensal === null ? "" : String(plano.limiteTokensTotalMensal),
                          limiteCustoMensal: plano.limiteCustoMensal === null ? "" : String(plano.limiteCustoMensal),
                          maxAgentes: String(plano.maxAgentes),
                          maxApis: String(plano.maxApis),
                          maxWhatsapp: String(plano.maxWhatsapp),
                          ativo: plano.ativo,
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
                    >
                      <PencilLine size={16} />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void togglePlano(plano)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
                    >
                      <Power size={16} />
                      {plano.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeletePlano(plano)}
                      disabled={deletingPlanoId === plano.id}
                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingPlanoId === plano.id ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
