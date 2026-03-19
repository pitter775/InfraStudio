"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, BrainCircuit, Lock, Pencil, Plus, Search, Shield, Sparkles, X } from "lucide-react";
import { canAccessAdmin } from "@/lib/access";
import { getCurrentProjectUser } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";

type Agente = {
  id: string;
  slug: string | null;
  nome: string;
  descricao: string;
  promptBase: string;
  configuracoes: Record<string, unknown> | null;
  ativo: boolean;
  createdAt: string;
  projetoId: string | null;
  projetoNome?: string | null;
  projetoSlug?: string | null;
};

type Projeto = {
  id: string;
  nome: string;
  slug: string | null;
};

type AgenteFormState = {
  id?: string;
  projetoId: string;
  slug: string;
  nome: string;
  descricao: string;
  promptBase: string;
  configuracoes: string;
  ativo: boolean;
};

const defaultConfiguracoes = {
  objetivo: "Qualificar leads da InfraStudio, entender escopo e estimar projetos simples.",
  capacidades: ["chat para site", "automacao whatsapp", "integracao crm", "sistema sob medida"],
  perguntas_qualificacao: ["segmento", "objetivo", "canal", "volume", "integracoes", "prazo"],
  limites_comerciais: [
    "nao inventar funcionalidades",
    "nao prometer prazos fechados sem escopo suficiente",
    "nao precificar projetos fora do catalogo conhecido",
  ],
  handoff: {
    enviar_para_humano_se: ["escopo_incompleto", "projeto_complexo", "cliente_pedir_reuniao"],
  },
};

const emptyForm: AgenteFormState = {
  projetoId: "",
  slug: "",
  nome: "",
  descricao: "",
  promptBase: "",
  configuracoes: JSON.stringify(defaultConfiguracoes, null, 2),
  ativo: true,
};

