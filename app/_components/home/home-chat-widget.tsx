"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { MessageCircle, Send, X } from "lucide-react";
import { ChatLayout } from "@/app/_components/chat/chat-layout";
import { useChatViewportHeight } from "@/app/_components/chat/use-chat-viewport-height";
import { HOME_CHAT_WIDGET_SLUG, WHATSAPP_NUMBER } from "@/app/_components/home/data";
import { cn } from "@/lib/utils";

type ChatWidgetProps = {
  open: boolean;
  docked: boolean;
  onDockedChange: (next: boolean) => void;
  onClose: () => void;
};

type ChatWidgetCta = {
  url: string;
  label?: string;
  phone?: string;
};

type ChatWidgetAsset = {
  id: string;
  nome: string;
  descricao: string;
  arquivoNome: string;
  mimeType: string;
  categoria: "image" | "file";
  publicUrl: string;
};

type ChatWidgetMessage = {
  id: string;
  text: string;
  isAi: boolean;
  cta?: ChatWidgetCta | null;
  assets?: ChatWidgetAsset[];
};

function escapeChatHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatChatInline(value: string) {
  return escapeChatHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function formatChatRichText(value: string) {
  return value
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n").filter(Boolean);
      if (!lines.length) {
        return "";
      }

      if (lines.every((line) => /^[-*]\s+/.test(line))) {
        return `<ul>${lines
          .map((line) => `<li>${formatChatInline(line.replace(/^[-*]\s+/, ""))}</li>`)
          .join("")}</ul>`;
      }

      if (lines.every((line) => /^\d+\.\s+/.test(line))) {
        return `<ol>${lines
          .map((line) => `<li>${formatChatInline(line.replace(/^\d+\.\s+/, ""))}</li>`)
          .join("")}</ol>`;
      }

      return `<p>${lines.map((line) => formatChatInline(line)).join("<br>")}</p>`;
    })
    .join("");
}

function normalizeHomeAiMessage(value: string) {
  const trimmed = value.trim();

  const multiItemMatch = trimmed.match(
    /^Pelo que voce descreveu, isso encaixa no nosso catalogo como (.+?)\. Nesse cenario, a estimativa inicial fica em R\$ ([\d.,]+) no total\. Se quiser, eu posso te direcionar no WhatsApp para alinharmos os detalhes finais\.$/i,
  );
  if (multiItemMatch) {
    const items = multiItemMatch[1]
      .split(" + ")
      .map((item) => item.trim())
      .filter(Boolean);

    return [
      "✓ **Melhor encaixe inicial**",
      ...items.map((item) => `- ${item}`),
      "",
      `**Estimativa inicial:** R$ ${multiItemMatch[2]}`,
      "",
      "→ Se quiser, eu posso te direcionar no WhatsApp para alinharmos os detalhes finais.",
    ].join("\n");
  }

  const singleItemMatch = trimmed.match(
    /^Pelo que voce descreveu, isso encaixa em (.+?)\. Se quiser, eu sigo com voce por aqui ou te encaminho no WhatsApp para fecharmos o proximo passo\.$/i,
  );
  if (singleItemMatch) {
    return [
      "✓ **Melhor encaixe inicial**",
      singleItemMatch[1].trim(),
      "",
      "→ Se quiser, eu sigo com voce por aqui ou te encaminho no WhatsApp para fecharmos o proximo passo.",
    ].join("\n");
  }

  return trimmed
    .replace(/\. ([A-ZÀ-Ú0-9✓→-])/g, ".\n\n$1")
    .replace(/\? ([A-ZÀ-Ú0-9✓→-])/g, "?\n\n$1");
}

function autoResizeChatTextarea(element: HTMLTextAreaElement | null) {
  if (!element) {
    return;
  }

  element.style.height = "46px";
  const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight) || 22;
  const maxHeight = Math.round(lineHeight * 3 + 24);
  const nextHeight = Math.min(element.scrollHeight, maxHeight);
  element.style.height = `${nextHeight}px`;
  element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
}

