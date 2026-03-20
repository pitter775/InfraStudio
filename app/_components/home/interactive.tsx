"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Lock, LogOut, Menu, MessageCircle, Send, UserRound, X } from "lucide-react";
import type { AppUser } from "@/lib/app-user";
import { HOME_CHAT_WIDGET_SLUG, WHATSAPP_NUMBER } from "@/app/_components/home/data";
import { cn } from "@/lib/utils";

export function ExternalChatEmbed({
  projeto,
  agente,
}: {
  projeto: string;
  agente: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const scriptId = `infrastudio-embed-script-${projeto}-${agente}`;
    if (document.getElementById(scriptId)) {
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `${window.location.origin}/chat.js`;
    script.async = true;
    script.setAttribute("data-projeto", projeto);
    script.setAttribute("data-agente", agente);
    document.body.appendChild(script);

    return () => {
      script.remove();
      const host = document.getElementById(`infrastudio-chat-root-${`${projeto}::${agente}`.replace(/[^a-zA-Z0-9_-]/g, "-")}`);
      host?.remove();
    };
  }, [agente, projeto]);

  return null;
}

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
  authProvider: "mock" | "database";
  onLogin: (email: string, password: string) => Promise<string | null>;
};

export function LoginModal({ open, onClose, onLogin, authProvider }: LoginModalProps) {
  const [email, setEmail] = useState("adm@adm");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setError("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const loginError = await onLogin(email, password);

    if (loginError) {
      setError(loginError);
      setLoading(false);
      return;
    }

    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass-effect relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/15 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Fechar login"
        >
          <X size={16} />
        </button>

        <div className="border-b border-white/10 bg-white/5 px-6 py-5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-blue-300">
            <Lock size={14} />
            Acesso rápido
          </div>
          <h2 className="text-2xl font-extrabold text-white">Entrar na área reservada</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {authProvider === "database"
              ? "Este login usa a tabela `usuarios` da aplicação e mantém a autenticação desacoplada do provedor do banco."
              : "Enquanto as envs de banco e sessão não forem preenchidas, este login continua usando o modo demo local."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500/60"
              placeholder="adm@adm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500/60"
              placeholder="Digite sua senha"
            />
          </div>

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/8 p-4 text-sm text-emerald-100">
            <p className="font-semibold">{authProvider === "database" ? "Autenticação própria" : "Acesso demo"}</p>
            {authProvider === "database" ? (
              <>
                <p className="mt-1 text-emerald-200/80">Use um usuário cadastrado na tabela `public.usuarios`.</p>
                <p className="text-emerald-200/80">Exemplo atual: `adm@adm`</p>
              </>
            ) : (
              <>
                <p className="mt-1 text-emerald-200/80">Email: admin@infrastudio.com</p>
                <p className="text-emerald-200/80">Senha: admin123</p>
              </>
            )}
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-bold text-white shadow-xl shadow-blue-900/40 transition-all hover:-translate-y-0.5 hover:from-blue-500 hover:to-cyan-400"
          >
            {loading ? "Entrando..." : "Entrar agora"}
            <ArrowRight size={16} />
          </button>
        </form>
      </motion.div>
    </div>
  );
}

type NavbarProps = {
  currentUser: AppUser | null;
  onOpenLogin: () => void;
  onLogout: () => Promise<void> | void;
  onOpenChat: () => void;
};

export function Navbar({ currentUser, onOpenLogin, onLogout, onOpenChat }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <AnimatePresence>
        {mobileMenuOpen ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobileMenu}
              className="fixed inset-0 z-[55] bg-slate-950/78 backdrop-blur-sm md:hidden"
              aria-label="Fechar menu"
            />

            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed left-4 right-4 top-20 z-[60] rounded-[28px] border border-white/10 bg-slate-950/95 p-5 shadow-2xl backdrop-blur-xl md:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-white">Menu</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">InfraStudio</p>
                </div>
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Fechar menu"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <a
                  href="#servicos"
                  onClick={closeMobileMenu}
                  className="block rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.06]"
                >
                  Serviços
                </a>
                <a
                  href="#como-funciona"
                  onClick={closeMobileMenu}
                  className="block rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.06]"
                >
                  Como funciona
                </a>
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    closeMobileMenu();
                    onOpenChat();
                  }}
                  className="block rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.06]"
                >
                  Solicitar orçamento
                </a>
              </div>

              <div className="mt-5 border-t border-white/8 pt-5">
                {currentUser ? (
                  <div className="space-y-3">
                    <Link
                      href="/admin/usuarios"
                      onClick={closeMobileMenu}
                      className="block rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100"
                    >
                      Ir para admin
                    </Link>
                    <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-4 py-3">
                      <p className="text-sm font-semibold text-white">{currentUser.name}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/80">{currentUser.role}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        closeMobileMenu();
                        onLogout();
                      }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      <LogOut size={16} />
                      Sair
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      closeMobileMenu();
                      onOpenLogin();
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    <Lock size={16} />
                    Login
                  </button>
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <nav
        className={cn(
          "fixed top-0 z-50 w-full border-b transition-all duration-300",
          scrolled
            ? "border-white/8 bg-slate-950/82 py-4 shadow-[0_12px_50px_rgba(2,6,23,0.42)] backdrop-blur-xl"
            : "border-transparent bg-transparent py-6",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 overflow-hidden p-1">
              <img src="/logo.png" alt="InfraStudio Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="block text-2xl font-extrabold tracking-tight text-white">InfraStudio</span>
              <span className="hidden text-xs uppercase tracking-[0.11em] text-slate-500 sm:block">Smart Systems Lab</span>
            </div>
          </div>

          <div className="hidden items-center space-x-8 md:flex">
            <a href="#servicos" className="text-sm font-medium text-slate-300 transition-colors hover:text-blue-400">
              Serviços
            </a>
            <a href="#como-funciona" className="text-sm font-medium text-slate-300 transition-colors hover:text-blue-400">
              Como funciona
            </a>
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onOpenChat();
              }}
              className="rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400"
            >
              Solicitar orçamento
            </a>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="group relative hidden md:block">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/8 px-3 py-1.5 text-white transition-all hover:border-emerald-400/25 hover:bg-emerald-500/12"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <UserRound size={14} />
                  </div>
                  <div className="text-left leading-tight">
                    <p className="text-xs font-semibold">{currentUser.name}</p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-200/70">{currentUser.role}</p>
                  </div>
                </button>

                <div className="invisible absolute right-0 top-full z-20 mt-2 w-44 rounded-2xl border border-white/10 bg-slate-950/95 p-2 opacity-0 shadow-2xl backdrop-blur-xl transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  <Link
                    href="/admin/dashboard"
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/8 hover:text-white"
                  >
                    <Lock size={14} />
                    Admin
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      void onLogout();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/8 hover:text-white"
                  >
                    <LogOut size={14} />
                    Sair
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-200 transition-all hover:bg-white/[0.08] hover:text-white md:inline-flex"
              >
                <Lock size={15} />
                Login
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.05] p-2.5 text-slate-200 transition-all hover:bg-white/[0.08] hover:text-white md:hidden"
              aria-label="Abrir menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}

