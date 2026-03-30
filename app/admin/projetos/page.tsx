"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, Cable, LoaderCircle, Lock, MessageSquareText, Plus, Shield, Bot, X } from "lucide-react";
import { canAccessWorkspace } from "@/lib/access";
import { getCurrentProjectUser } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";

type Projeto = {
  id: string;
  nome: string;
  slug?: string | null;
  tipo?: string | null;
  descricao: string;
  status: string;
  modoCobranca: "plano" | "manual" | "ilimitado";
  criadorNome?: string | null;
  criadorEmail?: string | null;
  billing?: {
    planoAtual: string;
    usoPercentual: number | null;
    bloqueado: boolean;
  };
  stats: {
    totalAgentes: number;
    agentesAtivos: number;
    totalConectores: number;
    conectoresAtivos: number;
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

export default function AdminProjetosPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [form, setForm] = useState<ProjetoFormState>(emptyProjetoForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadProjetos = async () => {
    const [projetosResponse, usoResponse] = await Promise.all([
      fetch("/api/admin/projetos", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/admin/uso", { cache: "no-store" }).then((response) => response.json()).catch(() => ({ uso: [] })),
    ]);
    const billingMap = new Map(
      ((usoResponse.uso ?? []) as Array<{
        projetoId: string;
        plano: { nomePlano: string; bloqueado: boolean };
        percentualUso: number | null;
        status: "ativo" | "bloqueado";
      }>).map((item) => [
        item.projetoId,
        {
          planoAtual: item.plano.nomePlano,
          usoPercentual: item.percentualUso,
          bloqueado: item.status === "bloqueado" || item.plano.bloqueado,
        },
      ]),
    );

    const payload = projetosResponse as { projetos?: Projeto[] };
    setProjetos((payload.projetos ?? []).map((projeto) => ({ ...projeto, billing: billingMap.get(projeto.id) })));
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

  const handleSubmit = async () => {
    setSaving(true);
    setFeedback(null);

    const response = await fetch("/api/admin/projetos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = (await response.json()) as { error?: string; projeto?: Projeto };

    if (!response.ok) {
      setFeedback(payload.error ?? "Nao foi possivel criar o projeto.");
      setSaving(false);
      return;
    }

    setProjetos((current) =>
      [
        ...current,
        {
          ...payload.projeto!,
          stats: payload.projeto?.stats ?? {
            totalAgentes: 0,
            agentesAtivos: 0,
            totalConectores: 0,
            conectoresAtivos: 0,
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

  const handleModoCobrancaChange = async (projeto: Projeto, modoCobranca: "plano" | "manual" | "ilimitado") => {
    const response = await fetch("/api/admin/projetos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: projeto.id,
        nome: projeto.nome,
        slug: projeto.slug,
        tipo: projeto.tipo,
        descricao: projeto.descricao,
        status: projeto.status,
        modoCobranca,
      }),
    });
    const payload = (await response.json()) as { error?: string; projeto?: Projeto };

    if (!response.ok) {
      setFeedback(payload.error ?? "Nao foi possivel atualizar o modo de cobranca.");
      return;
    }

    setProjetos((current) =>
      current.map((item) =>
        item.id === projeto.id
          ? {
              ...item,
              modoCobranca,
            }
          : item,
      ),
    );
    setFeedback("Modo de cobranca atualizado.");
  };

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
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
          <BriefcaseBusiness size={14} />
          Projetos
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-50">Seus projetos</h1>
            <p className="mt-4 max-w-3xl text-slate-400">Abra um projeto para continuar o trabalho no contexto correto.</p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={primaryActionButtonClass}
          >
            <Plus size={16} />
            Criar projeto
          </button>
        </div>
      </section>

      {feedback ? <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</section> : null}

      {!loading && projetos.length ? (
        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: "Projetos",
              value: projetos.length,
              description: "Workspaces disponiveis para abrir e operar.",
              icon: BriefcaseBusiness,
              tone: "text-amber-200",
              glow: "bg-amber-400/16",
            },
            {
              label: "Agentes",
              value: projetos.reduce((sum, projeto) => sum + projeto.stats.totalAgentes, 0),
              description: "Total consolidado de agentes em todos os projetos visiveis.",
              icon: Bot,
              tone: "text-cyan-200",
              glow: "bg-cyan-400/16",
            },
            {
              label: "Chats",
              value: projetos.reduce((sum, projeto) => sum + projeto.stats.totalChats, 0),
              description: "Conversas acumuladas nos projetos vinculados.",
              icon: MessageSquareText,
              tone: "text-emerald-200",
              glow: "bg-emerald-400/16",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-5 shadow-[0_18px_45px_rgba(2,8,23,0.18)]">
                <div className={`pointer-events-none absolute right-4 top-4 ${item.tone} opacity-16`}>
                  <Icon size={34} />
                </div>
                <div className="relative flex items-start gap-4">
                  <p className="min-w-[56px] text-4xl font-black leading-none text-slate-100">{item.value}</p>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                    <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl">
        <div className="px-1 py-2">
          <h2 className="text-xl font-bold text-slate-50">Meus projetos</h2>
          <p className="mt-2 text-sm text-slate-400">Escolha um projeto para continuar de onde voce parou.</p>
        </div>
        <div className="px-1 py-4">
          {loading ? <CenterLoader /> : null}
          {!loading && !projetos.length ? <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">Nenhum projeto vinculado ainda.</div> : null}
          {projetos.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {projetos.map((projeto) => (
                <div key={projeto.id} className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.026),rgba(255,255,255,0.012))] p-6 shadow-[0_18px_38px_rgba(2,8,23,0.22)]">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-2xl font-bold text-slate-50">{projeto.nome}</h3>
                          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">{projeto.status}</span>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${projeto.billing?.bloqueado ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/15 text-emerald-300"}`}>
                            {projeto.billing?.bloqueado ? "bloqueado" : "ativo"}
                          </span>
                          {projeto.tipo ? (
                            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">{projeto.tipo}</span>
                          ) : null}
                        </div>
                        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">{projeto.descricao || "Sem descricao."}</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-white/8 bg-slate-950/30 px-4 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Plano atual</p>
                            <p className="mt-2 text-sm font-semibold text-white">{projeto.billing?.planoAtual ?? "Sem plano"}</p>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-slate-950/30 px-4 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Uso atual</p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              {projeto.billing?.usoPercentual === null || projeto.billing?.usoPercentual === undefined ? "Sem limite" : `${Math.round(projeto.billing.usoPercentual)}%`}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-slate-950/30 px-4 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Modo de cobranca</p>
                            {currentUser?.isMaster ? (
                              <select
                                value={projeto.modoCobranca}
                                onChange={(event) => void handleModoCobrancaChange(projeto, event.target.value as Projeto["modoCobranca"])}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none"
                              >
                                <option value="plano">plano</option>
                                <option value="manual">manual</option>
                                <option value="ilimitado">ilimitado</option>
                              </select>
                            ) : (
                              <p className="mt-2 text-sm font-semibold text-white">{projeto.modoCobranca}</p>
                            )}
                          </div>
                        </div>
                        {projeto.criadorNome || projeto.criadorEmail ? (
                          <p className="mt-2 text-xs text-slate-500">
                            Criado por {projeto.criadorNome ?? projeto.criadorEmail}
                          </p>
                        ) : null}
                      </div>
                      <Link
                        href={`/admin/projetos/${projeto.id}`}
                        className={primaryActionButtonClass}
                      >
                        Abrir projeto
                      </Link>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {[
                        {
                          label: "Agentes",
                          value: projeto.stats.totalAgentes,
                          description: `${projeto.stats.agentesAtivos} ativos`,
                          icon: Bot,
                          tone: "text-cyan-200",
                          glow: "bg-cyan-400/14",
                        },
                        {
                          label: "Integracoes",
                          value: projeto.stats.totalConectores,
                          description: `${projeto.stats.conectoresAtivos} ativas`,
                          icon: Cable,
                          tone: "text-violet-200",
                          glow: "bg-violet-400/14",
                        },
                        {
                          label: "Chats",
                          value: projeto.stats.totalChats,
                          description: "Historico do projeto",
                          icon: MessageSquareText,
                          tone: "text-emerald-200",
                          glow: "bg-emerald-400/14",
                        },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={`${projeto.id}-${item.label}`} className="relative overflow-hidden rounded-2xl border border-white/7 bg-white/[0.024] p-4 shadow-[0_12px_24px_rgba(2,8,23,0.18)]">
                            <div className={`pointer-events-none absolute right-4 top-4 ${item.tone} opacity-16`}>
                              <Icon size={28} />
                            </div>
                            <div className="relative flex flex-col items-start gap-3">
                              <p className="text-4xl font-black leading-none text-slate-100">{item.value}</p>
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                                <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.description}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="text-2xl font-extrabold text-white">Criar projeto</h2>
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
    </main>
  );
}