function AgentModal({
  open,
  form,
  projetos,
  currentUser,
  saving,
  feedback,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean;
  form: AgenteFormState;
  projetos: Projeto[];
  currentUser: AppUser | null;
  saving: boolean;
  feedback: string | null;
  onClose: () => void;
  onChange: (next: Partial<AgenteFormState>) => void;
  onSubmit: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Agente</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{form.id ? "Editar agente" : "Novo agente"}</h2>
            <p className="mt-1 text-sm text-slate-400">Ajuste projeto, prompt base e configuracoes sem sair da listagem.</p>
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

        <div className="grid max-h-[calc(92vh-88px)] gap-0 overflow-y-auto lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 p-6">
            {currentUser?.isMaster ? (
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-300">Projeto</span>
                <select
                  value={form.projetoId}
                  onChange={(event) => onChange({ projetoId: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
                >
                  <option value="">Selecione o projeto</option>
                  {projetos.map((projeto) => (
                    <option key={projeto.id} value={projeto.id}>
                      {projeto.nome}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                Projeto atual: {currentUser?.memberships?.[0]?.projetoNome ?? "Projeto do cliente"}
              </div>
            )}

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-300">Slug</span>
              <input
                value={form.slug}
                onChange={(event) => onChange({ slug: event.target.value })}
                placeholder="comercial-imovel"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-300">Nome</span>
              <input
                value={form.nome}
                onChange={(event) => onChange({ nome: event.target.value })}
                placeholder="Agente comercial principal"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-300">Descricao</span>
              <input
                value={form.descricao}
                onChange={(event) => onChange({ descricao: event.target.value })}
                placeholder="Descricao curta do papel desse agente"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-300">Prompt base</span>
              <textarea
                value={form.promptBase}
                onChange={(event) => onChange({ promptBase: event.target.value })}
                rows={8}
                placeholder="Prompt base do agente"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-300">Configuracoes</span>
              <textarea
                value={form.configuracoes}
                onChange={(event) => onChange({ configuracoes: event.target.value })}
                rows={14}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4 font-mono text-xs leading-relaxed text-cyan-100 outline-none"
              />
            </label>
          </div>

          <div className="border-t border-white/10 bg-white/[0.03] p-6 lg:border-l lg:border-t-0">
            <div className="mb-5 rounded-2xl border border-cyan-500/15 bg-cyan-500/10 p-5">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950/20 text-cyan-100">
                <BrainCircuit size={22} />
              </div>
              <p className="text-lg font-bold text-white">{form.nome || "Agente sem nome"}</p>
              <p className="mt-2 text-sm leading-relaxed text-cyan-50">
                {form.descricao || "Defina o papel comercial e o comportamento desse agente para o projeto selecionado."}
              </p>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <input type="checkbox" checked={form.ativo} onChange={(event) => onChange({ ativo: event.target.checked })} />
              Agente ativo para o chat do site
            </label>

            <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-slate-950/30 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Resumo rapido</p>
              <p className="text-sm text-slate-300">Projeto: {projetos.find((item) => item.id === form.projetoId)?.nome ?? "Nao definido"}</p>
              <p className="text-sm text-slate-300">Slug: {form.slug || "Nao definido"}</p>
              <p className="text-sm text-slate-300">Status: {form.ativo ? "Ativo" : "Inativo"}</p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onSubmit}
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white"
              >
                {form.id ? <Pencil size={16} /> : <Plus size={16} />}
                {saving ? "Salvando..." : form.id ? "Atualizar agente" : "Criar agente"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white"
              >
                Cancelar
              </button>
            </div>

            {feedback ? (
              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {feedback}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminAgentesPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [form, setForm] = useState<AgenteFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [filterProjectId, setFilterProjectId] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const [user, agentesResponse, projetosResponse] = await Promise.all([
        getCurrentProjectUser(),
        fetch("/api/admin/agentes", { cache: "no-store" }),
        fetch("/api/admin/projetos", { cache: "no-store" }),
      ]);

      setCurrentUser(user);

      if (agentesResponse.ok) {
        const payload = (await agentesResponse.json()) as { agentes?: Agente[] };
        setAgentes(payload.agentes ?? []);
      }

      if (projetosResponse.ok) {
        const payload = (await projetosResponse.json()) as { projetos?: Projeto[] };
        const nextProjetos = payload.projetos ?? [];
        setProjetos(nextProjetos);
        const initialProjectId = user?.isMaster ? nextProjetos[0]?.id ?? "" : user?.currentProjectId ?? nextProjetos[0]?.id ?? "";
        setFilterProjectId(initialProjectId);
        setForm((prev) => ({
          ...prev,
          projetoId: prev.projetoId || initialProjectId,
        }));
      }
    };

    void loadData();
  }, []);

  const isAllowed = canAccessAdmin(currentUser);
  const effectiveProjectId = currentUser?.isMaster ? filterProjectId : currentUser?.currentProjectId ?? filterProjectId;
  const normalizedSearch = search.trim().toLowerCase();

  const visibleAgentes = useMemo(() => {
    return agentes.filter((agente) => {
      const matchesProject = effectiveProjectId ? agente.projetoId === effectiveProjectId : true;
      const haystack = [agente.nome, agente.slug ?? "", agente.descricao, agente.projetoNome ?? ""].join(" ").toLowerCase();
      const matchesSearch = normalizedSearch ? haystack.includes(normalizedSearch) : true;
      return matchesProject && matchesSearch;
    });
  }, [agentes, effectiveProjectId, normalizedSearch]);

  const agenteAtivo =
    (effectiveProjectId ? agentes.find((agente) => agente.ativo && agente.projetoId === effectiveProjectId) : null) ??
    agentes.find((agente) => agente.ativo) ??
    null;

  const refreshAgentes = async () => {
    const response = await fetch("/api/admin/agentes", { cache: "no-store" });
    const payload = (await response.json()) as { agentes?: Agente[] };
    setAgentes(payload.agentes ?? []);
  };

  const openNewModal = () => {
    const projectId = currentUser?.isMaster ? effectiveProjectId || projetos[0]?.id || "" : currentUser?.currentProjectId ?? "";
    setForm({
      ...emptyForm,
      projetoId: projectId,
    });
    setFeedback(null);
    setModalOpen(true);
  };

  const handleEdit = (agente: Agente) => {
    setForm({
      id: agente.id,
      projetoId: agente.projetoId ?? currentUser?.currentProjectId ?? "",
      slug: agente.slug ?? "",
      nome: agente.nome,
      descricao: agente.descricao,
      promptBase: agente.promptBase,
      configuracoes: JSON.stringify(agente.configuracoes ?? defaultConfiguracoes, null, 2),
      ativo: agente.ativo,
    });
    setFeedback(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setFeedback(null);

    try {
      JSON.parse(form.configuracoes);
    } catch {
      setFeedback("O JSON de configuracoes esta invalido.");
      setSaving(false);
      return;
    }

    const method = form.id ? "PUT" : "POST";
    const response = await fetch("/api/admin/agentes", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedback(payload.error ?? "Nao foi possivel salvar o agente.");
      setSaving(false);
      return;
    }

    await refreshAgentes();
    setSaving(false);
    setFeedback(form.id ? "Agente atualizado com sucesso." : "Agente criado com sucesso.");
    setModalOpen(false);
  };

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
          <Bot size={14} />
          Agentes
        </div>
        <h1 className="text-4xl font-extrabold text-white">Gestao de agentes</h1>
        <p className="mt-4 max-w-3xl text-slate-400">
          Centralize os agentes por cliente, filtre por projeto e edite tudo em modal sem sair da listagem.
        </p>
      </section>

      {!currentUser ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
            <Lock size={14} />
            Acesso bloqueado
          </div>
          <h2 className="text-2xl font-bold text-white">Voce ainda nao fez login</h2>
          <p className="mt-3 max-w-xl text-slate-300">Entre com o usuario master para administrar os agentes.</p>
        </div>
      ) : !isAllowed ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-200">
            <Shield size={14} />
            Permissao insuficiente
          </div>
          <h2 className="text-2xl font-bold text-white">Seu perfil nao tem acesso administrativo</h2>
          <p className="mt-3 max-w-xl text-slate-300">Neste momento, a gestao de agentes fica disponivel apenas para o master.</p>
        </div>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Agente ativo no projeto</p>
              <p className="mt-3 text-2xl font-extrabold text-white">{agenteAtivo?.nome ?? "Nenhum agente ativo"}</p>
              <p className="mt-2 text-sm text-slate-400">O chat usa sempre o agente marcado como ativo no projeto filtrado.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Agentes visiveis</p>
              <p className="mt-3 text-2xl font-extrabold text-white">{visibleAgentes.length}</p>
              <p className="mt-2 text-sm text-slate-400">Resultado do filtro atual por cliente e busca.</p>
            </div>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950/20 text-cyan-100">
                <Sparkles size={18} />
              </div>
              <p className="text-sm leading-relaxed text-cyan-50">
                Clique em editar para abrir o modal e ajustar prompt, JSON, status e projeto do agente.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5">
            <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Tabela de agentes</h2>
                <p className="mt-1 text-sm text-slate-400">Filtre por projeto e edite qualquer agente pelo modal.</p>
              </div>
              <button
                type="button"
                onClick={openNewModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-semibold text-white"
              >
                <Plus size={16} />
                Novo agente
              </button>
            </div>

            <div className="grid gap-4 border-b border-white/10 px-6 py-5 lg:grid-cols-[260px_1fr]">
              {currentUser?.isMaster ? (
                <select
                  value={filterProjectId}
                  onChange={(event) => setFilterProjectId(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
                >
                  <option value="">Todos os projetos</option>
                  {projetos.map((projeto) => (
                    <option key={projeto.id} value={projeto.id}>
                      {projeto.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                  Projeto atual: {currentUser?.memberships?.[0]?.projetoNome ?? "Projeto do cliente"}
                </div>
              )}

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <Search size={16} className="text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, slug, descricao ou cliente"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-950/25">
                  <tr className="text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-6 py-4">Agente</th>
                    <th className="px-6 py-4">Projeto</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Criado em</th>
                    <th className="px-6 py-4">Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAgentes.length ? (
                    visibleAgentes.map((agente) => (
                      <tr key={agente.id} className="border-t border-white/8 text-sm text-slate-300">
                        <td className="px-6 py-5">
                          <p className="font-semibold text-white">{agente.nome}</p>
                          <p className="mt-1 text-slate-400">{agente.descricao || "Sem descricao."}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-cyan-200/80">{agente.slug || "sem-slug"}</p>
                        </td>
                        <td className="px-6 py-5">
                          <p className="font-semibold text-white">{agente.projetoNome ?? "Sem projeto"}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{agente.projetoSlug ?? "sem-slug"}</p>
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                              agente.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {agente.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-slate-400">{new Date(agente.createdAt).toLocaleDateString("pt-BR")}</td>
                        <td className="px-6 py-5">
                          <button
                            type="button"
                            onClick={() => handleEdit(agente)}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white transition-colors hover:bg-white/10"
                          >
                            <Pencil size={14} />
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                        Nenhum agente encontrado para o filtro atual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <AgentModal
            open={modalOpen}
            form={form}
            projetos={projetos}
            currentUser={currentUser}
            saving={saving}
            feedback={feedback}
            onClose={() => {
              setModalOpen(false);
              setFeedback(null);
            }}
            onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
            onSubmit={() => void handleSubmit()}
          />
        </>
      )}
    </main>
  );
}
