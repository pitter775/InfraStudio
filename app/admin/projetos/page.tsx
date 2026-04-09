"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Bot, BriefcaseBusiness, Cable, LoaderCircle, Lock, MessageSquareText, Plus, Search, Shield, X } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/_components/admin-page-header";
import { canAccessWorkspace } from "@/lib/access";
import { getCurrentProjectUser } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";
import { saveCurrentDemoState } from "@/lib/demo-conversion";
import { isDemoUser } from "@/lib/demo-user";
import { formatCurrency, formatNumber, getUsageProgressValue } from "@/app/admin/planos/_components/billing-helpers";

const ACTIVE_PROJECT_STORAGE_KEY = "projeto_ativo";

type Projeto = {
  id: string;
  nome: string;
  slug?: string | null;
  tipo?: string | null;
  descricao: string;
  status: string;
  createdAt?: string | null;
  modoCobranca: "plano" | "manual" | "ilimitado";
  criadorNome?: string | null;
  criadorEmail?: string | null;
  billing?: {
    planoAtual: string;
    usoPercentual: number | null;
    bloqueado: boolean;
    totalTokens: number;
    custoTotal: number;
    limiteTokensTotalMensal: number | null;
  };
  stats: {
    totalAgentes: number;
    agentesAtivos: number;
    totalConectores: number;
    conectoresAtivos: number;
    totalMercadoLivre: number;
    totalWhatsAppChannels: number;
    totalChats: number;
  };
};

type ProjetoFormState = {
  nome: string;
  slug: string;
  tipo: string;
  descricao: string;
  status: string;
  modoCobranca: "plano" | "manual" | "ilimitado";
};

const emptyProjetoForm: ProjetoFormState = {
  nome: "",
  slug: "",
  tipo: "",
  descricao: "",
  status: "ativo",
  modoCobranca: "plano",
};

const primaryActionButtonClass =
  "infra-click-pulse inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-50 shadow-[0_10px_30px_rgba(56,189,248,0.12)] transition-all hover:border-sky-300/30 hover:bg-sky-400/14 disabled:cursor-not-allowed disabled:opacity-60";

const neutralActionButtonClass =
  "infra-click-pulse inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.18)] transition-all hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60";

function BusyIcon() {
  return <LoaderCircle size={15} className="animate-spin" />;
}

function CenterLoader() {
  return (
    <div className="flex min-h-[220px] items-center justify-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute h-20 w-20 rounded-full bg-sky-500/20 blur-2xl animate-pulse" />
        <div className="absolute h-14 w-14 rounded-full bg-cyan-400/15 blur-xl animate-pulse" />
        <Image src="/logo.png" alt="InfraStudio" width={38} height={38} className="relative h-10 w-10 object-contain" />
      </div>
    </div>
  );
}

type ProjetoStatusFilter = "todos" | "ativo" | "inativo" | "bloqueado";
type ProjetoSortKey = "nome" | "uso" | "data";

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getProjetoStatusLabel(projeto: Projeto) {
  if (projeto.billing?.bloqueado) {
    return "Bloqueado";
  }

  return projeto.status?.trim().toLowerCase() === "ativo" ? "Ativo" : "Inativo";
}

function getProjetoStatusClass(projeto: Projeto) {
  if (projeto.billing?.bloqueado) {
    return "border-rose-500/20 bg-rose-500/10 text-rose-200";
  }

  return projeto.status?.trim().toLowerCase() === "ativo"
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
    : "border-white/10 bg-white/5 text-slate-300";
}

