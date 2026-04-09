"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, LoaderCircle, MessageSquareText, Plus, SearchSlash, Sparkles, UserRound } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/_components/admin-page-header";

type FeedbackStatus = "novo" | "em_andamento" | "respondido" | "fechado";
type FeedbackCategoria = "sugestao" | "reclamacao" | "melhoria" | "duvida" | "outro";
type EscopoPainel = "admin" | "usuario";

type FeedbackItem = {
  id: string;
  usuarioId: string;
  projetoId: string | null;
  assunto: string;
  categoria: FeedbackCategoria;
  status: FeedbackStatus;
  updatedAt: string;
  createdAt: string;
  usuario: {
    nome: string | null;
    email: string | null;
  };
  projeto: {
    id: string | null;
    nome: string | null;
  } | null;
  totalMensagens: number;
  ultimaMensagem: string | null;
  ultimaMensagemAt: string;
  possuiMensagemNaoLidaAdmin: boolean;
  possuiMensagemNaoLidaUsuario: boolean;
};

type FiltrosPayload = {
  statuses: FeedbackStatus[];
  categorias: FeedbackCategoria[];
  ordenacoes: Array<"recentes" | "pendentes">;
  usuarios: Array<{
    id: string;
    nome: string;
    email: string | null;
  }>;
};

const statusOptions: Array<{ value: FeedbackStatus | "todos"; label: string }> = [
  { value: "todos", label: "Todos os status" },
  { value: "novo", label: "Novo" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "respondido", label: "Respondido" },
  { value: "fechado", label: "Fechado" },
];

const categoriaOptions: Array<{ value: FeedbackCategoria; label: string }> = [
  { value: "sugestao", label: "Sugestao" },
  { value: "reclamacao", label: "Reclamacao" },
  { value: "melhoria", label: "Melhoria" },
  { value: "duvida", label: "Duvida" },
  { value: "outro", label: "Outro" },
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status: FeedbackStatus) {
  switch (status) {
    case "novo":
      return "Novo";
    case "em_andamento":
      return "Em andamento";
    case "respondido":
      return "Respondido";
    case "fechado":
      return "Fechado";
    default:
      return status;
  }
}

