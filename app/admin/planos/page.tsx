"use client";

import { useEffect, useState } from "react";
import { Coins, LoaderCircle, PencilLine, Plus, Power } from "lucide-react";

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
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadPlanos = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/planos", { cache: "no-store" });
    const payload = (await response.json()) as { planos?: Plano[] };
    setPlanos(payload.planos ?? []);
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
      setFeedback(payload.error ?? "Nao foi possivel salvar o plano.");
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

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
          <Coins size={14} />
          Planos
        </div>
        <h1 className="text-4xl font-extrabold text-white">Planos SaaS</h1>
        <p className="mt-4 max-w-3xl text-slate-400">Crie, ajuste limites e controle quais planos ficam disponiveis para assinatura.</p>
      </section>

      {feedback ? <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</section> : null}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white">{form.id ? "Editar plano" : "Novo plano"}</h2>
              <p className="mt-1 text-sm text-slate-400">Os limites daqui alimentam snapshot, assinatura e bloqueio automatico.</p>
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
            <input value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome do plano" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
            <input value={form.precoMensal} onChange={(event) => setForm((current) => ({ ...current, precoMensal: event.target.value }))} placeholder="Preco mensal" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
            <input value={form.limiteTokensTotalMensal} onChange={(event) => setForm((current) => ({ ...current, limiteTokensTotalMensal: event.target.value }))} placeholder="Limite tokens total mensal" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
            <input value={form.limiteCustoMensal} onChange={(event) => setForm((current) => ({ ...current, limiteCustoMensal: event.target.value }))} placeholder="Limite custo mensal" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
            <div className="grid gap-4 md:grid-cols-3">
              <input value={form.maxAgentes} onChange={(event) => setForm((current) => ({ ...current, maxAgentes: event.target.value }))} placeholder="Max agentes" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
              <input value={form.maxApis} onChange={(event) => setForm((current) => ({ ...current, maxApis: event.target.value }))} placeholder="Max APIs" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
              <input value={form.maxWhatsapp} onChange={(event) => setForm((current) => ({ ...current, maxWhatsapp: event.target.value }))} placeholder="Max WhatsApp" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none" />
            </div>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200">
              <input type="checkbox" checked={form.ativo} onChange={(event) => setForm((current) => ({ ...current, ativo: event.target.checked }))} />
              Plano ativo
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
                    <p className="mt-2 text-sm text-slate-300">{formatCurrency(plano.precoMensal)} / mes</p>
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
