"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, Lock, Plus, Shield } from "lucide-react";
import { canAccessWorkspace } from "@/lib/access";
import { getCurrentProjectUser } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";

type Projeto = {
  id: string;
  nome: string;
  descricao: string;
  status: string;
};

type ProjetoFormState = {
  nome: string;
  slug: string;
  tipo: string;
  descricao: string;
  status: string;
};

const emptyProjetoForm: ProjetoFormState = {
  nome: "",
  slug: "",
  tipo: "",
  descricao: "",
  status: "ativo",
};

export default function AdminProjetosPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [form, setForm] = useState<ProjetoFormState>(emptyProjetoForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadProjetos = async () => {
    const response = await fetch("/api/admin/projetos", { cache: "no-store" });
    const payload = (await response.json()) as { projetos?: Projeto[] };
    setProjetos(payload.projetos ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentProjectUser();
      setCurrentUser(user);

      if (!canAccessWorkspace(user)) {
        setLoading(false);
        return;
      }

      await loadProjetos();
    };

    void load();
  }, []);

  const handleSubmit = async () => {
    setSaving(true);
    setFeedback(null);

    const response = await fetch("/api/admin/projetos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = (await response.json()) as { error?: string; projeto?: Projeto };

    if (!response.ok) {
      setFeedback(payload.error ?? "Nao foi possivel criar o projeto.");
      setSaving(false);
      return;
    }

    setProjetos((current) => [...current, payload.projeto!].sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR")));
    setForm(emptyProjetoForm);
    setModalOpen(false);
    setSaving(false);
    setFeedback("Projeto criado com sucesso.");
  };

  if (loading && !currentUser) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">
          Carregando projetos...
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
            <Lock size={14} />
            Acesso bloqueado
          </div>
          <h2 className="text-2xl font-bold text-white">Voce ainda nao fez login</h2>
          <p className="mt-3 max-w-xl text-slate-300">Entre para acessar seus projetos.</p>
        </section>
      </main>
    );
  }

  if (!canAccessWorkspace(currentUser)) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-200">
            <Shield size={14} />
            Permissao insuficiente
          </div>
          <h2 className="text-2xl font-bold text-white">Sem acesso ao ambiente</h2>
          <p className="mt-3 max-w-xl text-slate-300">Seu usuario precisa estar autenticado para criar ou acessar projetos.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
          <BriefcaseBusiness size={14} />
          Projetos
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-white">Seus projetos</h1>
            <p className="mt-4 max-w-3xl text-slate-400">Abra um projeto para continuar o trabalho no contexto correto.</p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white"
          >
            <Plus size={16} />
            Criar projeto
          </button>
        </div>
      </section>

      {feedback ? <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</section> : null}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-6 py-5">
          <h2 className="text-xl font-bold text-white">Projetos vinculados</h2>
        </div>
        <div className="space-y-4 p-6">
          {loading ? <div className="rounded-xl border border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">Carregando projetos...</div> : null}
          {!loading && !projetos.length ? <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">Nenhum projeto vinculado ainda.</div> : null}
          {projetos.map((projeto) => (
            <div key={projeto.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-bold text-white">{projeto.nome}</h3>
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">{projeto.status}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{projeto.descricao || "Sem descricao."}</p>
                </div>
                <Link href={`/admin/projetos/${projeto.id}`} className="inline-flex items-center rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-100">
                  Abrir projeto
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-brand-dark p-6 shadow-2xl">
            <h2 className="text-2xl font-extrabold text-white">Criar projeto</h2>
            <div className="mt-6 grid gap-4">
              <input value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome" className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" />
              <input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="Slug" className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" />
              <input value={form.tipo} onChange={(event) => setForm((current) => ({ ...current, tipo: event.target.value }))} placeholder="Tipo" className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" />
              <textarea value={form.descricao} onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))} placeholder="Descricao" rows={4} className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" />
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200">Cancelar</button>
              <button type="button" onClick={() => void handleSubmit()} disabled={saving} className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Criando..." : "Criar projeto"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