export default function AdminProjetosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjetoStatusFilter>("todos");
  const [sortBy, setSortBy] = useState<ProjetoSortKey>("uso");
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjetoFormState>(emptyProjetoForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [demoBlockedModalOpen, setDemoBlockedModalOpen] = useState(false);
  const handoffError = searchParams.get("handoff_error")?.trim() || null;
  const demoMode = isDemoUser(currentUser?.email);

  const handleDemoAuthRedirect = (mode: "login" | "cadastro") => {
    saveCurrentDemoState();
    setDemoBlockedModalOpen(false);
    router.push(`/?auth=${mode}`);
  };

  const loadProjetos = async () => {
    const [projetosResponse, usoResponse] = await Promise.all([
      fetch("/api/admin/projetos", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/admin/uso", { cache: "no-store" }).then((response) => response.json()).catch(() => ({ uso: [] })),
    ]);

    const billingMap = new Map(
      ((usoResponse.uso ?? []) as Array<{
        projetoId: string;
        plano: { nomePlano: string; bloqueado: boolean; limiteTokensTotalMensal: number | null };
        consumoAtual: { totalTokens: number; custoTotal: number };
        percentualUso: number | null;
        status: "ativo" | "bloqueado";
      }>).map((item) => [
        item.projetoId,
        {
          planoAtual: item.plano.nomePlano?.trim() || "Ilimitado",
          usoPercentual: item.percentualUso,
          bloqueado: item.status === "bloqueado" || item.plano.bloqueado,
          totalTokens: item.consumoAtual.totalTokens,
          custoTotal: item.consumoAtual.custoTotal,
          limiteTokensTotalMensal: item.plano.limiteTokensTotalMensal,
        },
      ]),
    );

    const payload = projetosResponse as { projetos?: Projeto[] };
    setProjetos(
      (payload.projetos ?? []).map((projeto) => ({
        ...projeto,
        billing: billingMap.get(projeto.id) ?? {
          planoAtual: "Ilimitado",
          usoPercentual: null,
          bloqueado: false,
          totalTokens: 0,
          custoTotal: 0,
          limiteTokensTotalMensal: null,
        },
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentProjectUser();
      setCurrentUser(user);

      if (!canAccessWorkspace(user)) {
        setLoading(false);
        return;
      }

      await loadProjetos();
    };

    void load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setLastProjectId(window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY));
  }, []);

  useEffect(() => {
    if (handoffError !== "access_denied") {
      return;
    }

    setFeedback("Voce nao tem acesso ao projeto desse link de handoff. Entre com outro usuario ou abra um projeto permitido.");
  }, [handoffError]);

  const handleSubmit = async () => {
    if (demoMode) {
      setModalOpen(false);
      setDemoBlockedModalOpen(true);
      return;
    }

    setSaving(true);
    setFeedback(null);

    const response = await fetch("/api/admin/projetos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = (await response.json()) as { error?: string; projeto?: Projeto };

    if (!response.ok) {
      if (response.status === 403) {
        setModalOpen(false);
        setDemoBlockedModalOpen(true);
      }
      setFeedback(payload.error ?? "Nao foi possivel criar o projeto.");
      setSaving(false);
      return;
    }

    setProjetos((current) =>
      [
        ...current,
        {
          ...payload.projeto!,
          billing: {
            planoAtual: "Ilimitado",
            usoPercentual: null,
            bloqueado: false,
            totalTokens: 0,
            custoTotal: 0,
            limiteTokensTotalMensal: null,
          },
          stats: payload.projeto?.stats ?? {
            totalAgentes: 0,
            agentesAtivos: 0,
            totalConectores: 0,
            conectoresAtivos: 0,
            totalMercadoLivre: 0,
            totalWhatsAppChannels: 0,
            totalChats: 0,
          },
        },
      ].sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR")),
    );
    setForm(emptyProjetoForm);
    setModalOpen(false);
    setSaving(false);
    setFeedback("Projeto criado com sucesso.");
  };

  const filteredProjetos = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(searchTerm.trim());

    return [...projetos]
      .filter((projeto) => {
        if (!normalizedSearch) {
          return true;
        }

        const haystack = normalizeSearchValue([projeto.nome, projeto.slug, projeto.tipo, projeto.criadorNome, projeto.criadorEmail].filter(Boolean).join(" "));
        return haystack.includes(normalizedSearch);
      })
      .filter((projeto) => {
        if (statusFilter === "todos") {
          return true;
        }

        if (statusFilter === "bloqueado") {
          return projeto.billing?.bloqueado === true;
        }

        return projeto.status?.trim().toLowerCase() === statusFilter && projeto.billing?.bloqueado !== true;
      })
      .sort((left, right) => {
        if (sortBy === "uso") {
          const usageDelta = (right.billing?.totalTokens ?? 0) - (left.billing?.totalTokens ?? 0);
          if (usageDelta !== 0) {
            return usageDelta;
          }
        }

        if (sortBy === "data") {
          const rightTime = new Date(right.createdAt ?? 0).getTime();
          const leftTime = new Date(left.createdAt ?? 0).getTime();
          const dateDelta = rightTime - leftTime;
          if (dateDelta !== 0) {
            return dateDelta;
          }
        }

        return left.nome.localeCompare(right.nome, "pt-BR");
      });
  }, [projetos, searchTerm, sortBy, statusFilter]);

  const lastProjeto = lastProjectId ? projetos.find((projeto) => projeto.id === lastProjectId) ?? null : null;

  if (loading && !currentUser) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">
          <CenterLoader />
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
            <Lock size={14} />
            Acesso bloqueado
          </div>
          <h2 className="text-2xl font-bold text-white">Voce ainda nao fez login</h2>
          <p className="mt-3 max-w-xl text-slate-300">Entre para acessar seus projetos.</p>
        </section>
      </main>
    );
  }

  if (!canAccessWorkspace(currentUser)) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-200">
            <Shield size={14} />
            Permissao insuficiente
          </div>
          <h2 className="text-2xl font-bold text-white">Sem acesso ao ambiente</h2>
          <p className="mt-3 max-w-xl text-slate-300">Seu usuario precisa estar autenticado para criar ou acessar projetos.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <AdminPageHeader
        eyebrow="Projetos"
        eyebrowIcon={<BriefcaseBusiness size={14} />}
        title="Meus projetos"
        description="Lista compacta para navegar rapido mesmo com muitos projetos."
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {lastProjeto ? (
              <Link
                href={`/admin/projetos/${lastProjeto.id}`}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, lastProjeto.id);
                  }
                }}
                className={`${neutralActionButtonClass} px-3 py-2.5 text-xs`}
              >
                Ultimo projeto
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (demoMode) {
                  setDemoBlockedModalOpen(true);
                  return;
                }

                setModalOpen(true);
              }}
              className={`${primaryActionButtonClass} px-3 py-2.5 text-xs`}
            >
              <Plus size={15} />
              Criar projeto
            </button>
          </div>
        )}
      />

      {feedback ? <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</section> : null}

      {!loading && projetos.length ? (
        <section className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {[
            {
              label: "Projetos",
              value: projetos.length,
              icon: BriefcaseBusiness,
              tone: "text-amber-200",
            },
            {
              label: "Agentes",
              value: projetos.reduce((sum, projeto) => sum + projeto.stats.totalAgentes, 0),
              icon: Bot,
              tone: "text-cyan-200",
            },
            {
              label: "Chats",
              value: projetos.reduce((sum, projeto) => sum + projeto.stats.totalChats, 0),
              icon: MessageSquareText,
              tone: "text-emerald-200",
            },
            {
              label: "WhatsApp",
              value: projetos.reduce((sum, projeto) => sum + projeto.stats.totalWhatsAppChannels, 0),
              icon: Cable,
              tone: "text-lime-200",
            },
            {
              label: "Mercado Livre",
              value: projetos.reduce((sum, projeto) => sum + projeto.stats.totalMercadoLivre, 0),
              icon: Cable,
              tone: "text-orange-200",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-3 shadow-[0_18px_45px_rgba(2,8,23,0.18)]">
                <div className={`pointer-events-none absolute right-3 top-3 ${item.tone} opacity-16`}>
                  <Icon size={20} />
                </div>
                <div className="relative flex items-center gap-3">
                  <div className={`rounded-xl border border-white/8 bg-white/[0.03] p-2 ${item.tone}`}>
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                    <p className="mt-1 text-2xl font-bold leading-none text-slate-100">{item.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.026),rgba(255,255,255,0.01))] shadow-[0_20px_50px_rgba(2,8,23,0.2)]">
        <div className="border-b border-white/8 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar projeto por nome, slug, tipo ou criador"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/55 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-sky-400/30"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row xl:min-w-fit">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as ProjetoStatusFilter)}
                className="rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm text-slate-200 outline-none"
              >
                <option value="todos">Todos os status</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
                <option value="bloqueado">Bloqueados</option>
              </select>

              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2.5 text-sm text-slate-200">
                <ArrowUpDown size={15} className="text-slate-500" />
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as ProjetoSortKey)}
                  className="bg-transparent text-sm text-slate-200 outline-none"
                >
                  <option value="uso">Ordenar por uso</option>
                  <option value="nome">Ordenar por nome</option>
                  <option value="data">Ordenar por data</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="px-1 py-4">
          {loading ? <CenterLoader /> : null}
          {!loading && !projetos.length ? <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">Nenhum projeto vinculado ainda.</div> : null}
          {!loading && projetos.length && !filteredProjetos.length ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">Nenhum projeto encontrado com os filtros atuais.</div>
          ) : null}
          {filteredProjetos.length ? (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-white/8 lg:block">
                <table className="min-w-full table-fixed border-collapse">
                  <thead className="bg-slate-950/55 text-left">
                    <tr className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-4 py-3 font-semibold">Projeto</th>
                      <th className="px-4 py-3 font-semibold">Plano</th>
                      <th className="px-4 py-3 font-semibold">Tokens usados</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Acao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjetos.map((projeto) => (
                      <tr
                        key={projeto.id}
                        onClick={() => router.push(`/admin/projetos/${projeto.id}`)}
                        className="cursor-pointer border-t border-white/6 bg-white/[0.01] transition hover:bg-sky-400/[0.06]"
                      >
                        <td className="px-4 py-3.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-slate-100">{projeto.nome}</span>
                              {lastProjectId === projeto.id ? (
                                <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-200">Recente</span>
                              ) : null}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span>{projeto.tipo?.trim() || "Sem tipo"}</span>
                              <span className="text-slate-600">/</span>
                              <span>{projeto.stats.totalAgentes} agentes</span>
                              <span className="text-slate-600">/</span>
                              <span>{projeto.stats.totalChats} chats</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-sm font-medium text-slate-200">{projeto.billing?.planoAtual ?? "Ilimitado"}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatCurrency(projeto.billing?.custoTotal ?? 0)}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-sm font-semibold text-slate-100">{formatNumber(projeto.billing?.totalTokens)} tokens</div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <span>
                              {projeto.billing?.usoPercentual === null || projeto.billing?.usoPercentual === undefined ? "Sem limite" : `${Math.round(projeto.billing.usoPercentual)}% do limite`}
                            </span>
                            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/8">
                              <span
                                className={`block h-full rounded-full ${projeto.billing?.bloqueado ? "bg-rose-500" : "bg-emerald-500"}`}
                                style={{ width: `${getUsageProgressValue(projeto.billing?.usoPercentual ?? 0)}%` }}
                              />
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getProjetoStatusClass(projeto)}`}>
                            {getProjetoStatusLabel(projeto)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            href={`/admin/projetos/${projeto.id}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (typeof window !== "undefined") {
                                window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projeto.id);
                              }
                            }}
                            className={`${primaryActionButtonClass} px-3 py-2 text-xs`}
                          >
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-2 lg:hidden">
                {filteredProjetos.map((projeto) => (
                  <button
                    key={projeto.id}
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projeto.id);
                      }
                      router.push(`/admin/projetos/${projeto.id}`);
                    }}
                    className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-left transition hover:border-sky-400/20 hover:bg-sky-400/[0.05]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-100">{projeto.nome}</p>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${getProjetoStatusClass(projeto)}`}>
                            {getProjetoStatusLabel(projeto)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{projeto.billing?.planoAtual ?? "Ilimitado"}</p>
                      </div>
                      <span className="text-xs font-semibold text-sky-200">Abrir</span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-white/8 bg-slate-950/35 px-3 py-2">
                        <p className="text-slate-500">Tokens</p>
                        <p className="mt-1 font-semibold text-slate-100">{formatNumber(projeto.billing?.totalTokens)}</p>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-slate-950/35 px-3 py-2">
                        <p className="text-slate-500">Uso</p>
                        <p className="mt-1 font-semibold text-slate-100">
                          {projeto.billing?.usoPercentual === null || projeto.billing?.usoPercentual === undefined ? "Sem limite" : `${Math.round(projeto.billing.usoPercentual)}%`}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="text-2xl font-bold text-white">Criar projeto</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className={`${neutralActionButtonClass} px-3`} aria-label="Fechar modal">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-6">
              <div className="grid gap-4">
                <input value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Nome" className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" />
                <input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="Slug" className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" />
                <input value={form.tipo} onChange={(event) => setForm((current) => ({ ...current, tipo: event.target.value }))} placeholder="Tipo" className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" />
                <select value={form.modoCobranca} onChange={(event) => setForm((current) => ({ ...current, modoCobranca: event.target.value as ProjetoFormState["modoCobranca"] }))} className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none">
                  <option value="plano">plano</option>
                  <option value="manual">manual</option>
                  <option value="ilimitado">ilimitado</option>
                </select>
                <textarea value={form.descricao} onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))} placeholder="Descricao" rows={4} className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" />
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className={neutralActionButtonClass}>Cancelar</button>
                <button type="button" onClick={() => void handleSubmit()} disabled={saving} className={primaryActionButtonClass}>
                  {saving ? <BusyIcon /> : <Plus size={16} />}
                  Criar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {demoBlockedModalOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-2xl font-bold text-white">Modo demonstracao</h2>
              <p className="mt-2 text-sm text-slate-300">Tudo que voce fizer aqui nao sera salvo. Crie uma conta para continuar.</p>
            </div>
            <div className="flex flex-wrap gap-3 px-6 py-6">
              <button type="button" onClick={() => handleDemoAuthRedirect("cadastro")} className={primaryActionButtonClass}>
                Criar conta
              </button>
              <button type="button" onClick={() => handleDemoAuthRedirect("login")} className={neutralActionButtonClass}>
                Fazer login
              </button>
              <button type="button" onClick={() => setDemoBlockedModalOpen(false)} className={neutralActionButtonClass}>
                Continuar testando
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
