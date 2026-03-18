"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Code2,
  MessageCircle,
  Hammer,
  Headphones,
  Home,
  Instagram,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Puzzle,
  Send,
  Share2,
  ShoppingBag,
  Smartphone,
  Stethoscope,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { mockUsers, type MockUser } from "@/lib/mock-users";
import { cn } from "@/lib/utils";

const SESSION_KEY = "infrastudio-auth-user";
const WHATSAPP_NUMBER = "5511949506267";

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
  onLogin: (user: MockUser) => void;
};

function LoginModal({ open, onClose, onLogin }: LoginModalProps) {
  const [email, setEmail] = useState("admin@infrastudio.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setError("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const user = mockUsers.find((item) => item.email === email && item.password === password);

    if (!user) {
      setError("Email ou senha invalidos.");
      return;
    }

    onLogin(user);
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
            Acesso rapido
          </div>
          <h2 className="text-2xl font-extrabold text-white">Entrar na area reservada</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Por enquanto este login e visual. Depois vamos conectar ao Supabase Auth e a tabela `usuarios`.
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
              placeholder="admin@infrastudio.com"
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
            <p className="font-semibold">Acesso demo</p>
            <p className="mt-1 text-emerald-200/80">Email: admin@infrastudio.com</p>
            <p className="text-emerald-200/80">Senha: admin123</p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-bold text-white shadow-xl shadow-blue-900/40 transition-all hover:-translate-y-0.5 hover:from-blue-500 hover:to-cyan-400"
          >
            Entrar agora
            <ArrowRight size={16} />
          </button>
        </form>
      </motion.div>
    </div>
  );
}

type NavbarProps = {
  currentUser: MockUser | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenChat: () => void;
};

function Navbar({ currentUser, onOpenLogin, onLogout, onOpenChat }: NavbarProps) {
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
                  Servicos
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
                  Solicitar or?amento
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
              Servicos
            </a>
            <a
              href="#como-funciona"
              className="text-sm font-medium text-slate-300 transition-colors hover:text-blue-400"
            >
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
              Solicitar or?amento
            </a>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <>
                <Link
                  href="/admin/usuarios"
                  className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-all hover:border-blue-500/40 hover:bg-blue-500/10 md:inline-flex"
                >
                  Admin
                </Link>
                <div className="hidden items-center gap-3 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-white md:flex">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                    <UserRound size={16} />
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold">{currentUser.name}</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/75">{currentUser.role}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/10 md:inline-flex"
                >
                  <LogOut size={16} />
                  Sair
                </button>
              </>
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
  onClose: () => void;
};

