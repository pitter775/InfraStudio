"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ActivitySquare,
  BriefcaseBusiness,
  Coins,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Globe,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { getCurrentProjectUser, signOutProjectAuth } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";
import { canAccessAdmin } from "@/lib/access";
import { cn } from "@/lib/utils";

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/projetos", label: "Projetos", icon: BriefcaseBusiness },
  { href: "/admin/ia-tokens", label: "IA Tokens", icon: Coins },
  { href: "/admin/chat-logs", label: "Logs de Chat", icon: ActivitySquare },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
];

type SidebarProps = {
  currentUser: AppUser | null;
  collapsed: boolean;
  mobileOpen: boolean;
  pathname: string;
  onCollapseToggle: () => void;
  onCloseMobile: () => void;
  onLogout: () => Promise<void> | void;
};

function Sidebar({
  currentUser,
  collapsed,
  mobileOpen,
  pathname,
  onCollapseToggle,
  onCloseMobile,
  onLogout,
}: SidebarProps) {
  const visibleLinks = currentUser?.isMaster
    ? adminLinks
    : adminLinks.filter((item) => item.href !== "/admin/usuarios" && item.href !== "/admin/projetos");

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
        <div className="flex items-center justify-between px-2">
            <Link href="/" className="flex items-center gap-3 overflow-hidden px-2 py-2">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                <img src="/logo.png" alt="InfraStudio" className="h-8 w-8 object-contain" />
              </div>
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-lg font-extrabold text-white">InfraStudio</p>
                </div>
              ) : null}
            </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCollapseToggle}
                className="infra-premium-panel hidden rounded-xl p-2 text-slate-300 transition-colors hover:text-white lg:inline-flex"
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
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-all duration-200",
                  active
                    ? "infra-premium-pill text-white shadow-[0_20px_44px_rgba(37,99,235,0.22)]"
                    : "text-slate-300 hover:bg-white/[0.04] hover:text-white",
                  collapsed ? "justify-center" : "",
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-2 pt-4">
          <div
            className={cn(
              "infra-premium-panel rounded-2xl p-3",
              collapsed ? "flex flex-col items-center gap-3" : "space-y-3",
            )}
          >
            <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "")}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/24 to-cyan-400/12 text-blue-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                <UserRound size={18} />
              </div>
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{currentUser?.name ?? "Não autenticado"}</p>
                  <p className="truncate text-xs text-slate-400">{currentUser?.email ?? "Login pela home"}</p>
                  {!currentUser?.isMaster && currentUser?.memberships?.[0]?.projetoNome ? (
                    <p className="truncate text-[11px] uppercase tracking-[0.16em] text-cyan-200/80">
                      {currentUser.memberships[0].projetoNome}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!collapsed ? (
                <div className="rounded-xl border border-emerald-400/18 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  {currentUser?.isMaster ? "master" : currentUser?.role ?? "sem acesso"}
                </div>
              ) : null}

            <Link
              href="/"
              className={cn(
                "infra-premium-panel inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:text-white",
                collapsed ? "h-11 w-11 p-0" : "w-full",
              )}
              title={collapsed ? "Voltar ao site" : undefined}
            >
              <Globe size={16} />
              {!collapsed ? <span>Voltar ao site</span> : null}
            </Link>

            <button
              type="button"
              onClick={() => {
                void onLogout();
              }}
              className={cn(
                "infra-premium-panel inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:text-white",
                collapsed ? "w-11 h-11 p-0" : "w-full",
              )}
              title={collapsed ? "Sair" : undefined}
            >
              <LogOut size={16} />
              {!collapsed ? <span>Sair</span> : null}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentProjectUser();
      if (!canAccessAdmin(user)) {
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
  }, [pathname]);

  const handleLogout = async () => {
    await signOutProjectAuth();
    setCurrentUser(null);
    window.location.href = "/";
  };

  if (!authResolved) {
    return (
      <div className="infra-premium-bg flex min-h-screen items-center justify-center px-6 text-slate-200">
        <div className="infra-premium-panel rounded-[28px] px-6 py-5 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Validando acesso</p>
          <p className="mt-3 text-lg text-white">Carregando ambiente master...</p>
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
        onCollapseToggle={() => setCollapsed((value) => !value)}
        onCloseMobile={() => setMobileOpen(false)}
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
              <p className="text-sm font-semibold text-slate-300">Painel admin</p>
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

         <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}

