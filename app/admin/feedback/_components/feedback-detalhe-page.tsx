"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Lock, MessageSquareText, RefreshCw, SendHorizonal, Sparkles, UserRound } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/_components/admin-page-header";
import { canAccessGlobalAdmin } from "@/lib/access";
import { getCurrentProjectUser } from "@/lib/auth";

type FeedbackStatus = "novo" | "em_andamento" | "respondido" | "fechado";
type FeedbackCategoria = "sugestao" | "reclamacao" | "melhoria" | "duvida" | "outro";

type FeedbackDetalhe = {
  id: string;
  assunto: string;
  categoria: FeedbackCategoria;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  usuario: {
    nome: string | null;
    email: string | null;
  };
  projeto: {
    id: string | null;
    nome: string | null;
  } | null;
  mensagens: Array<{
    id: string;
    remetenteTipo: "usuario" | "admin";
    mensagem: string;
    createdAt: string;
  }>;
};

const statusOptions: Array<{ value: FeedbackStatus; label: string }> = [
  { value: "novo", label: "Novo" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "respondido", label: "Respondido" },
  { value: "fechado", label: "Fechado" },
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
  return statusOptions.find((item) => item.value === status)?.label ?? status;
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
  switch (categoria) {
    case "sugestao":
      return "Sugestao";
    case "reclamacao":
      return "Reclamacao";
    case "melhoria":
      return "Melhoria";
    case "duvida":
      return "Duvida";
    case "outro":
      return "Outro";
    default:
      return categoria;
  }
}

