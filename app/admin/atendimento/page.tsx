"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, LoaderCircle, MessageCircleMore, RefreshCcw, SendHorizonal } from "lucide-react";
import { canAccessWorkspace } from "@/lib/access";
import { getCurrentProjectUser } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";

const ACTIVE_PROJECT_STORAGE_KEY = "projeto_ativo";

type Projeto = {
  id: string;
  nome: string;
  descricao: string;
  status: string;
};

type ChatRecord = {
  id: string;
  titulo: string;
  updatedAt: string;
  canal: string;
  identificadorExterno: string | null;
  ultimaMensagem: string | null;
};

type ChatMessageRecord = {
  id: string;
  role: "user" | "assistant" | "system";
  conteudo: string;
  createdAt: string;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getChatChannelLabel(canal: string) {
  return canal === "whatsapp" ? "WhatsApp" : "Site";
}

function getChatChannelTone(canal: string) {
  return canal === "whatsapp"
    ? "bg-emerald-500/10 text-emerald-200"
    : "bg-cyan-500/10 text-cyan-100";
}

function getChatTitle(chat: ChatRecord) {
  return chat.identificadorExterno?.trim() || chat.titulo?.trim() || "Conversa sem identificacao";
}

function CenterLoader() {
  return (
    <div className="flex min-h-[220px] items-center justify-center">
      <div className="flex items-center gap-3 text-slate-300">
        <LoaderCircle size={18} className="animate-spin" />
        <span className="text-sm">Carregando atendimento...</span>
      </div>
    </div>
  );
}

export default function AdminAtendimentoPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Projeto[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messagesByChatId, setMessagesByChatId] = useState<Record<string, ChatMessageRecord[]>>({});
  const [replyText, setReplyText] = useState("");
  const [manualAssumedByChat, setManualAssumedByChat] = useState<Record<string, boolean>>({});

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const selectedMessages = selectedChatId ? (messagesByChatId[selectedChatId] ?? []) : [];

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch("/api/admin/projetos", { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; projetos?: Projeto[] };

      if (!response.ok) {
        setFeedback(payload.error ?? "Nao foi possivel carregar os projetos.");
        setProjects([]);
        setLoadingProjects(false);
        return;
      }

      setProjects(payload.projetos ?? []);
      setLoadingProjects(false);
    } catch {
      setFeedback("Nao foi possivel carregar os projetos.");
      setProjects([]);
      setLoadingProjects(false);
    }
  };

  const loadChats = async (projetoId: string) => {
    setLoadingChats(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/chats?projetoId=${encodeURIComponent(projetoId)}`, { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; chats?: ChatRecord[] };

      if (!response.ok) {
        if (response.status === 403 && typeof window !== "undefined") {
          window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
          setActiveProjectId(null);
          await loadProjects();
        }

        setFeedback(payload.error ?? "Nao foi possivel carregar as conversas.");
        setChats([]);
        setSelectedChatId(null);
        setLoadingChats(false);
        return;
      }

      const nextChats = payload.chats ?? [];
      setChats(nextChats);
      setSelectedChatId((current) => {
        if (current && nextChats.some((chat) => chat.id === current)) {
          return current;
        }
        return nextChats[0]?.id ?? null;
      });
      setLoadingChats(false);
    } catch {
      setFeedback("Nao foi possivel carregar as conversas.");
      setChats([]);
      setSelectedChatId(null);
      setLoadingChats(false);
    }
  };

  const loadConversation = async (chatId: string) => {
    setLoadingConversation(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/chats/${chatId}`, { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; messages?: ChatMessageRecord[] };

      if (!response.ok) {
        setFeedback(payload.error ?? "Nao foi possivel carregar a conversa.");
        setLoadingConversation(false);
        return;
      }

      setMessagesByChatId((current) => ({
        ...current,
        [chatId]: (payload.messages ?? []).filter((message) => message.role !== "system"),
      }));
      setLoadingConversation(false);
    } catch {
      setFeedback("Nao foi possivel carregar a conversa.");
      setLoadingConversation(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentProjectUser();
      setCurrentUser(user);
      setAuthResolved(true);

      if (!canAccessWorkspace(user)) {
        return;
      }

      const storedProjectId = typeof window === "undefined"
        ? null
        : window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)?.trim() || null;

      if (storedProjectId) {
        setActiveProjectId(storedProjectId);
        return;
      }

      await loadProjects();
    };

    void load();
  }, []);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const matchedProject = projects.find((project) => project.id === activeProjectId);
    if (matchedProject) {
      setProjectName(matchedProject.nome);
    }

    void loadChats(activeProjectId);
  }, [activeProjectId]);

  useEffect(() => {
    if (!selectedChatId || messagesByChatId[selectedChatId]) {
      return;
    }

    void loadConversation(selectedChatId);
  }, [messagesByChatId, selectedChatId]);

  const handleProjectSelect = async (project: Projeto) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, project.id);
    }

    setProjectName(project.nome);
    setActiveProjectId(project.id);
    setFeedback(null);
  };

  const handleRefresh = async () => {
    if (!activeProjectId) {
      await loadProjects();
      return;
    }

    await loadChats(activeProjectId);
    if (selectedChatId) {
      await loadConversation(selectedChatId);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChatId || !replyText.trim()) {
      return;
    }

    setSendingMessage(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/chats/${selectedChatId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conteudo: replyText,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: ChatMessageRecord };

      if (!response.ok || !payload.message) {
        setFeedback(payload.error ?? "Nao foi possivel enviar a mensagem.");
        setSendingMessage(false);
        return;
      }

      const sentMessage = payload.message;
      setMessagesByChatId((current) => ({
        ...current,
        [selectedChatId]: [...(current[selectedChatId] ?? []), sentMessage],
      }));
      setChats((current) =>
        [...current]
          .map((chat) =>
            chat.id === selectedChatId
              ? {
                  ...chat,
                  ultimaMensagem: sentMessage.conteudo,
                  updatedAt: sentMessage.createdAt,
                }
              : chat,
          )
          .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
      );
      setReplyText("");
      setSendingMessage(false);
    } catch {
      setFeedback("Nao foi possivel enviar a mensagem.");
      setSendingMessage(false);
    }
  };

  if (!authResolved) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">
          <CenterLoader />
        </section>
      </main>
    );
  }

  if (!currentUser || !canAccessWorkspace(currentUser)) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-8 text-slate-200">
          <h1 className="text-2xl font-bold text-white">Acesso ao atendimento indisponivel</h1>
          <p className="mt-3 text-sm text-slate-300">Entre com um usuario valido para abrir a inbox unificada.</p>
        </section>
      </main>
    );
  }

  if (!activeProjectId) {
    return (
      <main className="space-y-6">
        <section className="px-1 py-2">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
            <MessageCircleMore size={14} />
            Atendimento
          </div>
          <h1 className="text-4xl font-extrabold text-slate-50">Selecione um projeto para abrir as conversas</h1>
          <p className="mt-4 max-w-3xl text-slate-400">A inbox unificada usa o projeto ativo para juntar chat do site e WhatsApp no mesmo lugar.</p>
        </section>

        {feedback ? <section className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{feedback}</section> : null}

        <section className="rounded-[24px] border border-white/8 bg-white/[0.02] p-5 shadow-[0_18px_38px_rgba(2,8,23,0.22)]">
          {loadingProjects ? <CenterLoader /> : null}

          {!loadingProjects && !projects.length ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">
              Nenhum projeto disponivel para selecionar.
            </div>
          ) : null}

          {!loadingProjects && projects.length ? (
            <div className="grid gap-3">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => void handleProjectSelect(project)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left transition-all hover:border-cyan-400/30 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">{project.nome}</p>
                      <p className="mt-1 text-sm text-slate-400">{project.descricao || "Sem descricao."}</p>
                    </div>
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">
                      {project.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
          <MessageCircleMore size={14} />
          Atendimento
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-50">Conversas</h1>
            <p className="mt-4 max-w-3xl text-slate-400">
              Projeto ativo: <span className="font-semibold text-white">{projectName || activeProjectId}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
                }
                setActiveProjectId(null);
                setChats([]);
                setSelectedChatId(null);
                setMessagesByChatId({});
                void loadProjects();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition-all hover:border-white/20 hover:bg-white/10"
            >
              <BriefcaseBusiness size={16} />
              Trocar projeto
            </button>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-50 transition-all hover:border-sky-300/30 hover:bg-sky-400/14"
            >
              <RefreshCcw size={16} />
              Atualizar
            </button>
          </div>
        </div>
      </section>

      {feedback ? <section className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{feedback}</section> : null}

      <section className="grid min-h-[72vh] gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.02] shadow-[0_18px_38px_rgba(2,8,23,0.22)]">
          <div className="border-b border-white/10 px-4 py-4">
            <p className="text-lg font-bold text-white">Conversas do projeto</p>
            <p className="mt-1 text-sm text-slate-400">Site e WhatsApp no mesmo feed.</p>
          </div>

          <div className="max-h-[72vh] overflow-y-auto p-3">
            {loadingChats ? <CenterLoader /> : null}

            {!loadingChats && !chats.length ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">
                Nenhuma conversa encontrada para este projeto.
              </div>
            ) : null}

            {!loadingChats ? (
              <div className="space-y-2">
                {chats.map((chat) => {
                  const active = selectedChatId === chat.id;

                  return (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => setSelectedChatId(chat.id)}
                      className={`block w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                        active
                          ? "border-cyan-400/30 bg-cyan-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{getChatTitle(chat)}</p>
                          <p className="mt-2 line-clamp-2 text-sm text-slate-400">{chat.ultimaMensagem || "Sem mensagens ainda."}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getChatChannelTone(chat.canal)}`}>
                          {getChatChannelLabel(chat.canal)}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">{formatDateTime(chat.updatedAt)}</p>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-[72vh] flex-col overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.02] shadow-[0_18px_38px_rgba(2,8,23,0.22)]">
          {selectedChat ? (
            <>
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-bold text-white">{getChatTitle(selectedChat)}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getChatChannelTone(selectedChat.canal)}`}>
                        {getChatChannelLabel(selectedChat.canal)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">Ultima atividade em {formatDateTime(selectedChat.updatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${manualAssumedByChat[selectedChat.id] ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}`}>
                      {manualAssumedByChat[selectedChat.id] ? "Voce esta atendendo" : "IA atendendo"}
                    </span>
                    {!manualAssumedByChat[selectedChat.id] ? (
                      <button
                        type="button"
                        onClick={() =>
                          setManualAssumedByChat((current) => ({
                            ...current,
                            [selectedChat.id]: true,
                          }))
                        }
                        className="inline-flex items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition-all hover:border-emerald-400/30 hover:bg-emerald-500/15"
                      >
                        Assumir atendimento
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                {loadingConversation ? <CenterLoader /> : null}

                {!loadingConversation && !selectedMessages.length ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">
                    Nenhuma mensagem registrada nesta conversa.
                  </div>
                ) : null}

                {!loadingConversation ? (
                  <div className="space-y-3">
                    {selectedMessages.map((message) => {
                      const fromUser = message.role === "user";

                      return (
                        <div key={message.id} className={`flex ${fromUser ? "justify-start" : "justify-end"}`}>
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-[0_12px_24px_rgba(2,8,23,0.16)] ${
                              fromUser
                                ? "border border-white/10 bg-white/6 text-slate-100"
                                : "border border-cyan-400/20 bg-cyan-500/10 text-cyan-50"
                            }`}
                          >
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                              {fromUser ? "user" : "assistant"}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.conteudo}</p>
                            <p className="mt-2 text-[11px] text-slate-400">{formatDateTime(message.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="border-t border-white/10 px-5 py-4">
                <div className="flex flex-col gap-3 md:flex-row">
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    placeholder="Digite sua resposta manual..."
                    rows={3}
                    className="min-h-[92px] flex-1 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400/30"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendMessage()}
                    disabled={sendingMessage || !replyText.trim()}
                    className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-50 transition-all hover:border-sky-300/30 hover:bg-sky-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sendingMessage ? <LoaderCircle size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
                    Enviar
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-slate-400">
              <div>
                <p className="text-xl font-bold text-white">Selecione uma conversa</p>
                <p className="mt-3 text-sm">Escolha um chat na coluna da esquerda para abrir o historico completo.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