function ChatWidget({ open, onClose }: ChatWidgetProps) {
  const [messages] = useState([
    { text: "Ola! Sou o atendimento inicial da InfraStudio.", isAi: true },
    { text: "Me conte rapidamente o que voce quer automatizar.", isAi: true },
    { text: "Se preferir, eu ja te levo direto para o WhatsApp.", isAi: true },
  ]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-4 z-[75] w-[calc(100vw-2rem)] max-w-[380px] sm:right-6">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(9,16,34,0.84)] shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15">
              <img src="/logo.png" alt="InfraStudio" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="font-bold text-white">InfraStudio Chat</p>
              <p className="text-xs text-emerald-300">Online agora</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar chat"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 bg-slate-950/20 p-5">
          {messages.map((message) => (
            <div key={message.text} className="max-w-[90%] rounded-2xl rounded-bl-none bg-slate-800 p-3 text-sm leading-relaxed text-slate-200">
              {message.text}
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex-1 rounded-full border border-white/8 bg-white/[0.05] px-4 py-2.5 text-xs italic text-slate-400 backdrop-blur-md">
              IA esta digitando...
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-lg shadow-blue-950/40 transition-all hover:scale-105 hover:bg-[#1d4ed8]"
              aria-label="Enviar mensagem"
            >
              <Send size={15} />
            </button>
          </div>
          <div className="flex gap-3">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition-all hover:bg-[#20ba59]"
            >
              <Smartphone size={16} />
              Chamar no WhatsApp
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Fechar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const ServiceCard = ({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: typeof Code2;
  title: string;
  description: string;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay }}
    className="glass-effect group rounded-2xl p-8 transition-all duration-300 hover:border-blue-500/50"
  >
    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 transition-transform duration-300 group-hover:scale-110">
      <Icon size={24} />
    </div>
    <h3 className="mb-3 text-xl font-bold text-white">{title}</h3>
    <p className="text-sm leading-relaxed text-slate-400">{description}</p>
  </motion.div>
);

function ChatDemo() {
  const [messages, setMessages] = useState<{ text: string; isAi: boolean }[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const script = useMemo(
    () => [
      { text: "Ola! Como posso ajudar sua empresa hoje?", isAi: true },
      { text: "Quero automatizar meu atendimento no WhatsApp.", isAi: false },
      { text: "Excelente escolha! Posso agendar uma demo para voce agora mesmo?", isAi: true },
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
                "max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed",
                message.isAi
                  ? "self-start rounded-bl-none bg-slate-800 text-slate-200"
                  : "self-end rounded-br-none bg-blue-600 text-white",
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
          {isTyping ? "IA esta digitando..." : "Online"}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white">
          <Send size={14} />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);

  useEffect(() => {
    const storedUser = window.localStorage.getItem(SESSION_KEY);
    if (!storedUser) {
      return;
    }

    try {
      setCurrentUser(JSON.parse(storedUser) as MockUser);
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const handleLogin = (user: MockUser) => {
    setCurrentUser(user);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    window.localStorage.removeItem(SESSION_KEY);
  };

  return (
    <div className="min-h-screen bg-grid">
      <Navbar
        currentUser={currentUser}
        onOpenLogin={() => setLoginModalOpen(true)}
        onLogout={handleLogout}
        onOpenChat={() => setChatOpen(true)}
      />

      <section className="relative overflow-hidden pb-20 pt-32 md:pb-32 md:pt-48">
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-full max-w-7xl -translate-x-1/2">
          <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-cyan-500/10 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-400"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            Tecnologia de ponta e automacao inteligente
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 text-4xl font-extrabold leading-[1.1] tracking-tight text-white md:text-7xl"
          >
            Sistemas, automações e IA <br className="hidden md:block" /> para sua empresa{" "}
            <span className="text-gradient">vai vender mais</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mb-12 max-w-3xl text-lg leading-relaxed text-slate-400 md:text-xl"
          >
            Desenvolvemos software sob medida, integrações de APIs e automações inteligentes para WhatsApp e
            Instagram. Menos esfor?o manual, mais resultados escal?veis.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                setChatOpen(true);
              }}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 font-bold text-white shadow-xl shadow-blue-600/20 transition-all hover:-translate-y-1 hover:from-blue-500 hover:to-blue-400 sm:w-auto"
            >
              Solicitar or?amento gratis
            </a>
            <a
              href="#demonstracao"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-8 py-4 font-bold text-white transition-all hover:bg-white/10 sm:w-auto"
            >
              Ver demonstra??o
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 0.5 }}
            className="mt-24 flex flex-wrap justify-center gap-x-12 gap-y-8 grayscale transition-all duration-500 hover:grayscale-0"
          >
            {["Waboxapp", "OpenAI", "Stripe", "Make.com", "AWS"].map((tech) => (
              <span key={tech} className="text-sm font-bold tracking-widest text-slate-300">
                {tech}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="servicos" className="bg-slate-900/30 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-20 text-center">
            <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">Solucoes para a era da eficiencia</h2>
            <p className="text-slate-400">Tudo o que voce precisa para digitalizar e escalar sua operacao.</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <ServiceCard
              icon={Code2}
              title="Sistemas sob medida"
              description="Desenvolvimento de softwares exclusivos focados nas necessidades especificas do seu modelo de negocio."
              delay={0.1}
            />
            <ServiceCard
              icon={Zap}
              title="Automacao de processos"
              description="Elimine tarefas repetitivas integrando ferramentas e automatizando fluxos de trabalho complexos."
              delay={0.2}
            />
            <ServiceCard
              icon={Share2}
              title="Integracao de APIs"
              description="Conectamos seu CRM, ERP e sistemas de pagamento para que seus dados fluam sem interrupcoes."
              delay={0.3}
            />
            <ServiceCard
              icon={MessageSquare}
              title="IA chat para sites"
              description="Assistentes virtuais inteligentes que entendem o seu produto e respondem clientes 24/7 de forma humana."
              delay={0.4}
            />
            <ServiceCard
              icon={Smartphone}
              title="Automacao WhatsApp"
              description="Sistemas de triagem, agendamento e vendas automaticas diretamente no aplicativo mais usado do pais."
              delay={0.5}
            />
            <ServiceCard
              icon={Instagram}
              title="Instagram automation"
              description="Respostas automaticas no Direct e comentarios que transformam seguidores em leads qualificados."
              delay={0.6}
            />
          </div>
        </div>
      </section>

      <section id="demonstracao" className="relative overflow-hidden py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-20 lg:flex-row">
            <div className="lg:w-1/2">
              <h2 className="mb-8 text-3xl font-extrabold leading-tight text-white md:text-5xl">
                A experiencia e a nossa maior prova.
              </h2>
              <p className="mb-10 text-lg leading-relaxed text-slate-400">
                Nao apenas falamos sobre tecnologia, nos a vivemos. Esta pagina e nossos sistemas sao construidos com
                a mesma excelencia que entregamos aos nossos clientes.
              </p>

              <div className="space-y-6">
                {[{ title: "IA nativa", desc: "Integracao real com modelos GPT para atendimento." }, { title: "Alta performance", desc: "Carregamento instantaneo e UI intuitiva." }].map((item) => (
                  <div key={item.title} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-blue-500/30">
                    <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h4 className="mb-1 font-bold text-white">{item.title}</h4>
                      <p className="text-sm text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex w-full justify-center lg:w-1/2 lg:justify-end">
              <ChatDemo />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-12 lg:grid-cols-4">
            {[
              { icon: Zap, title: "Produtividade", desc: "Foque no que importa, deixe a rotina com a gente." },
              { icon: Clock, title: "Menos manual", desc: "Erros humanos reduzidos a quase zero." },
              { icon: Puzzle, title: "Integrado", desc: "Toda sua stack conversando em tempo real." },
              { icon: Headphones, title: "Suporte veloz", desc: "Time tecnico direto no WhatsApp para voce." },
            ].map((item) => (
              <div key={item.title} className="group text-center">
                <div className="mb-6 flex justify-center text-blue-500 transition-transform group-hover:scale-110">
                  <item.icon size={40} strokeWidth={1.5} />
                </div>
                <h3 className="mb-2 text-lg font-bold text-white">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="bg-slate-900/20 py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-20 text-center">
            <h2 className="text-3xl font-bold text-white md:text-4xl">Do problema a eficiencia em 5 passos</h2>
          </div>

          <div className="relative">
            <div className="absolute left-0 top-1/2 hidden h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent lg:block" />

            <div className="relative z-10 grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-5">
              {[
                { n: "1", title: "Explique a dor", desc: "Conte o que trava o crescimento da sua empresa hoje." },
                { n: "2", title: "Diagnostico", desc: "Analisamos a melhor stack tecnologica para resolver." },
                { n: "3", title: "Arquitetura", desc: "Desenvolvemos o projeto logico e visual do seu sistema." },
                { n: "4", title: "Mao na massa", desc: "Nossa equipe codifica sua solucao." },
                { n: "5", title: "Eficiencia", desc: "Entrega, treinamento e colheita de resultados.", highlight: true },
              ].map((step) => (
                <div
                  key={step.n}
                  className="rounded-2xl border border-white/10 bg-brand-dark p-8 text-center transition-colors hover:border-blue-500/30"
                >
                  <div
                    className={cn(
                      "mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full font-bold text-white shadow-lg",
                      step.highlight ? "bg-emerald-500 shadow-emerald-500/20" : "bg-blue-600 shadow-blue-600/20",
                    )}
                  >
                    {step.n}
                  </div>
                  <h4 className="mb-3 font-bold text-white">{step.title}</h4>
                  <p className="text-xs leading-relaxed text-slate-500">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-white">Feito para quem busca escala</h2>
            <p className="text-slate-400">Solucoes adaptadas para diferentes nichos de mercado.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {[
              { icon: Home, label: "Imobiliarias" },
              { icon: Stethoscope, label: "Clinicas" },
              { icon: ShoppingBag, label: "Lojas" },
              { icon: Hammer, label: "Prestadores" },
              { icon: Building2, label: "PMEs" },
            ].map((item) => (
              <div
                key={item.label}
                className="group cursor-default rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center transition-all hover:bg-white/[0.05]"
              >
                <div className="mb-4 flex justify-center text-slate-400 transition-colors group-hover:text-blue-400">
                  <item.icon size={32} strokeWidth={1.5} />
                </div>
                <h4 className="text-sm font-bold text-white">{item.label}</h4>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contato" className="px-4 py-32">
        <div className="mx-auto max-w-5xl">
          <div className="glass-effect relative overflow-hidden rounded-[40px] p-12 text-center shadow-2xl md:p-20">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-600/10 blur-[100px]" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-600/10 blur-[100px]" />

            <h2 className="mb-8 text-3xl font-extrabold tracking-tight text-white md:text-6xl">Pronto para o proximo nivel?</h2>
            <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-slate-400 md:text-xl">
              Fale sobre sua ideia e receba uma proposta personalizada sem compromisso. Nosso time tecnico entrara em contato.
            </p>

            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-2xl bg-[#25D366] px-10 py-5 text-xl font-extrabold text-white shadow-2xl shadow-[#25D366]/20 transition-all hover:scale-105 hover:bg-[#20ba59]"
            >
              <Smartphone size={24} />
              Chamar no WhatsApp
            </a>
            <p className="mt-8 text-sm font-medium text-slate-500">Respostas em menos de 1 hora em horario comercial.</p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 bg-brand-dark py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
            <div className="max-w-sm">
              <div className="mb-6 flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
                <span className="text-xl font-bold tracking-tight text-white">InfraStudio</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-500">
                Tecnologia sob medida para acelerar negocios brasileiros com inteligencia e automacao.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-20">
              <div className="flex flex-col gap-4">
                <span className="text-sm font-bold uppercase tracking-widest text-white">Solucoes</span>
                <nav className="flex flex-col gap-3">
                  {["Automações", "Sistemas", "IA", "API integrations"].map((link) => (
                    <a key={link} href="#" className="text-sm text-slate-500 transition-colors hover:text-blue-400">
                      {link}
                    </a>
                  ))}
                </nav>
              </div>
              <div className="flex flex-col gap-4">
                <span className="text-sm font-bold uppercase tracking-widest text-white">Empresa</span>
                <nav className="flex flex-col gap-3">
                  {["Sobre nos", "Privacidade", "Contato", "Carreiras"].map((link) => (
                    <a key={link} href="#" className="text-sm text-slate-500 transition-colors hover:text-blue-400">
                      {link}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-white/5 pt-8 text-xs font-medium text-slate-600 md:flex-row">
            <p>{`© ${new Date().getFullYear()} InfraStudio. Todos os direitos reservados.`}</p>
            <div className="flex items-center gap-2">
              Desenvolvido para gerar produtividade.
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        <LoginModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} onLogin={handleLogin} />
      </AnimatePresence>

      <AnimatePresence>
        <ChatWidget open={chatOpen} onClose={() => setChatOpen(false)} />
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setChatOpen(true)}
        className="fixed bottom-5 right-4 z-[70] inline-flex h-15 w-15 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl shadow-[#25D366]/30 transition-all hover:scale-105 hover:bg-[#20ba59] sm:bottom-6 sm:right-6"
        aria-label="Abrir chat"
      >
        <MessageCircle size={28} />
      </button>
    </div>
  );
}

