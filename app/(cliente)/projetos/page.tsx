"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, FolderKanban, Wallet } from "lucide-react";
import { getCurrentProjectUser } from "@/lib/auth";
import { canAccessWorkspace } from "@/lib/access";
import { formatCurrency, formatNumber } from "./_components/billing-helpers";
import { ProjectDetailModal } from "./_components/project-detail-modal";
import { ProjectCard } from "./_components/project-card";
import type { ProjetoBilling, ProjetoCardData, ProjetoRow } from "./_components/types";

export default function ClienteProjetosPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ProjetoCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjetoCardData | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const user = await getCurrentProjectUser();

      if (!canAccessWorkspace(user)) {
        router.replace("/");
        return;
      }

      setLoading(true);
      setFeedback(null);

      try {
        const projetosResponse = await fetch("/api/admin/projetos", { cache: "no-store" });
        const projetosPayload = (await projetosResponse.json().catch(() => null)) as
          | { projetos?: ProjetoRow[]; error?: string }
          | null;

        if (!projetosResponse.ok) {
          if (!active) {
            return;
          }

          setRows([]);
          setFeedback(projetosPayload?.error ?? "Nao foi possivel carregar os projetos.");
          setLoading(false);
          return;
        }

        const projetos = projetosPayload?.projetos ?? [];
        const details = await Promise.all(
          projetos.map(async (projeto) => {
            try {
              const response = await fetch(`/api/admin/projetos/${projeto.id}`, { cache: "no-store" });
              const payload = (await response.json().catch(() => null)) as
                | { billing?: ProjetoBilling | null }
                | { error?: string }
                | null;

              return {
                projetoId: projeto.id,
                projetoNome: projeto.nome,
                billing: response.ok ? (payload as { billing?: ProjetoBilling | null } | null)?.billing ?? null : null,
              } satisfies ProjetoCardData;
            } catch {
              return {
                projetoId: projeto.id,
                projetoNome: projeto.nome,
                billing: null,
              } satisfies ProjetoCardData;
            }
          }),
        );

        if (!active) {
          return;
        }

        setRows(details);
        setLoading(false);
      } catch {
        if (!active) {
          return;
        }

        setRows([]);
        setFeedback("Nao foi possivel carregar a area de projetos.");
        setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  const summary = useMemo(() => {
    return {
      projetos: rows.length,
      tokens: rows.reduce((acc, item) => acc + (item.billing?.currentUsage.totalTokens ?? 0), 0),
      custo: rows.reduce((acc, item) => acc + (item.billing?.currentUsage.custoTotal ?? 0), 0),
    };
  }, [rows]);

  const handleProjectAction = (action: "trocar-plano" | "comprar-tokens", item: ProjetoCardData) => {
    const label = action === "trocar-plano" ? "Trocar plano" : "Comprar tokens";
    setActionFeedback(`${label} para ${item.projetoNome} entra na proxima etapa.`);
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Area do cliente</p>
        <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Projetos e consumo</h1>
        <p className="max-w-3xl text-sm text-slate-400">Visao por projeto com plano atual, uso do ciclo e custo acumulado.</p>
      </section>

      {feedback ? <section className="rounded-3xl bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{feedback}</section> : null}
      {actionFeedback ? <section className="rounded-3xl border border-sky-400/15 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{actionFeedback}</section> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-3xl border border-white/8 bg-white/[0.03] px-5 py-4">
          <div className="flex items-center gap-3">
            <FolderKanban size={18} className="text-slate-400" />
            <span className="text-sm text-slate-400">Projetos</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-white">{formatNumber(summary.projetos)}</p>
        </article>

        <article className="rounded-3xl border border-white/8 bg-white/[0.03] px-5 py-4">
          <div className="flex items-center gap-3">
            <Coins size={18} className="text-slate-400" />
            <span className="text-sm text-slate-400">Tokens usados</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-white">{formatNumber(summary.tokens)}</p>
        </article>

        <article className="rounded-3xl border border-white/8 bg-white/[0.03] px-5 py-4">
          <div className="flex items-center gap-3">
            <Wallet size={18} className="text-slate-400" />
            <span className="text-sm text-slate-400">Custo atual</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-white">{formatCurrency(summary.custo)}</p>
        </article>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-bold text-white">Seus projetos</h2>
          <p className="mt-1 text-sm text-slate-400">Lista baseada nos projetos vinculados ao seu acesso.</p>
        </div>

        <div className="grid gap-4">
          {loading ? <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-5 py-6 text-sm text-slate-400">Carregando projetos...</div> : null}

          {!loading && !rows.length ? (
            <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-5 py-6 text-sm text-slate-400">Nenhum projeto encontrado.</div>
          ) : null}

          {!loading
            ? rows.map((item) => (
                <ProjectCard
                  key={item.projetoId}
                  item={item}
                  onOpenDetails={setSelectedProject}
                  onAction={handleProjectAction}
                />
              ))
            : null}
        </div>
      </section>

      <ProjectDetailModal
        item={selectedProject}
        open={Boolean(selectedProject)}
        onClose={() => setSelectedProject(null)}
        onAction={handleProjectAction}
      />
    </main>
  );
}
