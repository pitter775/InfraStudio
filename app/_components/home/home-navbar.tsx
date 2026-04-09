"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpenText, BriefcaseBusiness, Lock, LogOut, Menu, MessageCircle, Sparkles, UserRound, X } from "lucide-react";
import type { AppUser } from "@/lib/app-user";
import { isAdminUser } from "@/lib/access";
import { isDemoUser } from "@/lib/demo-user";
import { cn } from "@/lib/utils";

type NavbarProps = {
  currentUser: AppUser | null;
  onOpenLogin: () => void;
  onLogout: () => Promise<void> | void;
  onOpenChat: () => void;
  basePath?: string;
  onNavigateHref?: (href: string) => void;
};

export function Navbar({ currentUser, onOpenLogin, onLogout, onOpenChat, basePath = "", onNavigateHref }: NavbarProps) {
  const DEMO_PROJECT_STORAGE_KEY = "demoProjectId";
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoProjectId, setDemoProjectId] = useState<string | null>(null);
  const adminHomeHref = currentUser
    ? isAdminUser(currentUser)
      ? "/admin/dashboard"
      : isDemoUser(currentUser.email) && demoProjectId
        ? `/admin/projetos/${demoProjectId}`
      : currentUser.currentProjectId
        ? `/admin/projetos/${currentUser.currentProjectId}`
        : isDemoUser(currentUser.email) && currentUser.memberships?.[0]?.projetoId
          ? `/admin/projetos/${currentUser.memberships[0].projetoId}`
          : "/admin/projetos"
    : "/admin/dashboard";
  const adminHomeLabel = currentUser ? (isAdminUser(currentUser) ? "Ir para admin" : "Abrir ambiente") : "Ir para admin";
  const homeHref = basePath || "/";
  const resolveSectionHref = (hash: string) => `${basePath}${hash}`;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !currentUser || !isDemoUser(currentUser.email)) {
      setDemoProjectId(null);
      return;
    }

    const savedProjectId = window.localStorage.getItem(DEMO_PROJECT_STORAGE_KEY)?.trim() || "";
    setDemoProjectId(savedProjectId || null);
  }, [currentUser]);

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
  const handleNavigateHref = (href: string) => {
    if (onNavigateHref) {
      onNavigateHref(href);
      return;
    }

    window.location.href = href;
  };

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
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
                    <img src="/logo.png" alt="InfraStudio" className="h-7 w-7 object-contain" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">Menu</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">InfraStudio</p>
                  </div>
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
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu();
                    handleNavigateHref(resolveSectionHref("#planos"));
                  }}
                  className="infra-click-pulse flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.18)] transition-all hover:border-white/20 hover:bg-white/[0.08]"
                >
                  <Sparkles size={16} className="text-cyan-200" />
                  Planos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu();
                    handleNavigateHref(resolveSectionHref("#servicos"));
                  }}
                  className="infra-click-pulse flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.18)] transition-all hover:border-white/20 hover:bg-white/[0.08]"
                >
                  <Sparkles size={16} className="text-cyan-200" />
                  Servicos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu();
                    handleNavigateHref(resolveSectionHref("#como-funciona"));
                  }}
                  className="infra-click-pulse flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.18)] transition-all hover:border-white/20 hover:bg-white/[0.08]"
                >
                  <BriefcaseBusiness size={16} className="text-cyan-200" />
                  Como funciona
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMobileMenu();
                    handleNavigateHref("/docs/chat-widget-host-control");
                  }}
                  className="infra-click-pulse flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.18)] transition-all hover:border-white/20 hover:bg-white/[0.08]"
                >
                  <BookOpenText size={16} className="text-cyan-200" />
                  Documentacao
                </button>
                <a
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    closeMobileMenu();
                    onOpenChat();
                  }}
                  className="infra-click-pulse flex items-center gap-3 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-50 shadow-[0_10px_30px_rgba(56,189,248,0.12)] transition-all hover:border-sky-300/30 hover:bg-sky-400/14"
                >
                  <MessageCircle size={16} />
                  Solicitar orcamento
                </a>
              </div>

              <div className="mt-5 border-t border-white/8 pt-5">
                {currentUser ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        closeMobileMenu();
                        handleNavigateHref(adminHomeHref);
                      }}
                      className="infra-click-pulse flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100"
                    >
                      <Lock size={16} />
                      {adminHomeLabel}
                    </button>
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
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
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
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    <Lock size={16} />
                    Entrar
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
          {onNavigateHref ? (
            <button type="button" onClick={() => handleNavigateHref(homeHref)} className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden p-1">
                <img src="/logo.png" alt="InfraStudio Logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <span className="block text-2xl font-bold tracking-tight text-white">InfraStudio</span>
                <span className="hidden text-xs uppercase tracking-[0.11em] text-slate-500 sm:block">Smart Systems Lab</span>
              </div>
            </button>
          ) : (
            <Link href={homeHref} className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden p-1">
                <img src="/logo.png" alt="InfraStudio Logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <span className="block text-2xl font-bold tracking-tight text-white">InfraStudio</span>
                <span className="hidden text-xs uppercase tracking-[0.11em] text-slate-500 sm:block">Smart Systems Lab</span>
              </div>
            </Link>
          )}

          <div className="hidden items-center space-x-3 md:flex">
            <button type="button" onClick={() => handleNavigateHref(resolveSectionHref("#planos"))} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-blue-300">
              <Sparkles size={15} className="text-slate-500" />
              Planos
            </button>
            <button type="button" onClick={() => handleNavigateHref(resolveSectionHref("#servicos"))} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-blue-300">
              <Sparkles size={15} className="text-slate-500" />
              Servicos
            </button>
            <button type="button" onClick={() => handleNavigateHref(resolveSectionHref("#como-funciona"))} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-blue-300">
              <BriefcaseBusiness size={15} className="text-slate-500" />
              Como funciona
            </button>
            <button type="button" onClick={() => handleNavigateHref("/docs/chat-widget-host-control")} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-blue-300">
              <BookOpenText size={15} className="text-slate-500" />
              Documentacao
            </button>
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onOpenChat();
              }}
              className="infra-click-pulse inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400"
            >
              <MessageCircle size={15} />
              Solicitar orcamento
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
                    <button
                      type="button"
                      onClick={() => {
                        handleNavigateHref(adminHomeHref);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/8 hover:text-white"
                    >
                    <Lock size={14} />
                    {isAdminUser(currentUser) ? "Admin" : "Ambiente"}
                  </button>
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
                Entrar
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
