"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Globe2, Lock, Pencil, Plus, Shield, X } from "lucide-react";
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
  siteChatAtivo: boolean;
};

type Agente = {
  id: string;
  nome: string;
  projetoId: string | null;
  ativo: boolean;
};

type ChatWidget = {
  id?: string;
  nome: string;
  slug: string;
  projetoId: string | null;
  agenteId: string | null;
  dominio: string;
  tema: "dark" | "light";
  corPrimaria: string;
  fundoTransparente: boolean;
  ativo: boolean;
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

const emptyWidgetForm: ChatWidget = {
  nome: "",
  slug: "",
  projetoId: null,
  agenteId: null,
  dominio: "",
  tema: "dark",
  corPrimaria: "#2563eb",
  fundoTransparente: true,
  ativo: true,
};

function renderSnippetLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return <span className="text-slate-500"> </span>;
  }

  if (trimmed.startsWith("<script") || trimmed.startsWith("></script>") || trimmed.startsWith("</script>")) {
    return <span className="text-fuchsia-300">{line}</span>;
  }

  const parts = line.split(/(data-[\w-]+|src)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part === "src" || part.startsWith("data-")) {
          return (
            <span key={`${part}-${index}`} className="text-cyan-300">
              {part}
            </span>
          );
        }

        if (part.includes("=") || part.includes('"')) {
          return (
            <span key={`${part}-${index}`} className="text-emerald-200">
              {part}
            </span>
          );
        }

        return <span key={`${part}-${index}`} className="text-slate-200">{part}</span>;
      })}
    </>
  );
}

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
  const [widgets, setWidgets] = useState<ChatWidget[]>([]);
  const [projetoForm, setProjetoForm] = useState<ProjetoFormState>(emptyProjetoForm);
  const [widgetForm, setWidgetForm] = useState<ChatWidget>(emptyWidgetForm);
  const [projetoModalOpen, setProjetoModalOpen] = useState(false);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [savingProjeto, setSavingProjeto] = useState(false);
  const [savingWidget, setSavingWidget] = useState(false);
  const [feedbackProjeto, setFeedbackProjeto] = useState<string | null>(null);
  const [feedbackWidget, setFeedbackWidget] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const loadProjetos = async () => {
    const response = await fetch("/api/admin/projetos", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { projetos?: Projeto[] };
    setProjetos(payload.projetos ?? []);
  };

  const loadWidgets = async () => {
    const response = await fetch("/api/admin/chat-widgets", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { widgets?: ChatWidget[]; projetos?: Projeto[]; agentes?: Agente[] };
    setWidgets(payload.widgets ?? []);
    setAgentes(payload.agentes ?? []);
    if ((payload.projetos ?? []).length) {
      setProjetos(payload.projetos ?? []);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }

    const loadData = async () => {
      const user = await getCurrentProjectUser();
      setCurrentUser(user);

      await Promise.all([loadProjetos(), loadWidgets()]);
    };

    void loadData();
  }, []);

  const isAllowed = canAccessAdmin(currentUser);

  const agentesDoProjetoSelecionado = useMemo(
    () => agentes.filter((agente) => agente.projetoId === widgetForm.projetoId),
    [agentes, widgetForm.projetoId],
  );

  const buildWidgetSnippet = (widget: ChatWidget) => {
    const base = origin || "https://seu-dominio";
    return `<script src="${base}/chat-widget.js" data-widget="${widget.slug}" data-title="${widget.nome}" data-theme="${widget.tema}" data-accent="${widget.corPrimaria}" data-transparent="${widget.fundoTransparente ? "true" : "false"}"></script>`;
  };

  const resetProjetoForm = () => {
    setProjetoForm(emptyProjetoForm);
    setFeedbackProjeto(null);
  };

  const resetWidgetForm = () => {
    setWidgetForm(emptyWidgetForm);
    setFeedbackWidget(null);
  };

  const openNewProjetoModal = () => {
    resetProjetoForm();
    setProjetoModalOpen(true);
  };

  const openNewWidgetModal = () => {
    resetWidgetForm();
    setWidgetModalOpen(true);
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

    await loadProjetos();
    const message = projetoForm.id ? "Projeto atualizado com sucesso." : "Projeto criado com sucesso.";
    resetProjetoForm();
    setSavingProjeto(false);
    setProjetoModalOpen(false);
    setFeedbackProjeto(message);
  };

  const handleWidgetSubmit = async () => {
    setSavingWidget(true);
    setFeedbackWidget(null);

    const response = await fetch("/api/admin/chat-widgets", {
      method: widgetForm.id ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(widgetForm),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedbackWidget(payload.error ?? "Nao foi possivel salvar o widget.");
      setSavingWidget(false);
      return;
    }

    await loadWidgets();
    const message = widgetForm.id ? "Widget atualizado com sucesso." : "Widget criado com sucesso.";
    resetWidgetForm();
    setSavingWidget(false);
    setWidgetModalOpen(false);
    setFeedbackWidget(message);
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

  const handleWidgetEdit = (widget: ChatWidget) => {
    setWidgetForm({
      id: widget.id,
      nome: widget.nome,
      slug: widget.slug,
      projetoId: widget.projetoId,
      agenteId: widget.agenteId,
      dominio: widget.dominio,
      tema: widget.tema,
      corPrimaria: widget.corPrimaria,
      fundoTransparente: widget.fundoTransparente,
      ativo: widget.ativo,
    });
    setFeedbackWidget(null);
    setWidgetModalOpen(true);
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
          <p className="mt-3 max-w-xl text-slate-300">Entre com o usuario master para administrar projetos e widgets de chat.</p>
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
          <h2 className="text-2xl font-bold text-white">Somente o master pode gerenciar projetos e widgets</h2>
          <p className="mt-3 max-w-xl text-slate-300">Usuarios comuns operam apenas os agentes e chats do proprio projeto.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
          <BriefcaseBusiness size={14} />
          Projetos e Widgets
        </div>
        <h1 className="text-4xl font-extrabold text-white">Gestao de projetos e canais de chat</h1>
        <p className="mt-4 max-w-3xl text-slate-400">
          Cada widget de chat aponta para um projeto e, opcionalmente, para um agente especifico. Assim o mesmo backend atende a InfraStudio ou qualquer site externo sem trocar codigo.
        </p>
      </section>

      {(feedbackProjeto || feedbackWidget) && (
        <section className="grid gap-3">
          {feedbackProjeto ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackProjeto}</div> : null}
          {feedbackWidget ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackWidget}</div> : null}
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1.25fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div>
              <h3 className="text-xl font-bold text-white">Projetos cadastrados</h3>
              <p className="mt-1 text-sm text-slate-400">Crie e edite projetos antes de conectar agentes, APIs e widgets.</p>
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
            {projetos.length ? (
              projetos.map((projeto) => (
                <div key={projeto.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-bold text-white">{projeto.nome}</h4>
                        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">
                          {projeto.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                        slug: {projeto.slug ?? "sem-slug"} {projeto.tipo ? `• tipo: ${projeto.tipo}` : ""}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-slate-400">{projeto.descricao || "Sem descricao."}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/projetos/${projeto.id}`}
                        className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-100"
                      >
                        Abrir
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleProjetoEdit(projeto)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200"
                      >
                        Editar
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

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div>
              <h3 className="text-xl font-bold text-white">Widgets de chat</h3>
              <p className="mt-1 text-sm text-slate-400">Use um widget por canal, site, landing page ou embed externo.</p>
            </div>
            <button
              type="button"
              onClick={openNewWidgetModal}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white"
            >
              <Plus size={16} />
              Novo widget
            </button>
          </div>

          <div className="space-y-4 p-6">
            {widgets.length ? (
              widgets.map((widget) => {
                const projeto = projetos.find((item) => item.id === widget.projetoId);
                const agente = agentes.find((item) => item.id === widget.agenteId);

                return (
                  <div key={widget.id ?? widget.slug} className="rounded-xl border border-white/10 bg-slate-950/30 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg font-bold text-white">{widget.nome}</h4>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${widget.ativo ? "bg-emerald-500/10 text-emerald-200" : "bg-slate-800 text-slate-400"}`}>
                            {widget.ativo ? "ativo" : "inativo"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">slug: {widget.slug}</p>
                        <p className="mt-3 text-sm text-slate-300">Projeto: {projeto?.nome ?? "nao vinculado"}</p>
                        <p className="mt-1 text-sm text-slate-400">Agente: {agente?.nome ?? "agente ativo do projeto"}</p>
                        <p className="mt-1 text-sm text-slate-400">Dominio/contexto: {widget.dominio || "nao informado"}</p>
                        <p className="mt-1 text-sm text-slate-400">Tema: {widget.tema === "light" ? "claro" : "escuro"} • cor: {widget.corPrimaria}</p>
                        <p className="mt-1 text-sm text-slate-400">Fundo: {widget.fundoTransparente ? "transparente" : "solido"}</p>
                        <div className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950/60 p-3">
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Codigo de injecao</p>
                          <div className="w-full overflow-x-auto rounded-lg border border-white/10 bg-[#07111f]">
                            <pre className="min-h-[170px] w-full whitespace-pre-wrap break-all px-4 py-4 font-mono text-xs leading-6">
                              {buildWidgetSnippet(widget)
                                .split("\n")
                                .map((line, index) => (
                                  <div key={`${widget.slug}-line-${index}`}>{renderSnippetLine(line)}</div>
                                ))}
                            </pre>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleWidgetEdit(widget)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">
                Nenhum widget cadastrado ainda.
              </div>
            )}
          </div>
        </div>
      </section>

      <AdminModal
        open={projetoModalOpen}
        title={projetoForm.id ? "Editar projeto" : "Novo projeto"}
        subtitle="Crie o projeto e depois conecte agentes, APIs e widgets."
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

      <AdminModal
        open={widgetModalOpen}
        title={widgetForm.id ? "Editar widget" : "Novo widget"}
        subtitle="Configure qual projeto esse canal de chat deve usar."
        onClose={() => setWidgetModalOpen(false)}
      >
        <div className="space-y-4">
          <input
            value={widgetForm.nome}
            onChange={(event) => setWidgetForm((prev) => ({ ...prev, nome: event.target.value }))}
            placeholder="Nome do widget"
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
          />
          <input
            value={widgetForm.slug}
            onChange={(event) => setWidgetForm((prev) => ({ ...prev, slug: event.target.value }))}
            placeholder="Slug publico do widget"
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
          />
          <input
            value={widgetForm.dominio}
            onChange={(event) => setWidgetForm((prev) => ({ ...prev, dominio: event.target.value }))}
            placeholder="Dominio permitido ou contexto do embed"
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
          />
          <div className="grid gap-4 sm:grid-cols-[0.7fr_0.3fr]">
            <select
              value={widgetForm.tema}
              onChange={(event) => setWidgetForm((prev) => ({ ...prev, tema: event.target.value === "light" ? "light" : "dark" }))}
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
            >
              <option value="dark">Tema escuro</option>
              <option value="light">Tema claro</option>
            </select>
            <input
              type="color"
              value={widgetForm.corPrimaria}
              onChange={(event) => setWidgetForm((prev) => ({ ...prev, corPrimaria: event.target.value }))}
              className="h-[50px] w-full rounded-xl border border-white/10 bg-slate-950/50 px-2 py-2"
            />
          </div>
          <select
            value={widgetForm.projetoId ?? ""}
            onChange={(event) =>
              setWidgetForm((prev) => ({
                ...prev,
                projetoId: event.target.value || null,
                agenteId: null,
              }))
            }
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
          >
            <option value="">Selecione o projeto do widget</option>
            {projetos.map((projeto) => (
              <option key={projeto.id} value={projeto.id}>
                {projeto.nome}
              </option>
            ))}
          </select>
          <select
            value={widgetForm.agenteId ?? ""}
            onChange={(event) => setWidgetForm((prev) => ({ ...prev, agenteId: event.target.value || null }))}
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
          >
            <option value="">Usar o agente ativo do projeto</option>
            {agentesDoProjetoSelecionado.map((agente) => (
              <option key={agente.id} value={agente.id}>
                {agente.nome}{agente.ativo ? " (ativo)" : ""}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={widgetForm.ativo}
              onChange={(event) => setWidgetForm((prev) => ({ ...prev, ativo: event.target.checked }))}
            />
            Widget ativo
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={widgetForm.fundoTransparente}
              onChange={(event) => setWidgetForm((prev) => ({ ...prev, fundoTransparente: event.target.checked }))}
            />
            Fundo transparente
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleWidgetSubmit()}
              disabled={savingWidget}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white"
            >
              {widgetForm.id ? <Pencil size={16} /> : <Plus size={16} />}
              {savingWidget ? "Salvando..." : widgetForm.id ? "Atualizar widget" : "Criar widget"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetWidgetForm();
                setWidgetModalOpen(false);
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white"
            >
              Cancelar
            </button>
          </div>

          {feedbackWidget ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {feedbackWidget}
            </div>
          ) : null}
        </div>
      </AdminModal>
    </main>
  );
}
