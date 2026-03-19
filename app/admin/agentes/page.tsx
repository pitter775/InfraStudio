"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, BrainCircuit, CheckCircle2, Lock, Pencil, Plus, Shield, Sparkles } from "lucide-react";
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

export default function AdminAgentesPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [form, setForm] = useState<AgenteFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const [user, agentesResponse] = await Promise.all([
        getCurrentProjectUser(),
        fetch("/api/admin/agentes", { cache: "no-store" }),
      ]);

      setCurrentUser(user);

      if (agentesResponse.ok) {
        const payload = (await agentesResponse.json()) as { agentes?: Agente[] };
        setAgentes(payload.agentes ?? []);
      }

      const projetosResponse = await fetch("/api/admin/projetos", { cache: "no-store" });
      if (projetosResponse.ok) {
        const payload = (await projetosResponse.json()) as { projetos?: Projeto[] };
        const nextProjetos = payload.projetos ?? [];
        setProjetos(nextProjetos);
        setForm((prev) => ({
          ...prev,
          projetoId: prev.projetoId || user?.currentProjectId || nextProjetos[0]?.id || "",
        }));
      }
    };

    void loadData();
  }, []);

  const isAllowed = canAccessAdmin(currentUser);
  const selectedProjetoId = currentUser?.isMaster ? form.projetoId : currentUser?.currentProjectId ?? form.projetoId;
  const agenteAtivo =
    (selectedProjetoId ? agentes.find((agente) => agente.ativo && agente.projetoId === selectedProjetoId) : null) ??
    agentes.find((agente) => agente.ativo) ??
    null;
  const visibleAgentes = currentUser?.isMaster && selectedProjetoId
    ? agentes.filter((agente) => agente.projetoId === selectedProjetoId)
    : agentes;

  const refreshAgentes = async () => {
    const response = await fetch("/api/admin/agentes", { cache: "no-store" });
    const payload = (await response.json()) as { agentes?: Agente[] };
    setAgentes(payload.agentes ?? []);
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedback(payload.error ?? "Nao foi possivel salvar o agente.");
      setSaving(false);
      return;
    }

    await refreshAgentes();
    setForm((prev) => ({
      ...emptyForm,
      projetoId: currentUser?.currentProjectId ?? prev.projetoId ?? projetos[0]?.id ?? "",
    }));
    setSaving(false);
    setFeedback(form.id ? "Agente atualizado com sucesso." : "Agente criado com sucesso.");
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
  };

  const handleNewAgent = () => {
    setForm((prev) => ({
      ...emptyForm,
      projetoId: currentUser?.currentProjectId ?? prev.projetoId ?? projetos[0]?.id ?? "",
    }));
    setFeedback(null);
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
          Configure o agente comercial que alimenta o chat do site com contexto, tom, perguntas de qualificacao e
          limites comerciais.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Agente em uso no site</p>
            <p className="mt-2 text-lg font-bold text-white">{agenteAtivo?.nome ?? "Nenhum agente ativo"}</p>
            <p className="mt-1 text-sm text-slate-400">O chat do site sempre usa apenas um agente ativo por vez.</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Agentes cadastrados</p>
            <p className="mt-2 text-lg font-bold text-white">{agentes.length}</p>
            <p className="mt-1 text-sm text-slate-400">Voce pode criar varios agentes e testar abordagens diferentes.</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Ligacao com o chat</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Quando uma conversa roda no site, o orquestrador carrega o agente ativo e registra esse vinculo no
              contexto do chat.
            </p>
          </div>
        </div>
      </section>

      <div>
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
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{form.id ? "Editar agente" : "Novo agente"}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Esse registro e o cerebro comercial usado pelo chat do site.
                    </p>
                  </div>
                  <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/10 p-3 text-cyan-200">
                    <BrainCircuit size={20} />
                  </div>
                </div>

                <div className="space-y-4">
                  {currentUser?.isMaster ? (
                    <select
                      value={form.projetoId}
                      onChange={(event) => setForm((prev) => ({ ...prev, projetoId: event.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
                    >
                      <option value="">Selecione o projeto</option>
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
                  <input
                    value={form.slug}
                    onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                    placeholder="Slug do agente (ex: comercial-imovel)"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  />
                  <input
                    value={form.nome}
                    onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                    placeholder="Agente comercial principal"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  />
                  <input
                    value={form.descricao}
                    onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
                    placeholder="Descricao curta do papel desse agente"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  />
                  <textarea
                    value={form.promptBase}
                    onChange={(event) => setForm((prev) => ({ ...prev, promptBase: event.target.value }))}
                    placeholder="Prompt base do agente"
                    rows={8}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <textarea
                    value={form.configuracoes}
                    onChange={(event) => setForm((prev) => ({ ...prev, configuracoes: event.target.value }))}
                    rows={16}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4 font-mono text-xs leading-relaxed text-cyan-100 outline-none placeholder:text-slate-500"
                  />

                  <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(event) => setForm((prev) => ({ ...prev, ativo: event.target.checked }))}
                    />
                    Agente ativo para o chat do site
                  </label>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={saving}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white"
                    >
                      {form.id ? <Pencil size={16} /> : <Plus size={16} />}
                      {saving ? "Salvando..." : form.id ? "Atualizar agente" : "Criar agente"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleNewAgent();
                      }}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white"
                    >
                      Novo rascunho
                    </button>
                  </div>

                  {feedback ? (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                      {feedback}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-7">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">
                  <Sparkles size={14} />
                  Como usar
                </div>
                <p className="leading-relaxed text-cyan-50">
                  Mantenha no `prompt_base` o tom comercial e os limites de proposta. Use `configuracoes` para
                  catalogo, perguntas obrigatorias, regras de handoff e faixas futuras de precificacao.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-cyan-100/85">
                  Voce pode cadastrar varios agentes. O chat da InfraStudio usa sempre o agente marcado como ativo. Ao
                  ativar outro, ele passa a ser o novo cerebro do site.
                </p>
              </div>

              <Link
                href="/admin/chats"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10"
              >
                Ver historico de chats
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 px-6 py-5">
                <h3 className="text-xl font-bold text-white">Agentes cadastrados</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Clique em editar para carregar prompt e configuracoes no formulario ao lado.
                </p>
              </div>
              <div className="space-y-4 p-6">
                {visibleAgentes.length ? (
                  visibleAgentes.map((agente) => (
                    <div
                      key={agente.id}
                      className={`rounded-xl border p-5 ${
                        form.id === agente.id
                          ? "border-cyan-400/40 bg-cyan-500/10"
                          : "border-white/10 bg-slate-950/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <h4 className="text-lg font-bold text-white">{agente.nome}</h4>
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                                agente.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {agente.ativo ? "ativo" : "inativo"}
                            </span>
                            {agenteAtivo?.id === agente.id ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200">
                                <CheckCircle2 size={12} />
                                usado no site
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-slate-400">{agente.descricao || "Sem descricao."}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                            Projeto: {agente.projetoNome ?? "Sem projeto"}
                          </p>
                          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                            Criado em {new Date(agente.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(agente)}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200"
                            title="Editar agente"
                          >
                            Editar
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Prompt base</p>
                          <p className="mt-2 line-clamp-5 text-sm leading-relaxed text-slate-300">
                            {agente.promptBase || "Sem prompt base definido."}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Configuracoes</p>
                          <pre className="mt-2 overflow-hidden whitespace-pre-wrap break-words text-xs leading-relaxed text-cyan-100">
                            {JSON.stringify(agente.configuracoes ?? {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">
                    Nenhum agente cadastrado para este projeto ainda. Crie o primeiro agente comercial para alimentar o chat.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
