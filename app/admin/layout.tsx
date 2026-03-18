"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { type MockUser } from "@/lib/mock-users";
import { cn } from "@/lib/utils";

const SESSION_KEY = "infrastudio-auth-user";

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
];

type SidebarProps = {
  currentUser: MockUser | null;
  collapsed: boolean;
  mobileOpen: boolean;
  pathname: string;
  onCollapseToggle: () => void;
  onCloseMobile: () => void;
  onLogout: () => void;
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
          "fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-white/10 bg-slate-950/95 px-3 py-4 shadow-2xl transition-all duration-300",
          collapsed ? "w-[92px]" : "w-[280px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-3 overflow-hidden rounded-2xl px-2 py-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <img src="/logo.png" alt="InfraStudio" className="h-8 w-8 object-contain" />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold text-white">InfraStudio</p>
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Admin panel</p>
              </div>
            ) : null}
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCollapseToggle}
              className="hidden rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white lg:inline-flex"
              aria-label="Recolher menu"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Fechar menu"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="mt-8 px-2">
          {!collapsed ? (
            <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/10 p-4">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-slate-950/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200">
                <ShieldCheck size={13} />
                Area reservada
              </div>
              <p className="text-sm leading-relaxed text-cyan-50">
                Dashboard mockado e usuarios mockados, prontos para receber permissao real depois.
              </p>
            </div>
          ) : null}
        </div>

        <nav className="mt-6 flex-1 space-y-2 px-2">
          {adminLinks.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-all",
                  active
                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-900/30"
                    : "text-slate-300 hover:bg-white/6 hover:text-white",
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
              "rounded-2xl border border-white/10 bg-white/5 p-3",
              collapsed ? "flex flex-col items-center gap-3" : "space-y-3",
            )}
          >
            <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "")}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-200">
                <UserRound size={18} />
              </div>
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{currentUser?.name ?? "Nao autenticado"}</p>
                  <p className="truncate text-xs text-slate-400">{currentUser?.email ?? "Login pela home"}</p>
                </div>
              ) : null}
            </div>

            {!collapsed ? (
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">
                {currentUser?.role ?? "sem acesso"}
              </div>
            ) : null}

            <button
              type="button"
              onClick={onLogout}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white",
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-brand-dark text-slate-200">
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
        <div className="sticky top-0 z-30 border-b border-white/8 bg-brand-dark/85 px-4 py-4 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
            >
              <Menu size={16} />
              Menu
            </button>
            <p className="text-sm font-semibold text-slate-300">Painel admin</p>
          </div>
        </div>

        <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