export function ChatWidget({ open, docked, onDockedChange, onClose }: ChatWidgetProps) {
  const chatStorageKey = "infrastudio-site-chat";
  const chatStorageSignature = `v2:${HOME_CHAT_WIDGET_SLUG}`;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const initialMessages: ChatWidgetMessage[] = [
    { id: "intro-1", text: "Bem-vindo 👋", isAi: true },
    { id: "intro-2", text: "Você já está testando a InfraStudio agora.", isAi: true },
    { id: "intro-3a", text: "Tudo que você digitar aqui é exatamente como seu cliente seria atendido.", isAi: true },
    { id: "intro-3b", text: "Manda uma dúvida ou simula um atendimento 🙂", isAi: true },
  ];
  const [messages, setMessages] = useState([...initialMessages]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const quickReplies: string[] = [];
  useChatViewportHeight(open);
  const fallbackWhatsappCta: ChatWidgetCta = {
    url: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Ola! Vim pelo chat da home da InfraStudio e quero falar com o time comercial.")}`,
    label: "Ir para o WhatsApp",
    phone: WHATSAPP_NUMBER,
  };

  const buildWhatsappMessage = (cta?: ChatWidgetCta | null): ChatWidgetMessage | null => {
    if (!cta?.url) {
      return null;
    }

    return {
      id: `ai-cta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: "",
      isAi: true,
      cta,
    };
  };

  const resetConversation = () => {
    setChatId(null);
    setDraft("");
    setLoading(false);
    setMessages([...initialMessages]);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(chatStorageKey);
    if (!stored) {
      return;
    }

    try {
      const payload = JSON.parse(stored) as {
        signature?: string;
        chatId: string | null;
        messages: ChatWidgetMessage[];
      };
      if (payload.signature !== chatStorageSignature) {
        window.localStorage.removeItem(chatStorageKey);
        return;
      }
      setChatId(payload.chatId);
      if (payload.messages?.length) {
        setMessages(payload.messages);
      }
    } catch {
      window.localStorage.removeItem(chatStorageKey);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      chatStorageKey,
      JSON.stringify({
        signature: chatStorageSignature,
        chatId,
        messages,
      }),
    );
  }, [chatId, chatStorageSignature, messages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const previous = {
      marginLeft: document.body.style.marginLeft,
      marginRight: document.body.style.marginRight,
      width: document.body.style.width,
      transition: document.body.style.transition,
      overflowX: document.body.style.overflowX,
    };

    if (!open || !docked) {
      return () => undefined;
    }

    if (window.innerWidth >= 960) {
      document.body.style.transition = "margin-left .28s ease, margin-right .28s ease, width .28s ease";
      document.body.style.marginLeft = previous.marginLeft;
      document.body.style.marginRight = "420px";
      document.body.style.width = "calc(100% - 420px)";
      document.body.style.overflowX = "hidden";
    } else {
      document.body.style.overflowX = "hidden";
    }

    return () => {
      document.body.style.marginLeft = previous.marginLeft;
      document.body.style.marginRight = previous.marginRight;
      document.body.style.width = previous.width;
      document.body.style.transition = previous.transition;
      document.body.style.overflowX = previous.overflowX;
    };
  }, [docked, open]);

  useEffect(() => {
    autoResizeChatTextarea(textareaRef.current);
  }, [draft, loading, open]);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element || !open) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior: messages.length > 1 ? "smooth" : "auto",
    });
  }, [messages, loading, open]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) {
      return;
    }

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, text: trimmed, isAi: false }]);
    setDraft("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId,
          message: trimmed,
          widgetSlug: HOME_CHAT_WIDGET_SLUG,
          context: {
            channel: {
              kind: "home_chat_widget",
            },
            ui: {
              structured_response: true,
              allow_icons: true,
            },
          },
        }),
      });

      const payload = (await response.json()) as {
        reply?: string;
        error?: string;
        chatId?: string;
        whatsapp?: ChatWidgetCta | null;
        assets?: ChatWidgetAsset[];
      };
      if (payload.chatId) {
        setChatId(payload.chatId);
      }

      setMessages((prev) => {
        const nextMessages: ChatWidgetMessage[] = [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            text: normalizeHomeAiMessage(payload.reply ?? payload.error ?? "Não consegui responder agora, mas posso te levar para o WhatsApp."),
            isAi: true,
            assets: Array.isArray(payload.assets) ? payload.assets : [],
          },
        ];
        const whatsappMessage = buildWhatsappMessage(payload.whatsapp ?? null);
        if (whatsappMessage) {
          nextMessages.push(whatsappMessage);
        }
        return nextMessages;
      });
    } catch {
      setMessages((prev) => {
        const nextMessages: ChatWidgetMessage[] = [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            text: normalizeHomeAiMessage("Não consegui responder agora, mas posso te levar para o WhatsApp."),
            isAi: true,
            assets: [],
          },
        ];
        const whatsappMessage = buildWhatsappMessage(fallbackWhatsappCta);
        if (whatsappMessage) {
          nextMessages.push(whatsappMessage);
        }
        return nextMessages;
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed z-[75]",
        docked
          ? "bottom-0 left-auto right-0 top-0 w-full max-w-none sm:w-auto"
          : "bottom-24 right-4 w-[calc(100vw-2rem)] max-w-[380px] sm:right-6",
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={cn(
          "overflow-hidden border border-white/10 bg-[rgba(9,16,34,0.84)] shadow-2xl backdrop-blur-xl",
          docked
            ? "w-full rounded-none md:h-[100dvh] md:w-[420px] md:rounded-l-[28px] md:border-r-0"
            : "w-full max-h-[min(780px,calc(var(--vh,100dvh)-7rem))] rounded-[28px]",
        )}
      >
        <ChatLayout
          viewportMode={docked ? "full" : undefined}
          className="bg-transparent"
          header={
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-5 py-4">
              <div className="flex-1">
                <div>
                  <p className="font-bold text-white">Atendimento</p>
                </div>
                <button
                  type="button"
                  onClick={resetConversation}
                  className="mt-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  Limpar
                </button>
              </div>
              <div className="ml-4 flex self-start">
                <button
                  type="button"
                  onClick={() => onDockedChange(!docked)}
                  className="mr-2 rounded-full border border-white/10 bg-white/5 p-2 text-blue-400 transition-colors hover:bg-white/10 hover:text-blue-300"
                  aria-label={docked ? "Reduzir chat" : "Maximizar chat"}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                    <rect x="4" y="5" width="16" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M9 5v14" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDockedChange(false);
                    onClose();
                  }}
                  className="rounded-full border border-white/10 bg-white/5 p-2 text-blue-400 transition-colors hover:bg-white/10 hover:text-blue-300"
                  aria-label="Fechar chat"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          }
          messagesClassName="chat-scroll bg-slate-950/20 p-5 [scrollbar-width:thin] [scrollbar-color:rgba(59,130,246,0.45)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-400/50"
          inputClassName="border-t border-white/10 bg-[rgba(9,16,34,0.92)]"
          input={
            <>
              {quickReplies.length ? (
                <div className="border-b border-white/10 bg-slate-950/15 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map((reply) => (
                      <button
                        key={reply}
                        type="button"
                        onClick={() => void sendMessage(reply)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="p-4">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage(draft);
                      }
                    }}
                    className="chat-scroll flex-1 resize-none rounded-[18px] border border-white/8 bg-white/[0.05] px-4 py-[11px] text-sm leading-[22px] text-white outline-none placeholder:text-slate-500 backdrop-blur-md [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    placeholder={loading ? "Atendente esta digitando..." : "Digite sua mensagem..."}
                    readOnly={loading}
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage(draft)}
                    disabled={loading}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-lg shadow-blue-950/40 transition-all hover:scale-105 hover:bg-[#1d4ed8]"
                    aria-label="Enviar mensagem"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </>
          }
        >
          <div ref={messagesRef} className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[90%] rounded-2xl border p-3 text-sm leading-relaxed shadow-sm backdrop-blur-sm",
                  message.isAi
                    ? "rounded-bl-none border-transparent bg-transparent text-slate-200 shadow-none backdrop-blur-none"
                    : "ml-auto rounded-br-none border-blue-400/20 bg-blue-500/18 text-blue-50",
                )}
              >
                <div
                  className="[&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol_+_p]:mt-2.5 [&_p]:m-0 [&_p_+_ol]:mt-2.5 [&_p_+_p]:mt-2.5 [&_p_+_ul]:mt-2.5 [&_strong]:font-bold [&_strong]:text-slate-50 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul_+_p]:mt-2.5 [&_ul_+_ul]:mt-2.5 [&_li_+_li]:mt-1.5"
                  dangerouslySetInnerHTML={{ __html: formatChatRichText(message.text) }}
                />
                {message.isAi && Array.isArray(message.assets) && message.assets.length ? (
                  <div className="mt-3 space-y-3">
                    {message.assets.slice(0, 2).map((asset) => (
                      <a
                        key={asset.id}
                        href={asset.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition-colors hover:bg-white/[0.06]"
                      >
                        {asset.categoria === "image" ? (
                          <img
                            src={asset.publicUrl}
                            alt={asset.nome || asset.arquivoNome || "Imagem do agente"}
                            className="block max-h-[220px] w-full object-cover"
                          />
                        ) : null}
                        <div className="p-3">
                          <div className="text-xs font-semibold text-white">{asset.nome || asset.arquivoNome || "Arquivo"}</div>
                          {asset.descricao || asset.arquivoNome ? (
                            <div className="mt-1 text-[11px] text-slate-400">{asset.descricao || asset.arquivoNome}</div>
                          ) : null}
                          <div className="mt-2 text-[11px] font-semibold text-blue-300">
                            {asset.categoria === "image" ? "Abrir imagem" : "Abrir arquivo"}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : null}
                {message.isAi && message.cta?.url ? (
                  <a
                    href={message.cta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-400/25 bg-blue-500/14 px-3 py-1.5 text-[11px] font-semibold text-blue-100 transition-colors hover:bg-blue-500/18"
                  >
                    <MessageCircle size={13} />
                    {message.cta.label || "Ir para o WhatsApp"}
                  </a>
                ) : null}
              </div>
            ))}

            {loading ? (
              <div className="inline-flex w-fit max-w-[90%] items-center gap-2 rounded-2xl rounded-bl-none border border-transparent bg-transparent p-3 text-sm text-blue-300 shadow-none">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
                </span>
              </div>
            ) : null}
          </div>
        </ChatLayout>
      </motion.div>
    </div>
  );
}

export function FloatingChatButton({ open, hidden, onToggle }: { open: boolean; hidden?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "fixed bottom-5 right-4 z-[70] inline-flex h-15 w-15 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-2xl shadow-blue-950/35 transition-all duration-200 font-bold hover:scale-[1.02] hover:bg-[#1d4ed8] sm:bottom-6 sm:right-6",
        hidden ? "pointer-events-none opacity-0 scale-90" : "opacity-100 scale-100",
      )}
      aria-label={open ? "Fechar chat" : "Abrir chat"}
    >
      <span
        key={open ? "close" : "open"}
        className="inline-flex animate-[chatLauncherSwap_.22s_ease_both] items-center justify-center"
      >
        {open ? <X size={26} /> : <MessageCircle size={28} />}
      </span>
    </button>
  );
}
