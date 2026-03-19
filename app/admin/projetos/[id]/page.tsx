"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, CheckCircle2, MessageSquare, Pencil, Plus, Sparkles } from "lucide-react";

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
  slug: string | null;
  nome: string;
  descricao: string;
  promptBase: string;
  configuracoes: Record<string, unknown> | null;
  ativo: boolean;
  createdAt: string;
  projetoId: string | null;
};

type Chat = {
  id: string;
  titulo: string;
  updatedAt: string;
  totalTokens: number;
  contexto: Record<string, unknown> | null;
};

type ProjetoDetalhe = {
  projeto: Projeto;
  agentes: Agente[];
  chats: Chat[];
  stats: {
    totalAgentes: number;
    agenteAtivoId: string | null;
    totalChats: number;
  };
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
  objetivo: "Qualificar leads e operar o atendimento do projeto com contexto de negocio.",
  capacidades: [],
  perguntas_qualificacao: [],
  handoff: {
    enviar_para_humano_se: [],
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

export default function AdminProjetoDetalhePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ProjetoDetalhe | null>(null);
  const [form, setForm] = useState<AgenteFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadProjeto = async () => {
    const response = await fetch(`/api/admin/projetos/${params.id}`, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as ProjetoDetalhe;
    setData(payload);
    setForm((prev) => ({
      ...prev,
      projetoId: payload.projeto.id,
    }));
  };

  useEffect(() => {
    void loadProjeto();
  }, [params.id]);

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

    await loadProjeto();
    setForm({
      ...emptyForm,
      projetoId: params.id,
    });
    setSaving(false);
    setFeedback(form.id ? "Agente atualizado com sucesso." : "Agente criado com sucesso.");
  };

  const handleEdit = (agente: Agente) => {
    setForm({
      id: agente.id,
      projetoId: agente.projetoId ?? params.id,
      slug: agente.slug ?? "",
      nome: agente.nome,
      descricao: agente.descricao,
      promptBase: agente.promptBase,
      configuracoes: JSON.stringify(agente.configuracoes ?? defaultConfiguracoes, null, 2),
      ativo: agente.ativo,
    });
    setFeedback(null);
  };

  if (!data) {
    return (
      <main className="space-y-6">
        <section className="px-1 py-2">
          <h1 className="text-3xl font-extrabold text-white">Carregando projeto...</h1>
        </section>
      </main>
    );
  }

  const agenteAtivo = data.agentes.find((agente) => agente.ativo) ?? null;

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
          <Sparkles size={14} />
          Projeto
        </div>
        <h1 className="text-4xl font-extrabold text-white">{data.projeto.nome}</h1>
        <p className="mt-3 max-w-3xl text-slate-400">{data.projeto.descricao || "Sem descricao cadastrada."}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Slug</p>
            <p className="mt-2 text-lg font-bold text-white">{data.projeto.slug ?? "sem-slug"}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Agentes</p>
            <p className="mt-2 text-lg font-bold text-white">{data.stats.totalAgentes}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Chats</p>
            <p className="mt-2 text-lg font-bold text-white">{data.stats.totalChats}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Agente ativo</p>
            <p className="mt-2 text-lg font-bold text-white">{agenteAtivo?.nome ?? "Nenhum ativo"}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">{form.id ? "Editar agente" : "Novo agente"}</h2>
                <p className="mt-1 text-sm text-slate-400">Gerencie os agentes do projeto diretamente daqui.</p>
              </div>
              <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/10 p-3 text-cyan-200">
                <Bot size={20} />
              </div>
            </div>

            <div className="space-y-4">
              <input
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                placeholder="Slug do agente"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
              <input
                value={form.nome}
                onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                placeholder="Nome do agente"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
              <input
                value={form.descricao}
                onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
                placeholder="Descricao curta do agente"
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
                Agente ativo para este projeto
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
                    setForm({
                      ...emptyForm,
                      projetoId: params.id,
                    });
                    setFeedback(null);
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white"
                >
                  Limpar
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
            <p className="text-sm leading-relaxed text-cyan-50">
              Aqui fica a operação do projeto. Quando o volume crescer, o master navega primeiro por projetos e depois entra no detalhe para ver agentes, chats e conectores daquele cliente.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-6 py-5">
              <h3 className="text-xl font-bold text-white">Agentes do projeto</h3>
              <p className="mt-1 text-sm text-slate-400">O agente ativo atende este projeto. Os outros ficam como alternativas.</p>
            </div>
            <div className="space-y-4 p-6">
              {data.agentes.length ? (
                data.agentes.map((agente) => (
                  <div key={agente.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-5">
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
                          {agente.ativo ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200">
                              <CheckCircle2 size={12} />
                              em uso
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">{agente.descricao || "Sem descricao."}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleEdit(agente)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">
                  Nenhum agente cadastrado para este projeto ainda.
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-6 py-5">
              <h3 className="text-xl font-bold text-white">Chats recentes</h3>
              <p className="mt-1 text-sm text-slate-400">Visão rápida das conversas ligadas a este projeto.</p>
            </div>
            <div className="space-y-4 p-6">
              {data.chats.length ? (
                data.chats.slice(0, 8).map((chat) => (
                  <div key={chat.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                    <p className="font-semibold text-white">{chat.titulo}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(chat.updatedAt).toLocaleString("pt-BR")}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Lead: {String((chat.contexto?.lead as { nome?: string } | undefined)?.nome ?? "Nao identificado")}
                    </p>
                    <p className="mt-1 text-xs text-cyan-200/80">Tokens: {chat.totalTokens}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">
                  Nenhum chat registrado para este projeto ainda.
                </div>
              )}
            </div>
          </div>

          <Link
            href="/admin/projetos"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10"
          >
            Voltar para projetos
          </Link>
        </div>
      </div>
    </main>
  );
}
