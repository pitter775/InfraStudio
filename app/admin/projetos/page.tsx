"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, Cable, LoaderCircle, Lock, MessageSquareText, Plus, Shield, Bot } from "lucide-react";
import { canAccessWorkspace } from "@/lib/access";
import { getCurrentProjectUser } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";

type Projeto = {
  id: string;
  nome: string;
  slug?: string | null;
  tipo?: string | null;
  descricao: string;
  status: string;
  stats: {
    totalAgentes: number;
    agentesAtivos: number;
    totalConectores: number;
    conectoresAtivos: number;
    totalChats: number;
  };
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

const primaryActionButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-50 shadow-[0_10px_30px_rgba(56,189,248,0.12)] transition-all hover:border-sky-300/30 hover:bg-sky-400/14 disabled:cursor-not-allowed disabled:opacity-60";

const neutralActionButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.18)] transition-all hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60";

function BusyIcon() {
  return <LoaderCircle size={15} className="animate-spin" />;
}

function CenterLoader() {
  return (
    <div className="flex min-h-[220px] items-center justify-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute h-20 w-20 rounded-full bg-sky-500/20 blur-2xl animate-pulse" />
        <div className="absolute h-14 w-14 rounded-full bg-cyan-400/15 blur-xl animate-pulse" />
        <Image src="/logo.png" alt="InfraStudio" width={38} height={38} className="relative h-10 w-10 object-contain" />
      </div>
    </div>
  );
}

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

    setProjetos((current) =>
      [
        ...current,
        {
          ...payload.projeto!,
          stats: payload.projeto?.stats ?? {
            totalAgentes: 0,
            agentesAtivos: 0,
            totalConectores: 0,
            conectoresAtivos: 0,
            totalChats: 0,
          },
        },
      ].sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR")),
    );
    setForm(emptyProjetoForm);
    setModalOpen(false);
    setSaving(false);
    setFeedback("Projeto criado com sucesso.");
  };

  if (loading && !currentUser) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">
          <CenterLoader />
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
            className={primaryActionButtonClass}
          >
            <Plus size={16} />
            Criar projeto
          </button>
        </div>
      </section>

      {feedback ? <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</section> : null}

      {!loading && projetos.length ? (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 p-5">
            <div className="flex items-end gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Projetos</p>
              <p className="text-3xl font-extrabold leading-none text-white">{projetos.length}</p>
            </div>
            <p className="mt-2 text-sm text-slate-400">Workspaces disponiveis para abrir e operar.</p>
          </div>
          <div className="rounded-2xl border border-white/10 p-5">
            <div className="flex items-end gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Agentes</p>
              <p className="text-3xl font-extrabold leading-none text-white">{projetos.reduce((sum, projeto) => sum + projeto.stats.totalAgentes, 0)}</p>
            </div>
            <p className="mt-2 text-sm text-slate-400">Total consolidado de agentes em todos os projetos visiveis.</p>
          </div>
          <div className="rounded-2xl border border-white/10 p-5">
            <div className="flex items-end gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Chats</p>
              <p className="text-3xl font-extrabold leading-none text-white">{projetos.reduce((sum, projeto) => sum + projeto.stats.totalChats, 0)}</p>
            </div>
            <p className="mt-2 text-sm text-slate-400">Conversas acumuladas nos projetos vinculados.</p>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-white/10">
        <div className="border-b border-white/10 px-6 py-5">
          <h2 className="text-xl font-bold text-white">Projetos vinculados</h2>
        </div>
        <div className="p-6">
          {loading ? <CenterLoader /> : null}
          {!loading && !projetos.length ? <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">Nenhum projeto vinculado ainda.</div> : null}
          {projetos.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {projetos.map((projeto) => (
                <div key={projeto.id} className="rounded-[24px] border border-white/10 p-6">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-2xl font-bold text-white">{projeto.nome}</h3>
                          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">{projeto.status}</span>
                          {projeto.tipo ? (
                            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">{projeto.tipo}</span>
                          ) : null}
                        </div>
                        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">{projeto.descricao || "Sem descricao."}</p>
                      </div>
                      <Link
                        href={`/admin/projetos/${projeto.id}`}
                        className={primaryActionButtonClass}
                      >
                        Abrir projeto
                      </Link>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                      <div className="rounded-2xl border border-white/8 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Slug do projeto</p>
                        <p className="mt-2 truncate text-lg font-bold text-white">{projeto.slug || "Sem slug"}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2 text-cyan-100">
                            <Bot size={16} />
                            <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Agentes</p>
                          </div>
                          <p className="text-3xl font-extrabold leading-none text-white">{projeto.stats.totalAgentes}</p>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">{projeto.stats.agentesAtivos} ativos</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2 text-violet-100">
                            <Cable size={16} />
                            <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Fontes de produto</p>
                          </div>
                          <p className="text-3xl font-extrabold leading-none text-white">{projeto.stats.totalConectores}</p>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">{projeto.stats.conectoresAtivos} ativos</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2 text-emerald-100">
                            <MessageSquareText size={16} />
                            <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Chats</p>
                          </div>
                          <p className="text-3xl font-extrabold leading-none text-white">{projeto.stats.totalChats}</p>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">Historico do projeto</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
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
              <button type="button" onClick={() => setModalOpen(false)} className={neutralActionButtonClass}>Cancelar</button>
              <button type="button" onClick={() => void handleSubmit()} disabled={saving} className={primaryActionButtonClass}>
                {saving ? <BusyIcon /> : <Plus size={16} />}
                Criar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