export function FeedbackDetalhePage({ feedbackId }: { feedbackId: string }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);
  const [statusDraft, setStatusDraft] = useState<FeedbackStatus>("em_andamento");
  const [savingStatus, setSavingStatus] = useState(false);

  const fechado = feedback?.status === "fechado";

  const carregar = async () => {
    setLoading(true);
    setError(null);

    const [user, response] = await Promise.all([
      getCurrentProjectUser(),
      fetch(`/api/feedbacks/${feedbackId}`, { cache: "no-store" }),
    ]);

    setIsAdmin(canAccessGlobalAdmin(user));

    const payload = (await response.json().catch(() => null)) as { feedback?: FeedbackDetalhe; error?: string } | null;

    if (!response.ok || !payload?.feedback) {
      setError(payload?.error ?? "Nao foi possivel carregar o feedback.");
      setFeedback(null);
      setLoading(false);
      return;
    }

    setFeedback(payload.feedback);
    setStatusDraft(payload.feedback.status);
    setLoading(false);
    window.dispatchEvent(new Event("infrastudio:feedback-updated"));
  };

  useEffect(() => {
    void carregar();
  }, [feedbackId]);

  const canSendMessage = useMemo(() => {
    if (!feedback) {
      return false;
    }

    return feedback.status !== "fechado";
  }, [feedback]);

  const enviarMensagem = async () => {
    if (!mensagem.trim()) {
      return;
    }

    setSending(true);
    setError(null);

    const response = await fetch(`/api/feedbacks/${feedbackId}/mensagens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mensagem,
        statusAdmin: isAdmin ? statusDraft : undefined,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { feedback?: FeedbackDetalhe; error?: string } | null;

    if (!response.ok || !payload?.feedback) {
      setError(payload?.error ?? "Nao foi possivel enviar a mensagem.");
      setSending(false);
      return;
    }

    setFeedback(payload.feedback);
    setStatusDraft(payload.feedback.status);
    setMensagem("");
    setSending(false);
    window.dispatchEvent(new Event("infrastudio:feedback-updated"));
  };

  const salvarStatus = async (acao?: "reabrir") => {
    if (!feedback) {
      return;
    }

    setSavingStatus(true);
    setError(null);

    const response = await fetch(`/api/feedbacks/${feedbackId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(acao ? { acao } : { status: statusDraft }),
    });

    const payload = (await response.json().catch(() => null)) as { feedback?: FeedbackDetalhe; error?: string } | null;

    if (!response.ok || !payload?.feedback) {
      setError(payload?.error ?? "Nao foi possivel atualizar o status.");
      setSavingStatus(false);
      return;
    }

    setFeedback(payload.feedback);
    setStatusDraft(payload.feedback.status);
    setSavingStatus(false);
    window.dispatchEvent(new Event("infrastudio:feedback-updated"));
  };

  return (
    <main className="space-y-6">
      <AdminPageHeader
        eyebrow={isAdmin ? "Atendimento admin" : "Acompanhamento"}
        eyebrowIcon={<Sparkles size={13} />}
        title={feedback?.assunto || "Detalhe do feedback"}
        description="Historico completo da conversa, status atual e resposta no mesmo fluxo."
        actions={
          <Link
            href="/admin/feedback"
            className="infra-click-pulse inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition-all hover:border-white/20 hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            Voltar
          </Link>
        }
      />

      {error ? <section className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</section> : null}

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.03]">
          <LoaderCircle size={20} className="animate-spin text-slate-400" />
        </div>
      ) : null}

      {!loading && !feedback ? (
        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-slate-400">
          Feedback nao encontrado.
        </div>
      ) : null}

      {!loading && feedback ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-4">
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getStatusTone(feedback.status)}`}>
                {getStatusLabel(feedback.status)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                {getCategoriaLabel(feedback.categoria)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Atualizado em {formatDateTime(feedback.updatedAt)}
              </span>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 sm:p-6">
              <div className="space-y-4">
                {feedback.mensagens.map((item) => {
                  const isMensagemAdmin = item.remetenteTipo === "admin";

                  return (
                    <div key={item.id} className={`flex ${isMensagemAdmin ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[90%] rounded-[26px] border px-4 py-3 ${
                          isMensagemAdmin
                            ? "border-cyan-300/18 bg-cyan-500/10 text-cyan-50"
                            : "border-white/10 bg-white/[0.04] text-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
                          <span>{isMensagemAdmin ? "Equipe" : "Voce"}</span>
                          <span className="text-slate-500">{formatDateTime(item.createdAt)}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.mensagem}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-slate-950/35 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Continuar conversa</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {fechado ? "Este chamado esta fechado. Reabra para enviar novas mensagens." : "A resposta entra no historico imediatamente."}
                  </p>
                </div>

                {fechado ? (
                  <button
                    type="button"
                    disabled={savingStatus}
                    onClick={() => void salvarStatus("reabrir")}
                    className="infra-click-pulse inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 transition-all hover:border-amber-300/30 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingStatus ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Reabrir chamado
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-4">
                {isAdmin ? (
                  <label className="space-y-2 text-sm text-slate-300">
                    <span>Status apos resposta</span>
                    <select
                      value={statusDraft}
                      onChange={(event) => setStatusDraft(event.target.value as FeedbackStatus)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none"
                    >
                      {statusOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <textarea
                  value={mensagem}
                  onChange={(event) => setMensagem(event.target.value)}
                  rows={5}
                  disabled={!canSendMessage || sending}
                  placeholder={fechado ? "Reabra o chamado para continuar." : "Escreva sua mensagem..."}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                    {fechado ? <Lock size={14} /> : <MessageSquareText size={14} />}
                    {fechado ? "Fechado para novas mensagens." : "Historico salvo automaticamente."}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {isAdmin && !fechado ? (
                      <button
                        type="button"
                        disabled={savingStatus}
                        onClick={() => void salvarStatus()}
                        className="infra-click-pulse inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition-all hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingStatus ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Salvar status
                      </button>
                    ) : null}

                    <button
                      type="button"
                      disabled={!canSendMessage || sending || !mensagem.trim()}
                      onClick={() => void enviarMensagem()}
                      className="infra-click-pulse inline-flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-5 py-3 text-sm font-semibold text-sky-50 transition-all hover:border-sky-300/30 hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending ? <LoaderCircle size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
                      Enviar mensagem
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Solicitante</p>
              <div className="mt-4 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200">
                  <UserRound size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">{feedback.usuario.nome || "Usuario"}</p>
                  <p className="truncate text-sm text-slate-400">{feedback.usuario.email || "Sem email"}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Chamado</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Categoria</p>
                  <p className="mt-2 text-white">{getCategoriaLabel(feedback.categoria)}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Projeto</p>
                  <p className="mt-2 text-white">{feedback.projeto?.nome || "Nao vinculado"}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Criado em</p>
                  <p className="mt-2 text-white">{formatDateTime(feedback.createdAt)}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Ultima atualizacao</p>
                  <p className="mt-2 text-white">{formatDateTime(feedback.updatedAt)}</p>
                </div>
                {feedback.closedAt ? (
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Fechado em</p>
                    <p className="mt-2 text-white">{formatDateTime(feedback.closedAt)}</p>
                  </div>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
