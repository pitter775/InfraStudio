"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, FolderKanban, ShieldAlert, Wallet } from "lucide-react";
import { PlansList, type PlanListItem } from "./_components/plans-list";
import { PlansSummary } from "./_components/plans-summary";
import { ProjectUsageList, type ProjectUsageListItem } from "./_components/project-usage-list";
import { formatCurrency, formatNumber } from "./_components/billing-helpers";

type Plano = PlanListItem;
type UsoRow = ProjectUsageListItem;

export default function AdminPlanosPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [uso, setUso] = useState<UsoRow[]>([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [loadingUso, setLoadingUso] = useState(true);
  const [updatingProjetoId, setUpdatingProjetoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);

  const load = async () => {
    setLoadingPlanos(true);
    setLoadingUso(true);

    const [planosResponse, usoResponse] = await Promise.all([
      fetch("/api/admin/planos", { cache: "no-store" }),
      fetch("/api/admin/uso", { cache: "no-store" }),
    ]);

    const planosPayload = (await planosResponse.json().catch(() => null)) as { planos?: Plano[]; error?: string } | null;
    const usoPayload = (await usoResponse.json().catch(() => null)) as { uso?: UsoRow[]; error?: string } | null;

    if (!planosResponse.ok || !usoResponse.ok) {
      setFeedback({
        tone: "error",
        message: planosPayload?.error ?? usoPayload?.error ?? "Nao foi possivel carregar a visao de billing.",
      });
    }

    setPlanos(planosPayload?.planos ?? []);
    setUso(usoPayload?.uso ?? []);
    setLoadingPlanos(false);
    setLoadingUso(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleProjectPlanChange = async (projetoId: string, planoId: string) => {
    const plano = planos.find((item) => item.id === planoId);
    if (!plano) {
      setFeedback({ tone: "error", message: "Plano nao encontrado." });
      return;
    }

    setUpdatingProjetoId(projetoId);
    setFeedback(null);

    const response = await fetch(`/api/admin/projetos/${projetoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomePlano: plano.nome,
        limiteTokensTotalMensal: plano.limiteTokensTotalMensal,
        limiteCustoMensal: plano.limiteCustoMensal,
        permitirExcedente: plano.permitirExcedente,
        custoTokenExcedente: 0,
        autoBloquear: true,
        bloqueado: false,
        bloqueadoMotivo: null,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setFeedback({
        tone: "error",
        message: payload?.error ?? "Nao foi possivel atualizar o plano do projeto.",
      });
      setUpdatingProjetoId(null);
      return;
    }

    await load();
    setUpdatingProjetoId(null);
    setFeedback({ tone: "success", message: "Plano do projeto atualizado." });
  };

  const projetosOrdenados = useMemo(
    () => [...uso].sort((left, right) => left.projetoNome.localeCompare(right.projetoNome, "pt-BR")),
    [uso],
  );

  const summaryItems = useMemo(() => {
    const totalTokens = uso.reduce((acc, item) => acc + item.consumoAtual.totalTokens, 0);
    const totalCusto = uso.reduce((acc, item) => acc + item.consumoAtual.custoTotal, 0);
    const totalAtivos = uso.reduce(
      (acc, item) => acc + (item.status === "ativo" && !item.cicloAtual?.bloqueado && !item.plano.bloqueado ? 1 : 0),
      0,
    );
    const totalBloqueados = uso.reduce(
      (acc, item) => acc + (item.status === "bloqueado" || item.cicloAtual?.bloqueado || item.plano.bloqueado ? 1 : 0),
      0,
    );

    return [
      { label: "Total tokens", value: formatNumber(totalTokens), icon: Coins },
      { label: "Custo total", value: formatCurrency(totalCusto), icon: Wallet },
      { label: "Projetos ativos", value: formatNumber(totalAtivos), icon: FolderKanban },
      { label: "Bloqueados", value: formatNumber(totalBloqueados), icon: ShieldAlert },
    ];
  }, [uso]);

  return (
    <main className="space-y-8">
      <section className="px-1 py-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Planos e Consumo</p>
        <h1 className="mt-3 text-4xl font-extrabold text-white">Gestao unificada</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">Planos, consumo atual e status dos projetos em uma tela so.</p>
      </section>

      {feedback ? (
        <section
          className={`rounded-3xl px-4 py-3 text-sm ${
            feedback.tone === "error" ? "bg-rose-500/10 text-rose-100" : "bg-emerald-500/10 text-emerald-100"
          }`}
        >
          {feedback.message}
        </section>
      ) : null}

      <PlansSummary items={summaryItems} />

      <ProjectUsageList
        rows={projetosOrdenados}
        planos={planos}
        loading={loadingUso}
        updatingProjetoId={updatingProjetoId}
        onChangePlano={(projetoId, planoId) => void handleProjectPlanChange(projetoId, planoId)}
      />

      <PlansList
        planos={planos}
        loading={loadingPlanos}
        onEdit={(planoId) => {
          setFeedback({ tone: "success", message: `Edicao do plano ${planoId} fica para a proxima etapa.` });
        }}
      />
    </main>
  );
}