type ChatWidgetProps = {
  open: boolean;
  docked: boolean;
  onDockedChange: (next: boolean) => void;
  onClose: () => void;
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  type ChatWidgetCta = {
    url: string;
    label?: string;
    phone?: string;
  };

  type ChatWidgetMessage = {
    id: string;
    text: string;
    isAi: boolean;
    cta?: ChatWidgetCta | null;
  };

  const initialMessages: ChatWidgetMessage[] = [
    { id: "intro-1", text: "Olá! Sou o atendimento inicial da InfraStudio.", isAi: true },
    { id: "intro-2", text: "Me conte rapidamente o que você quer automatizar.", isAi: true },
    { id: "intro-3", text: "Se preferir, eu já te levo direto para o WhatsApp.", isAi: true },
  ];
  const [messages, setMessages] = useState([...initialMessages]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const quickReplies: string[] = [];
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
      text: "Se preferir, eu te levo para o WhatsApp agora:",
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
        chatId: string | null;
        messages: ChatWidgetMessage[];
      };
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
        chatId,
        messages,
      }),
    );
  }, [chatId, messages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const previous = {
      marginLeft: document.body.style.marginLeft,
      marginRight: document.body.style.marginRight,
      width: document.body.style.width,
      minHeight: document.body.style.minHeight,
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
      document.body.style.minHeight = "100vh";
      document.body.style.overflowX = "hidden";
    } else {
      document.body.style.overflowX = "hidden";
    }

    return () => {
      document.body.style.marginLeft = previous.marginLeft;
      document.body.style.marginRight = previous.marginRight;
      document.body.style.width = previous.width;
      document.body.style.minHeight = previous.minHeight;
      document.body.style.transition = previous.transition;
      document.body.style.overflowX = previous.overflowX;
    };
  }, [docked, open]);

  useEffect(() => {
    autoResizeChatTextarea(textareaRef.current);
  }, [draft, loading, open]);

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
          "flex flex-col overflow-hidden border border-white/10 bg-[rgba(9,16,34,0.84)] shadow-2xl backdrop-blur-xl",
          docked
            ? "h-screen w-full rounded-none md:w-[420px] md:rounded-l-[28px] md:border-r-0"
            : "max-h-[min(780px,calc(100vh-7rem))] rounded-[28px]",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-5 py-4">
          <div className="flex-1">
            <div>
              <p className="font-bold text-white">InfraStudio Chat</p>
            </div>
            <button
              type="button"
              onClick={resetConversation}
              className="mt-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Novo atendimento
            </button>
          </div>
          <div className="ml-4 flex self-start">
            <button
              type="button"
              onClick={() => onDockedChange(!docked)}
              className="mr-2 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
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
              className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fechar chat"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="chat-scroll min-h-0 flex-1 overflow-y-auto bg-slate-950/20 p-5">
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[90%] rounded-2xl border p-3 text-sm leading-relaxed shadow-sm backdrop-blur-sm",
                  message.isAi
                    ? "rounded-bl-none border-transparent bg-transparent p-0 text-slate-200 shadow-none backdrop-blur-none"
                    : "ml-auto rounded-br-none border-blue-400/20 bg-blue-500/18 text-blue-50",
                )}
              >
                <div
                  className="[&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol_+_p]:mt-2.5 [&_p]:m-0 [&_p_+_ol]:mt-2.5 [&_p_+_p]:mt-2.5 [&_p_+_ul]:mt-2.5 [&_strong]:font-bold [&_strong]:text-white [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul_+_p]:mt-2.5 [&_ul_+_ul]:mt-2.5 [&_li_+_li]:mt-1.5"
                  dangerouslySetInnerHTML={{ __html: formatChatRichText(message.text) }}
                />
                {message.isAi && message.cta?.url ? (
                  <a
                    href={message.cta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/14 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/18"
                  >
                    <MessageCircle size={13} />
                    {message.cta.label || "Ir para o WhatsApp"}
                  </a>
                ) : null}
              </div>
            ))}

            {loading ? (
              <div className="inline-flex w-fit max-w-[90%] items-center gap-2 rounded-2xl rounded-bl-none border border-white/5 bg-slate-800/90 p-3 text-sm text-slate-400">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {quickReplies.length ? (
          <div className="border-t border-white/10 bg-slate-950/15 px-4 py-3">
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

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2">
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
              className="chat-scroll flex-1 resize-none rounded-[18px] border border-white/8 bg-white/[0.05] px-4 py-[11px] text-sm leading-[22px] text-white outline-none placeholder:text-slate-500 backdrop-blur-md"
              placeholder={loading ? "Atendente esta digitando..." : "Digite sua mensagem..."}
              readOnly={loading}
            />
            <button
              type="button"
              onClick={() => void sendMessage(draft)}
              disabled={loading}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-lg shadow-blue-950/40 transition-all hover:scale-105 hover:bg-[#1d4ed8]"
              aria-label="Enviar mensagem"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function ChatDemo() {
  const [messages, setMessages] = useState<{ text: string; isAi: boolean }[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const script = useMemo(
    () => [
      { text: "Olá! Como posso ajudar sua empresa hoje?", isAi: true },
      { text: "Quero automatizar meu atendimento no WhatsApp.", isAi: false },
      { text: "Excelente escolha! Posso agendar uma demo para você agora mesmo?", isAi: true },
    ],
    [],
  );

  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const runScript = (index: number) => {
      if (!isMounted) {
        return;
      }

      if (index >= script.length) {
        timeoutId = setTimeout(() => {
          if (!isMounted) {
            return;
          }

          setMessages([]);
          runScript(0);
        }, 5000);
        return;
      }

      const message = script[index];
      if (message.isAi) {
        setIsTyping(true);
      }

      timeoutId = setTimeout(() => {
        if (!isMounted) {
          return;
        }

        setIsTyping(false);
        setMessages((prev) => [...prev, message]);
        runScript(index + 1);
      }, message.isAi ? 1500 : 1000);
    };

    runScript(0);

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [script]);

  return (
    <div className="glass-effect mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/20 shadow-2xl lg:mx-0">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/30" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/30" />
          <div className="h-3 w-3 rounded-full bg-green-500/30" />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Smart AI Interface</div>
      </div>
      <div className="flex h-[380px] flex-col gap-4 overflow-y-auto bg-slate-900/40 p-6">
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <motion.div
              key={`${index}-${message.text}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "max-w-[85%] rounded-2xl border p-3 text-sm leading-relaxed shadow-sm backdrop-blur-sm",
                message.isAi
                  ? "self-start rounded-bl-none border-white/5 bg-slate-800/90 text-slate-200"
                  : "self-end rounded-br-none border-blue-400/20 bg-blue-500/18 text-blue-50",
              )}
            >
              {message.text}
            </motion.div>
          ))}
          {isTyping ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="self-start rounded-2xl rounded-bl-none bg-slate-800 p-3"
            >
              <div className="flex gap-1">
                <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400" />
                <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]" />
                <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:0.4s]" />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="flex gap-2 border-t border-white/5 p-4">
        <div className="flex-grow rounded-full bg-white/5 px-4 py-2 text-xs italic text-slate-500">
          {isTyping ? "IA está digitando..." : "Online"}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/20 text-blue-50">
          <Send size={14} />
        </div>
      </div>
    </div>
  );
}

export function HomeChatDemo() {
  const [messages, setMessages] = useState<{ text: string; isAi: boolean }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [view, setView] = useState<"chat" | "whatsapp">("chat");
  const [whatsStep, setWhatsStep] = useState<"ready" | "handoff">("ready");
  const [showWhatsappButton, setShowWhatsappButton] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [demoCycle, setDemoCycle] = useState(0);

  const script = useMemo(
    () => [
      { text: "Vocês trocam disco de freio?", isAi: false },
      { text: "Trocamos sim 👍\n\nQual o seu carro e ano para eu te passar os valores?", isAi: true },
      { text: "Ford Focus 2006", isAi: false },
      {
        text: "Para o seu Focus 2006, temos:\n\n🔧 Disco de freio: R$ 280\n🛠 Mão de obra: R$ 120\n\nTotal estimado: R$ 400\n\nPosso agendar isso pra você agora pelo WhatsApp 👍",
        isAi: true,
      },
    ],
    [],
  );

  const handleWhatsappButtonClick = () => {
    setShowWhatsappButton(false);
    setIsFlipping(true);

    window.setTimeout(() => {
      setView("whatsapp");
      setWhatsStep("ready");
      setIsFlipping(false);
    }, 500);

    window.setTimeout(() => {
      setWhatsStep("handoff");
    }, 2600);

    window.setTimeout(() => {
      setIsFlipping(true);
    }, 4800);

    window.setTimeout(() => {
      setMessages([]);
      setIsTyping(false);
      setView("chat");
      setWhatsStep("ready");
      setShowWhatsappButton(false);
      setIsFlipping(false);
      setDemoCycle((current) => current + 1);
    }, 5600);
  };

  const handleContinueWhatsapp = () => {
    if (whatsStep === "handoff") {
      return;
    }

    setWhatsStep("handoff");

    window.setTimeout(() => {
      setIsFlipping(true);
    }, 2200);

    window.setTimeout(() => {
      setMessages([]);
      setIsTyping(false);
      setView("chat");
      setWhatsStep("ready");
      setShowWhatsappButton(false);
      setIsFlipping(false);
      setDemoCycle((current) => current + 1);
    }, 3000);
  };

  const handleEditWhatsapp = () => {
    setMessages([]);
    setIsTyping(false);
    setView("chat");
    setWhatsStep("ready");
    setShowWhatsappButton(false);
    setIsFlipping(false);
    setDemoCycle((current) => current + 1);
  };

  useEffect(() => {
    let isMounted = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const schedule = (callback: () => void, delay: number) => {
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          callback();
        }
      }, delay);

      timeouts.push(timeoutId);
    };

    const resetDemo = () => {
      if (!isMounted) {
        return;
      }

      setMessages([]);
      setIsTyping(false);
      setView("chat");
      setWhatsStep("ready");
      setShowWhatsappButton(false);
      setIsFlipping(false);
      runScript(0);
    };

    const finishDemo = () => {
      schedule(() => {
        setIsFlipping(true);
      }, 2200);

      schedule(() => {
        setView("chat");
        setIsFlipping(false);
        resetDemo();
      }, 3000);
    };

    const continueWhatsappFlow = () => {
      if (!isMounted) {
        return;
      }

      setWhatsStep((current) => {
        if (current === "handoff") {
          return current;
        }

        schedule(() => {
          finishDemo();
        }, 2200);

        return "handoff";
      });
    };

    const openWhatsappStep = () => {
      if (!isMounted) {
        return;
      }

      setShowWhatsappButton(false);
      setIsFlipping(true);

      schedule(() => {
        setView("whatsapp");
        setWhatsStep("ready");
        setIsFlipping(false);
      }, 500);

      schedule(() => {
        continueWhatsappFlow();
      }, 2600);
    };

    const runScript = (index: number) => {
      if (!isMounted) {
        return;
      }

      if (index >= script.length) {
        setShowWhatsappButton(true);
        schedule(() => {
          openWhatsappStep();
        }, 1800);
        return;
      }

      const message = script[index];
      if (message.isAi) {
        setIsTyping(true);
      }

      schedule(() => {
        setIsTyping(false);
        setMessages((prev) => [...prev, message]);
        runScript(index + 1);
      }, message.isAi ? 1500 : 1000);
    };

    runScript(0);

    return () => {
      isMounted = false;
      timeouts.forEach(clearTimeout);
    };
  }, [script, demoCycle]);

  return (
    <div className="glass-effect mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/20 shadow-2xl lg:mx-0">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/30" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/30" />
          <div className="h-3 w-3 rounded-full bg-green-500/30" />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Smart AI Interface</div>
      </div>
      <div className="h-[380px] overflow-hidden bg-slate-900/40">
        <motion.div
          animate={{
            opacity: isFlipping ? 0.72 : 1,
            rotateY: isFlipping ? 90 : 0,
            scale: isFlipping ? 0.985 : 1,
          }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="flex h-full flex-col"
        >
          {view === "chat" ? (
            <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
              <AnimatePresence mode="popLayout">
                {messages.map((message, index) => (
                  <motion.div
                    key={`${index}-${message.text}`}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={cn(
                      "max-w-[85%] whitespace-pre-line rounded-2xl border p-3 text-sm leading-relaxed shadow-sm backdrop-blur-sm",
                      message.isAi
                        ? "self-start rounded-bl-none border-white/5 bg-slate-800/90 text-slate-200"
                        : "self-end rounded-br-none border-blue-400/20 bg-blue-500/18 text-blue-50",
                    )}
                  >
                    {message.text}
                  </motion.div>
                ))}
                {showWhatsappButton ? (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handleWhatsappButtonClick}
                    className="self-start rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100"
                  >
                    👉 Continuar no WhatsApp
                  </motion.button>
                ) : null}
                {isTyping ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="self-start rounded-2xl rounded-bl-none bg-slate-800 p-3"
                  >
                    <div className="flex gap-1">
                      <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400" />
                      <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]" />
                      <div className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:0.4s]" />
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-between bg-[#0f1f16] p-4 text-white">
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-[#182b20] px-4 py-3 text-sm text-emerald-50 shadow-sm">
                  Olá, tenho um Ford Focus 2006 e quero trocar o disco de freio.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-emerald-50/90">
                  <div className="font-medium text-white">✔ Veículo: Focus 2006</div>
                  <div className="mt-1 font-medium text-white">✔ Serviço: Disco de freio</div>
                  <div className="mt-1 font-medium text-white">✔ Valor estimado: R$ 400</div>
                </div>
                <div className="whitespace-pre-line rounded-2xl rounded-tl-none bg-[#1f6f4a] px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
                  {whatsStep === "handoff"
                    ? "Perfeito! Já estou chamando um responsável para te atender agora 👨‍🔧"
                    : "Já deixei tudo pronto para você 👍\n\nDeseja que eu continue com o atendimento?"}
                </div>
              </div>
              <div className="space-y-3">
                {whatsStep === "ready" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleContinueWhatsapp}
                      className="rounded-full bg-[#25d366] px-3 py-2 text-sm font-semibold text-[#062714]"
                    >
                      Pode continuar
                    </button>
                    <button
                      type="button"
                      onClick={handleEditWhatsapp}
                      className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/90"
                    >
                      Editar informações
                    </button>
                  </div>
                ) : (
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-center text-xs italic text-emerald-50/70">
                    Encaminhando atendimento...
                  </div>
                )}
                <div className="rounded-2xl border border-white/10 bg-[#13241a] px-4 py-3 text-sm text-white/65">
                  Mensagem pronta para envio no WhatsApp
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
      <div className="flex gap-2 border-t border-white/5 p-4">
        <div className="flex-grow rounded-full bg-white/5 px-4 py-2 text-xs italic text-slate-500">
          {view === "whatsapp"
            ? "WhatsApp conectado"
            : isTyping
              ? "IA esta digitando..."
              : showWhatsappButton
                ? "Pronto para continuar"
                : "Online"}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/20 text-blue-50">
          <Send size={14} />
        </div>
      </div>
    </div>
  );
}

export function FloatingChatButton({ open, hidden, onToggle }: { open: boolean; hidden?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "fixed bottom-5 right-4 z-[70] inline-flex h-15 w-15 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-2xl shadow-blue-950/35 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-[#1d4ed8] sm:bottom-6 sm:right-6",
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