function getStatusTone(status: FeedbackStatus) {
  switch (status) {
    case "novo":
      return "border-amber-400/20 bg-amber-500/10 text-amber-100";
    case "em_andamento":
      return "border-cyan-400/20 bg-cyan-500/10 text-cyan-100";
    case "respondido":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
    case "fechado":
      return "border-white/10 bg-white/5 text-slate-300";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

function getCategoriaLabel(categoria: FeedbackCategoria) {
  const match = categoriaOptions.find((item) => item.value === categoria);
  return match?.label ?? categoria;
}

export function FeedbackCentralPage() {
  const router = useRouter();
  const [escopo, setEscopo] = useState<EscopoPainel>("usuario");
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [filtros, setFiltros] = useState<FiltrosPayload>({
    statuses: ["novo", "em_andamento", "respondido", "fechado"],
    categorias: categoriaOptions.map((item) => item.value),
    ordenacoes: ["recentes", "pendentes"],
    usuarios: [],
  });
  const [statusFiltro, setStatusFiltro] = useState<FeedbackStatus | "todos">("todos");
  const [categoriaFiltro, setCategoriaFiltro] = useState<FeedbackCategoria | "todas">("todas");
  const [usuarioFiltro, setUsuarioFiltro] = useState<string>("todos");
  const [ordenacao, setOrdenacao] = useState<"recentes" | "pendentes">("pendentes");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [criando, setCriando] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [categoria, setCategoria] = useState<FeedbackCategoria>("sugestao");
  const [mensagemInicial, setMensagemInicial] = useState("");

  const carregar = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (statusFiltro !== "todos") {
      params.set("status", statusFiltro);
    }
    if (categoriaFiltro !== "todas") {
      params.set("categoria", categoriaFiltro);
    }
    if (usuarioFiltro !== "todos") {
      params.set("usuarioId", usuarioFiltro);
    }
    if (escopo === "admin") {
      params.set("ordenacao", ordenacao);
    }

    const response = await fetch(`/api/feedbacks${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as
      | {
          escopo?: EscopoPainel;
          feedbacks?: FeedbackItem[];
          filtros?: FiltrosPayload;
          error?: string;
        }
      | null;

    if (!response.ok) {
      setError(payload?.error ?? "Nao foi possivel carregar os feedbacks.");
      setFeedbacks([]);
      setLoading(false);
      return;
    }

    setEscopo(payload?.escopo === "admin" ? "admin" : "usuario");
    setFeedbacks(payload?.feedbacks ?? []);
    if (payload?.filtros) {
      setFiltros(payload.filtros);
    }
    setLoading(false);
  };

  useEffect(() => {
    void carregar();
  }, [escopo, statusFiltro, categoriaFiltro, usuarioFiltro, ordenacao]);

  const summary = useMemo(() => {
    return {
      total: feedbacks.length,
      pendentes:
        escopo === "admin"
          ? feedbacks.filter((item) => item.status === "novo" || item.possuiMensagemNaoLidaAdmin).length
          : feedbacks.filter((item) => item.possuiMensagemNaoLidaUsuario).length,
      fechados: feedbacks.filter((item) => item.status === "fechado").length,
    };
  }, [escopo, feedbacks]);

  const handleCreate = async () => {
    if (!assunto.trim() || !mensagemInicial.trim()) {
      setError("Assunto e mensagem inicial sao obrigatorios.");
      return;
    }

    setCriando(true);
    setError(null);

    const response = await fetch("/api/feedbacks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assunto,
        categoria,
        mensagemInicial,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { feedback?: { id: string }; error?: string } | null;

    if (!response.ok || !payload?.feedback?.id) {
      setError(payload?.error ?? "Nao foi possivel abrir o feedback.");
      setCriando(false);
      return;
    }

    window.dispatchEvent(new Event("infrastudio:feedback-updated"));
    router.push(`/admin/feedback/${payload.feedback.id}`);
  };

  return (
    <main className="space-y-6">
      <AdminPageHeader
        eyebrow={escopo === "admin" ? "Central admin" : "Area logada"}
        eyebrowIcon={<Sparkles size={13} />}
        title={escopo === "admin" ? "Feedbacks e chamados" : "Meus feedbacks"}
        description={
          escopo === "admin"
            ? "Gerencie chamados, acompanhe pendencias e responda os usuarios em um unico fluxo."
            : "Abra novos feedbacks, acompanhe respostas do time e continue a conversa quando precisar."
        }
        actions={
          escopo === "usuario" ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="infra-click-pulse inline-flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-50 transition-all hover:border-sky-300/30 hover:bg-sky-400/15"
            >
              <Plus size={16} />
              Novo feedback
            </button>
          ) : null
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-[26px] border border-white/8 bg-white/[0.03] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total</p>
          <p className="mt-3 text-3xl font-semibold text-white">{summary.total}</p>
        </article>
        <article className="rounded-[26px] border border-cyan-400/12 bg-cyan-500/8 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{escopo === "admin" ? "Pendentes" : "Respostas novas"}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{summary.pendentes}</p>
        </article>
        <article className="rounded-[26px] border border-white/8 bg-white/[0.03] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fechados</p>
          <p className="mt-3 text-3xl font-semibold text-white">{summary.fechados}</p>
        </article>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-slate-950/35 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            <Filter size={13} />
            Filtros
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Status</span>
              <select
                value={statusFiltro}
                onChange={(event) => setStatusFiltro(event.target.value as FeedbackStatus | "todos")}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none"
              >
                {statusOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            {escopo === "admin" ? (
              <label className="space-y-2 text-sm text-slate-300">
                <span>Categoria</span>
                <select
                  value={categoriaFiltro}
                  onChange={(event) => setCategoriaFiltro(event.target.value as FeedbackCategoria | "todas")}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none"
                >
                  <option value="todas">Todas as categorias</option>
                  {filtros.categorias.map((item) => (
                    <option key={item} value={item}>
                      {getCategoriaLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {escopo === "admin" ? (
              <label className="space-y-2 text-sm text-slate-300">
                <span>Usuario</span>
                <select
                  value={usuarioFiltro}
                  onChange={(event) => setUsuarioFiltro(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none"
                >
                  <option value="todos">Todos os usuarios</option>
                  {filtros.usuarios.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {escopo === "admin" ? (
              <label className="space-y-2 text-sm text-slate-300">
                <span>Ordenacao</span>
                <select
                  value={ordenacao}
                  onChange={(event) => setOrdenacao(event.target.value as "recentes" | "pendentes")}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none"
                >
                  <option value="pendentes">Pendentes primeiro</option>
                  <option value="recentes">Mais recentes</option>
                </select>
              </label>
            ) : null}
          </div>
        </div>
      </section>

      {error ? <section className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</section> : null}

      <section className="space-y-3">
        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.03]">
            <LoaderCircle size={20} className="animate-spin text-slate-400" />
          </div>
        ) : null}

        {!loading && !feedbacks.length ? (
          <div className="rounded-[30px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300">
              <SearchSlash size={20} />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-white">Nenhum feedback encontrado</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Ajuste os filtros ou abra um novo feedback para iniciar o atendimento.
            </p>
          </div>
        ) : null}

        {!loading && feedbacks.length
          ? feedbacks.map((feedback) => {
              const destaqueNaoLido = escopo === "admin" ? feedback.possuiMensagemNaoLidaAdmin : feedback.possuiMensagemNaoLidaUsuario;

              return (
                <button
                  key={feedback.id}
                  type="button"
                  onClick={() => router.push(`/admin/feedback/${feedback.id}`)}
                  className="group w-full rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 text-left transition-all hover:border-cyan-300/30 hover:bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.03))]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getStatusTone(feedback.status)}`}>
                          {getStatusLabel(feedback.status)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                          {getCategoriaLabel(feedback.categoria)}
                        </span>
                        {destaqueNaoLido ? (
                          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                            Nao lido
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold text-white">{feedback.assunto}</h2>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                          {feedback.ultimaMensagem || "Sem mensagens."}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 text-sm text-slate-400 sm:grid-cols-2 xl:min-w-[320px]">
                      {escopo === "admin" ? (
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Usuario</p>
                          <p className="mt-2 font-medium text-white">{feedback.usuario.nome || "Usuario"}</p>
                          <p className="truncate text-xs text-slate-500">{feedback.usuario.email || "Sem email"}</p>
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Atualizacao</p>
                        <p className="mt-2 font-medium text-white">{formatDateTime(feedback.ultimaMensagemAt)}</p>
                        <p className="text-xs text-slate-500">{feedback.totalMensagens} mensagens</p>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Projeto</p>
                        <p className="mt-2 font-medium text-white">{feedback.projeto?.nome || "Nao vinculado"}</p>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Criado em</p>
                        <p className="mt-2 font-medium text-white">{formatDateTime(feedback.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          : null}
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-[#07111f] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">
                  <MessageSquareText size={13} />
                  Novo feedback
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-white">Abrir novo chamado</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Descreva o contexto inicial e o time responde no proprio historico.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition-all hover:border-white/20 hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Assunto</span>
                <input
                  value={assunto}
                  onChange={(event) => setAssunto(event.target.value)}
                  placeholder="Ex.: melhoria no painel de atendimento"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Categoria</span>
                <select
                  value={categoria}
                  onChange={(event) => setCategoria(event.target.value as FeedbackCategoria)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none"
                >
                  {categoriaOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Mensagem inicial</span>
                <textarea
                  value={mensagemInicial}
                  onChange={(event) => setMensagemInicial(event.target.value)}
                  rows={6}
                  placeholder="Explique o que aconteceu, sua duvida ou sugestao."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                <UserRound size={14} />
                O historico fica disponivel para acompanhamento depois.
              </div>
              <button
                type="button"
                disabled={criando}
                onClick={() => void handleCreate()}
                className="infra-click-pulse inline-flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-5 py-3 text-sm font-semibold text-sky-50 transition-all hover:border-sky-300/30 hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {criando ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
                Criar feedback
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
