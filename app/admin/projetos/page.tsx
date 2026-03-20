"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Lock, Pencil, Plus, Shield, Workflow, X } from "lucide-react";
import { canAccessAdmin } from "@/lib/access";
import { getCurrentProjectUser } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";

type Projeto = {
  id: string;
  nome: string;
  slug: string | null;
  tipo: string | null;
  descricao: string;
  status: string;
};

type Agente = {
  id: string;
  projetoId: string | null;
};

type Api = {
  id: string;
  projetoId: string | null;
};

type ChatWidget = {
  id?: string;
  projetoId: string | null;
};

type ProjetoFormState = {
  id?: string;
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

function AdminModal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="text-2xl font-extrabold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(92vh-88px)] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export default function AdminProjetosPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [apis, setApis] = useState<Api[]>([]);
  const [widgets, setWidgets] = useState<ChatWidget[]>([]);
  const [projetoForm, setProjetoForm] = useState<ProjetoFormState>(emptyProjetoForm);
  const [projetoModalOpen, setProjetoModalOpen] = useState(false);
  const [savingProjeto, setSavingProjeto] = useState(false);
  const [feedbackProjeto, setFeedbackProjeto] = useState<string | null>(null);

  const isAllowed = canAccessAdmin(currentUser);

  const loadProjetos = async () => {
    const response = await fetch("/api/admin/projetos", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { projetos?: Projeto[] };
    setProjetos(payload.projetos ?? []);
  };

  const loadProjectResources = async () => {
    const response = await fetch("/api/admin/chat-widgets", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      projetos?: Projeto[];
      agentes?: Agente[];
      apis?: Api[];
      widgets?: ChatWidget[];
    };

    setAgentes(payload.agentes ?? []);
    setApis(payload.apis ?? []);
    setWidgets(payload.widgets ?? []);

    if ((payload.projetos ?? []).length) {
      setProjetos(payload.projetos ?? []);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const user = await getCurrentProjectUser();
      setCurrentUser(user);

      if (!canAccessAdmin(user)) {
        return;
      }

      await Promise.all([loadProjetos(), loadProjectResources()]);
    };

    void loadData();
  }, []);

  const projectSummaries = useMemo(() => {
    return projetos.map((projeto) => ({
      projeto,
      totalAgentes: agentes.filter((agente) => agente.projetoId === projeto.id).length,
      totalApis: apis.filter((api) => api.projetoId === projeto.id).length,
      totalWidgets: widgets.filter((widget) => widget.projetoId === projeto.id).length,
    }));
  }, [agentes, apis, projetos, widgets]);

  const resetProjetoForm = () => {
    setProjetoForm(emptyProjetoForm);
    setFeedbackProjeto(null);
  };

  const openNewProjetoModal = () => {
    resetProjetoForm();
    setProjetoModalOpen(true);
  };

  const handleProjetoEdit = (projeto: Projeto) => {
    setProjetoForm({
      id: projeto.id,
      nome: projeto.nome,
      slug: projeto.slug ?? "",
      tipo: projeto.tipo ?? "",
      descricao: projeto.descricao,
      status: projeto.status,
    });
    setFeedbackProjeto(null);
    setProjetoModalOpen(true);
  };

  const handleProjetoSubmit = async () => {
    setSavingProjeto(true);
    setFeedbackProjeto(null);

    const response = await fetch("/api/admin/projetos", {
      method: projetoForm.id ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(projetoForm),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedbackProjeto(payload.error ?? "Nao foi possivel salvar o projeto.");
      setSavingProjeto(false);
      return;
    }

    await Promise.all([loadProjetos(), loadProjectResources()]);
    const message = projetoForm.id ? "Projeto atualizado com sucesso." : "Projeto criado com sucesso.";
    resetProjetoForm();
    setSavingProjeto(false);
    setProjetoModalOpen(false);
    setFeedbackProjeto(message);
  };

  if (!currentUser) {
    return (
      <main className="space-y-6">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
            <Lock size={14} />
            Acesso bloqueado
          </div>
          <h2 className="text-2xl font-bold text-white">Voce ainda nao fez login</h2>
          <p className="mt-3 max-w-xl text-slate-300">Entre com o usuario master para administrar projetos.</p>
        </div>
      </main>
    );
  }

  if (!isAllowed || !currentUser.isMaster) {
    return (
      <main className="space-y-6">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-200">
            <Shield size={14} />
            Permissao insuficiente
          </div>
          <h2 className="text-2xl font-bold text-white">Somente o master pode gerenciar projetos</h2>
          <p className="mt-3 max-w-xl text-slate-300">O fluxo administrativo agora comeca em projetos e se desdobra dentro de cada projeto.</p>
        </div>
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
        <h1 className="text-4xl font-extrabold text-white">Escolha um projeto para abrir o workspace</h1>
        <p className="mt-4 max-w-3xl text-slate-400">
          O fluxo do painel agora segue uma ordem unica: primeiro projeto, depois chat, agente, API e widget dentro dele. Nao existe mais atalho solto para agentes no menu.
        </p>
      </section>

      {feedbackProjeto ? (
        <section>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackProjeto}</div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">Projetos cadastrados</h3>
              <p className="mt-1 text-sm text-slate-400">Entre em um projeto para liberar a gestao de agentes, APIs, widgets e chats desse contexto.</p>
            </div>
            <button
              type="button"
              onClick={openNewProjetoModal}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white"
            >
              <Plus size={16} />
              Novo projeto
            </button>
          </div>

          <div className="space-y-4 p-6">
            {projectSummaries.length ? (
              projectSummaries.map(({ projeto, totalAgentes, totalApis, totalWidgets }) => (
                <div key={projeto.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h4 className="text-lg font-bold text-white">{projeto.nome}</h4>
                        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">
                          {projeto.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                        slug: {projeto.slug ?? "sem-slug"} {projeto.tipo ? `• tipo: ${projeto.tipo}` : ""}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-slate-400">{projeto.descricao || "Sem descricao."}</p>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{totalAgentes} agentes</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{totalApis} APIs</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{totalWidgets} widgets</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/admin/projetos/${projeto.id}`}
                        className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-100"
                      >
                        Abrir workspace
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleProjetoEdit(projeto)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Pencil size={14} />
                          Editar
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">
                Nenhum projeto cadastrado ainda.
              </div>
            )}
          </div>
        </div>

        <aside className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-6 py-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              <Workflow size={14} />
              Fluxo correto
            </div>
            <h3 className="mt-4 text-xl font-bold text-white">Tudo nasce dentro do projeto</h3>
            <p className="mt-2 text-sm text-slate-400">A navegacao foi simplificada para refletir a ordem real de configuracao e operacao.</p>
          </div>

          <div className="space-y-4 p-6">
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">1. Escolha o projeto</p>
              <p className="mt-2 text-sm text-slate-300">A lista de projetos virou o ponto de entrada principal do painel.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">2. Entre no workspace</p>
              <p className="mt-2 text-sm text-slate-300">Dentro do projeto voce encontra agentes, APIs, widgets e os chats recentes daquele contexto.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">3. Opere sem redundancia</p>
              <p className="mt-2 text-sm text-slate-300">Sem menu paralelo para agentes, o painel evita bifurcacao e deixa a jornada mais previsivel.</p>
            </div>
          </div>
        </aside>
      </section>

      <AdminModal
        open={projetoModalOpen}
        title={projetoForm.id ? "Editar projeto" : "Novo projeto"}
        subtitle="Crie o projeto e depois conecte agentes, APIs e widgets dentro dele."
        onClose={() => setProjetoModalOpen(false)}
      >
        <div className="space-y-4">
          <input
            value={projetoForm.nome}
            onChange={(event) => setProjetoForm((prev) => ({ ...prev, nome: event.target.value }))}
            placeholder="Nome do projeto"
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
          />
          <input
            value={projetoForm.slug}
            onChange={(event) => setProjetoForm((prev) => ({ ...prev, slug: event.target.value }))}
            placeholder="Slug do projeto"
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
          />
          <input
            value={projetoForm.tipo}
            onChange={(event) => setProjetoForm((prev) => ({ ...prev, tipo: event.target.value }))}
            placeholder="Tipo do projeto"
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
          />
          <textarea
            value={projetoForm.descricao}
            onChange={(event) => setProjetoForm((prev) => ({ ...prev, descricao: event.target.value }))}
            placeholder="Descricao do projeto"
            rows={6}
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <select
            value={projetoForm.status}
            onChange={(event) => setProjetoForm((prev) => ({ ...prev, status: event.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
          >
            <option value="ativo">ativo</option>
            <option value="pendente">pendente</option>
            <option value="arquivado">arquivado</option>
          </select>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleProjetoSubmit()}
              disabled={savingProjeto}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white"
            >
              {projetoForm.id ? <Pencil size={16} /> : <Plus size={16} />}
              {savingProjeto ? "Salvando..." : projetoForm.id ? "Atualizar projeto" : "Criar projeto"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetProjetoForm();
                setProjetoModalOpen(false);
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white"
            >
              Cancelar
            </button>
          </div>

          {feedbackProjeto ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {feedbackProjeto}
            </div>
          ) : null}
        </div>
      </AdminModal>
    </main>
  );
}
