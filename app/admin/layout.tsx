"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, Suspense, useEffect, useState } from "react";
import {
  ActivitySquare,
  BriefcaseBusiness,
  Coins,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  MessageCircleMore,
  Globe,
  Layers3,
  Settings,
  Store,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { FooterSection } from "@/app/_components/home/sections";
import { getCurrentProjectUser, signOutProjectAuth } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";
import { canAccessGlobalAdmin, canAccessWorkspace } from "@/lib/access";
import { cn } from "@/lib/utils";

const SIDEBAR_COOKIE_NAME = "infrastudio_admin_sidebar";
const ACTIVE_PROJECT_STORAGE_KEY = "projeto_ativo";

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/projetos", label: "Projetos", icon: BriefcaseBusiness },
  { href: "/admin/atendimento", label: "Atendimento", icon: MessageCircleMore, tone: "atendimento" },
  { projectTab: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { projectTab: "mercado", label: "Mercado Livre", icon: Store },
  { href: "/admin/planos", label: "Planos", icon: Coins },
  { href: "/admin/assinaturas", label: "Assinaturas", icon: Layers3 },
  { href: "/admin/uso", label: "Uso por Projeto", icon: ActivitySquare },
  { href: "/admin/me", label: "Meu Perfil", icon: Settings },
  { href: "/admin/usage", label: "Uso de Tokens", icon: Coins },
  { href: "/admin/chat-logs", label: "Logs", icon: ActivitySquare },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
] as const;

function isAdminLinkActive(pathname: string, currentProjectTab: string | null, item: (typeof adminLinks)[number]) {
  if ("projectTab" in item) {
    return pathname.startsWith("/admin/projetos/") && currentProjectTab === item.projectTab;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function getSidebarLinkTone(item: (typeof adminLinks)[number], active: boolean) {
  const tone = "projectTab" in item
    ? item.projectTab
    : "tone" in item
      ? item.tone
      : "default";

  if (!active) {
    return "text-slate-300 hover:bg-white/[0.04] hover:text-white";
  }

  if (tone === "whatsapp") {
    return "border border-emerald-400/40 bg-emerald-500/18 text-white shadow-[0_0_0_1px_rgba(52,211,153,0.22),0_0_28px_rgba(16,185,129,0.30),0_18px_46px_rgba(16,185,129,0.24)]";
  }

  if (tone === "mercado") {
    return "border border-amber-300/45 bg-amber-400/18 text-white shadow-[0_0_0_1px_rgba(252,211,77,0.20),0_0_28px_rgba(245,158,11,0.30),0_18px_46px_rgba(245,158,11,0.22)]";
  }

  if (tone === "atendimento") {
    return "border border-cyan-300/40 bg-cyan-400/18 text-white shadow-[0_0_0_1px_rgba(103,232,249,0.18),0_0_30px_rgba(34,211,238,0.30),0_18px_46px_rgba(14,165,233,0.24)]";
  }

  return "infra-premium-pill text-white shadow-[0_0_0_1px_rgba(96,165,250,0.18),0_0_24px_rgba(37,99,235,0.22),0_18px_46px_rgba(37,99,235,0.22)]";
}

function readSidebarCollapsedCookie() {
  if (typeof document === "undefined") {
    return false;
  }

  const cookies = document.cookie.split(";");
  const sidebarCookie = cookies.find((item) => item.trim().startsWith(`${SIDEBAR_COOKIE_NAME}=`));
  const value = sidebarCookie?.split("=")[1]?.trim();
  return value === "collapsed";
}

function persistSidebarCollapsedCookie(collapsed: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SIDEBAR_COOKIE_NAME}=${collapsed ? "collapsed" : "expanded"}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

type SidebarProps = {
  currentUser: AppUser | null;
  collapsed: boolean;
  mobileOpen: boolean;
  pathname: string;
  currentProjectTab: string | null;
  loadingHref: string | null;
  onCollapseToggle: () => void;
  onCloseMobile: () => void;
  onNavigate: (href: string) => void;
  onProjectTabNavigate: (tab: "whatsapp" | "mercado") => void;
  onLogout: () => Promise<void> | void;
};

function Sidebar({
  currentUser,
  collapsed,
  mobileOpen,
  pathname,
  currentProjectTab,
  loadingHref,
  onCollapseToggle,
  onCloseMobile,
  onNavigate,
  onProjectTabNavigate,
  onLogout,
}: SidebarProps) {
  const visibleLinks = currentUser && !canAccessGlobalAdmin(currentUser)
    ? adminLinks.filter((item) => {
        return ("projectTab" in item)
          || item.href === "/admin/dashboard"
          || item.href === "/admin/projetos"
          || item.href === "/admin/atendimento"
          || item.href === "/admin/me";
      })
    : adminLinks;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
      />

      <aside
        className={cn(
          "infra-premium-panel fixed inset-y-0 left-0 z-50 flex h-screen flex-col px-3 py-4 transition-all duration-300",
          collapsed ? "w-[92px]" : "w-[280px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        )}
      >
        <div className={cn("px-2", collapsed ? "flex justify-center" : "flex items-center justify-between")}>
            <Link
              href="/"
              className={cn(
                "flex items-center gap-3 overflow-hidden px-2 py-2",
                collapsed ? "pointer-events-none absolute opacity-0" : "",
              )}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                <img src="/logo.png" alt="InfraStudio" className="h-8 w-8 object-contain" />
              </div>
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-lg font-extrabold text-white">InfraStudio</p>
                </div>
              ) : null}
            </Link>

          <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "")}>
            <button
              type="button"
              onClick={onCollapseToggle}
                className={cn(
                  "infra-premium-panel hidden rounded-xl p-2 text-slate-300 transition-colors hover:text-white lg:inline-flex",
                  collapsed ? "h-11 w-11 items-center justify-center" : "",
                )}
              aria-label="Recolher menu"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <button
              type="button"
              onClick={onCloseMobile}
                className="infra-premium-panel rounded-xl p-2 text-slate-300 transition-colors hover:text-white lg:hidden"
              aria-label="Fechar menu"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <nav className="mt-8 flex-1 space-y-2 px-2">
          {visibleLinks.map((item) => {
            const Icon = item.icon;
            const active = isAdminLinkActive(pathname, currentProjectTab, item);
            const targetKey = "projectTab" in item ? `project-tab:${item.projectTab}` : item.href;
            const isLoading = loadingHref === targetKey;

            return (
              <button
                key={"projectTab" in item ? item.projectTab : item.href}
                type="button"
                onClick={() => {
                  if ("projectTab" in item) {
                    onProjectTabNavigate(item.projectTab);
                  } else if (pathname !== item.href) {
                    onNavigate(item.href);
                  }
                  onCloseMobile();
                }}
                className={cn(
                  "infra-click-pulse group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-all duration-200",
                  getSidebarLinkTone(item, active),
                  collapsed ? "justify-center" : "",
                )}
                title={collapsed ? item.label : undefined}
              >
                {isLoading ? <LoaderCircle size={18} className="shrink-0 animate-spin" /> : <Icon size={18} className="shrink-0" />}
                {!collapsed ? <span>{item.label}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-2 pt-4">
          <div
            className={cn(
              "rounded-2xl p-3",
              collapsed ? "flex flex-col items-center gap-3" : "space-y-3",
            )}
          >
            {!collapsed ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/"
                    className="infra-click-pulse inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                    title="Site"
                  >
                    <Globe size={16} />
                    <span>Site</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      void onLogout();
                    }}
                    className="infra-click-pulse inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                    title="Sair"
                  >
                    <LogOut size={16} />
                    <span>Sair</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/"
                  className="infra-click-pulse inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                  title="Site"
                >
                  <Globe size={16} />
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    void onLogout();
                  }}
                  className="infra-click-pulse inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                  title="Sair"
                >
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function AdminLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(readSidebarCollapsedCookie);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [loadingHref, setLoadingHref] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectPickerTab, setProjectPickerTab] = useState<"whatsapp" | "mercado" | null>(null);
  const [projectPickerLoading, setProjectPickerLoading] = useState(false);
  const [projectPickerProjects, setProjectPickerProjects] = useState<Array<{ id: string; nome: string; descricao: string; status: string }>>([]);
  const [projectPickerFeedback, setProjectPickerFeedback] = useState<string | null>(null);
  const currentProjectTab = searchParams.get("tab");

  useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentProjectUser();
      if (!canAccessWorkspace(user)) {
        router.replace("/");
        return;
      }

      setCurrentUser(user);
      setAuthResolved(true);
    };

    void loadUser();
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
    setLoadingHref(null);
  }, [pathname]);

  useEffect(() => {
    adminLinks.forEach((item) => {
      if ("href" in item) {
        router.prefetch(item.href);
      }
    });
  }, [router]);

  useEffect(() => {
    persistSidebarCollapsedCookie(collapsed);
  }, [collapsed]);

  const handleLogout = async () => {
    setLoggingOut(true);
    setCurrentUser(null);
    setAuthResolved(false);
    setMobileOpen(false);
    await signOutProjectAuth();
    router.replace("/");
  };

  const handleNavigate = (href: string) => {
    if (loadingHref === href) {
      return;
    }

    setLoadingHref(href);
    router.prefetch(href);
    router.push(href);
  };

  const loadProjectPickerProjects = async () => {
    setProjectPickerLoading(true);
    setProjectPickerFeedback(null);

    try {
      const response = await fetch("/api/admin/projetos", { cache: "no-store" });
      const payload = (await response.json()) as {
        error?: string;
        projetos?: Array<{ id: string; nome: string; descricao: string; status: string }>;
      };

      if (!response.ok) {
        setProjectPickerFeedback(payload.error ?? "Nao foi possivel carregar os projetos.");
        setProjectPickerProjects([]);
        setProjectPickerLoading(false);
        return;
      }

      setProjectPickerProjects(payload.projetos ?? []);
      setProjectPickerLoading(false);
    } catch {
      setProjectPickerFeedback("Nao foi possivel carregar os projetos.");
      setProjectPickerProjects([]);
      setProjectPickerLoading(false);
    }
  };

  const handleProjectTabNavigate = async (tab: "whatsapp" | "mercado") => {
    const loadingKey = `project-tab:${tab}`;
    const activeProjectId = typeof window === "undefined"
      ? null
      : window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)?.trim() || null;

    if (activeProjectId) {
      setLoadingHref(loadingKey);
      router.push(`/admin/projetos/${activeProjectId}?tab=${tab}`);
      return;
    }

    setProjectPickerTab(tab);
    setProjectPickerOpen(true);
    await loadProjectPickerProjects();
  };

  const handleProjectPickerSelect = (projectId: string) => {
    if (!projectPickerTab || typeof window === "undefined") {
      return;
    }

    const loadingKey = `project-tab:${projectPickerTab}`;
    window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectId);
    setProjectPickerOpen(false);
    setLoadingHref(loadingKey);
    router.push(`/admin/projetos/${projectId}?tab=${projectPickerTab}`);
  };

  if (!authResolved || loggingOut) {
    return (
      <div className="infra-premium-bg flex min-h-screen items-center justify-center px-6 text-slate-200">
        <div className="infra-premium-panel rounded-[28px] px-8 py-7 text-center">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <div className="absolute h-20 w-20 rounded-full bg-sky-500/20 blur-2xl animate-pulse" />
            <div className="absolute h-14 w-14 rounded-full bg-cyan-400/15 blur-xl animate-pulse" />
            <Image src="/logo.png" alt="InfraStudio" width={38} height={38} className="relative h-10 w-10 object-contain" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{loggingOut ? "Encerrando sessão" : "Validando acesso"}</p>
          <p className="mt-3 text-lg text-white">{loggingOut ? "Saindo do painel..." : "Carregando ambiente..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="infra-premium-bg min-h-screen text-slate-200">
      <Sidebar
        currentUser={currentUser}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        pathname={pathname}
        currentProjectTab={currentProjectTab}
        loadingHref={loadingHref}
        onCollapseToggle={() => setCollapsed((value) => !value)}
        onCloseMobile={() => setMobileOpen(false)}
        onNavigate={handleNavigate}
        onProjectTabNavigate={(tab) => void handleProjectTabNavigate(tab)}
        onLogout={handleLogout}
      />

        <div className={cn("transition-all duration-300", collapsed ? "lg:pl-[92px]" : "lg:pl-[280px]")}>
         <div className="sticky top-0 z-30 border-b border-white/8 bg-[#050814]/78 px-4 py-4 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="infra-premium-panel inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
            >
              <Menu size={16} />
              Menu
            </button>
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-slate-300">
                {canAccessGlobalAdmin(currentUser) ? "Painel admin" : "Ambiente do projeto"}
              </p>
              <Link
                href="/"
                className="infra-premium-panel inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white"
              >
                <Globe size={15} />
                Site
              </Link>
            </div>
          </div>
        </div>

         <div className="flex min-h-screen flex-col">
          <div className="relative flex-1 overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.26, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
          {pathname.startsWith("/admin/atendimento") ? null : <FooterSection />}
         </div>
      </div>

      {projectPickerOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="text-2xl font-extrabold text-white">Escolher projeto</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Selecione o projeto para abrir a aba de {projectPickerTab === "mercado" ? "Mercado Livre" : "WhatsApp"}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProjectPickerOpen(false);
                  setProjectPickerTab(null);
                  setProjectPickerFeedback(null);
                }}
                className="infra-click-pulse inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition-all hover:border-white/20 hover:bg-white/10"
                aria-label="Fechar modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-6">
              {projectPickerFeedback ? (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {projectPickerFeedback}
                </div>
              ) : null}

              {projectPickerLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-300">
                  <LoaderCircle size={18} className="animate-spin" />
                  <span className="ml-3 text-sm">Carregando projetos...</span>
                </div>
              ) : null}

              {!projectPickerLoading && !projectPickerProjects.length ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">
                  Nenhum projeto disponivel para selecionar.
                </div>
              ) : null}

              {!projectPickerLoading && projectPickerProjects.length ? (
                <div className="grid gap-3">
                  {projectPickerProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => handleProjectPickerSelect(project.id)}
                      className="infra-click-pulse rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left transition-all hover:border-cyan-400/30 hover:bg-white/10"
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
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="infra-premium-bg flex min-h-screen items-center justify-center px-6 text-slate-200">
          <div className="infra-premium-panel rounded-[28px] px-8 py-7 text-center">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <div className="absolute h-20 w-20 rounded-full bg-sky-500/20 blur-2xl animate-pulse" />
              <div className="absolute h-14 w-14 rounded-full bg-cyan-400/15 blur-xl animate-pulse" />
              <Image src="/logo.png" alt="InfraStudio" width={38} height={38} className="relative h-10 w-10 object-contain" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Carregando ambiente</p>
            <p className="mt-3 text-lg text-white">Preparando painel...</p>
          </div>
        </div>
      }
    >
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}

