"use client";

import { useEffect, useState } from "react";
import { MessageSquare, RefreshCw } from "lucide-react";

type AdminChat = {
  id: string;
  titulo: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  totalTokens: number;
  totalCusto: number;
  agenteId: string | null;
  projetoId: string | null;
  contexto: Record<string, unknown> | null;
};

type AdminMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  conteudo: string;
  createdAt: string;
  tokensInput: number | null;
  tokensOutput: number | null;
};

export default function AdminChatsPage() {
  const [chats, setChats] = useState<AdminChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<AdminChat | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const loadChats = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/chats");
    const payload = (await response.json()) as { chats?: AdminChat[] };
    setChats(payload.chats ?? []);
    setLoading(false);
  };

  const loadChatHistory = async (chatId: string) => {
    const response = await fetch(`/api/admin/chats/${chatId}`);
    const payload = (await response.json()) as { chat?: AdminChat; messages?: AdminMessage[] };
    setSelectedChat(payload.chat ?? null);
    setMessages(payload.messages ?? []);
  };

  useEffect(() => {
    void loadChats();
  }, []);

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
          <MessageSquare size={14} />
          Conversas
        </div>
        <h1 className="text-4xl font-extrabold text-white">Historico de chats do projeto</h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          Visualize as conversas iniciadas no site, reabra o historico e acompanhe qual projeto e qual agente atenderam cada lead.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div>
              <h2 className="text-xl font-bold text-white">Conversas recentes</h2>
              <p className="mt-1 text-sm text-slate-400">Clique em uma conversa para abrir o historico completo.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadChats()}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-200 transition-colors hover:bg-white/10"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="space-y-3 p-4">
            {loading ? <p className="px-2 py-4 text-sm text-slate-400">Carregando conversas...</p> : null}

            {chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => void loadChatHistory(chat.id)}
                className="block w-full rounded-xl border border-white/8 bg-slate-950/30 p-4 text-left transition-colors hover:border-blue-500/30 hover:bg-slate-950/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{chat.titulo}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{chat.status}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Lead: {String((chat.contexto?.lead as { nome?: string } | undefined)?.nome ?? "Nao identificado")}
                    </p>
                    <p className="mt-1 text-xs text-cyan-200/80">
                      Projeto: {String((chat.contexto?.projeto as { nome?: string } | undefined)?.nome ?? "Sem projeto")}
                    </p>
                    <p className="mt-1 text-xs text-cyan-200/80">
                      Agente: {String((chat.contexto?.agente as { nome?: string } | undefined)?.nome ?? "Sem agente")}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{new Date(chat.updatedAt).toLocaleString("pt-BR")}</p>
                    <p>{chat.totalTokens} tokens</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-xl font-bold text-white">{selectedChat ? selectedChat.titulo : "Selecione uma conversa"}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {selectedChat
                ? `Atualizada em ${new Date(selectedChat.updatedAt).toLocaleString("pt-BR")}`
                : "O historico aparecera aqui quando voce abrir uma conversa."}
            </p>
          </div>

          {selectedChat?.contexto ? (
            <div className="grid gap-4 border-b border-white/10 bg-slate-950/20 px-6 py-5 md:grid-cols-4">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Lead</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {String(((selectedChat.contexto.lead as { nome?: string } | undefined)?.nome ?? "Nao informado"))}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {String(((selectedChat.contexto.lead as { telefone?: string } | undefined)?.telefone ?? "Sem telefone"))}
                </p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Qualificacao</p>
                <p className="mt-2 text-sm text-slate-300">
                  Segmento: {String(((selectedChat.contexto.qualificacao as { segmento?: string } | undefined)?.segmento ?? "-"))}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Objetivo: {String(((selectedChat.contexto.qualificacao as { objetivo?: string } | undefined)?.objetivo ?? "-"))}
                </p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Projeto e agente</p>
                <p className="mt-2 text-sm text-slate-300">
                  Projeto: {String(((selectedChat.contexto.projeto as { nome?: string } | undefined)?.nome ?? "-"))}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Agente: {String(((selectedChat.contexto.agente as { nome?: string } | undefined)?.nome ?? "-"))}
                </p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Resumo</p>
                <p className="mt-2 text-sm text-slate-300">
                  {String(((selectedChat.contexto.memoria as { resumo?: string } | undefined)?.resumo ?? "Ainda sem resumo consolidado."))}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex h-[620px] flex-col gap-4 overflow-y-auto bg-slate-950/20 p-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[88%] rounded-xl p-4 text-sm leading-relaxed ${
                  message.role === "assistant"
                    ? "self-start rounded-bl-none bg-slate-800 text-slate-200"
                    : "self-end rounded-br-none bg-blue-600 text-white"
                }`}
              >
                <p>{message.conteudo}</p>
                <p className="mt-2 text-[11px] opacity-70">
                  {new Date(message.createdAt).toLocaleString("pt-BR")}
                  {message.tokensInput || message.tokensOutput ? ` • in ${message.tokensInput ?? 0} / out ${message.tokensOutput ?? 0}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
