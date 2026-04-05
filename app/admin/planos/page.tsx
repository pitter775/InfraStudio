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
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setFeedback(null);
      setLoadingPlanos(true);
      setLoadingUso(true);

      const [planosResponse, usoResponse] = await Promise.all([
        fetch("/api/admin/planos", { cache: "no-store" }),
        fetch("/api/admin/uso", { cache: "no-store" }),
      ]);

      const planosPayload = (await planosResponse.json().catch(() => null)) as { planos?: Plano[]; error?: string } | null;
      const usoPayload = (await usoResponse.json().catch(() => null)) as { uso?: UsoRow[]; error?: string } | null;

      if (!planosResponse.ok || !usoResponse.ok) {
        setFeedback(planosPayload?.error ?? usoPayload?.error ?? "Nao foi possivel carregar a visao de planos.");
      }

      setPlanos(planosPayload?.planos ?? []);
      setUso(usoPayload?.uso ?? []);
      setLoadingPlanos(false);
      setLoadingUso(false);
    };

    void load();
  }, []);

  const summaryItems = useMemo(() => {
    const totalProjetos = uso.length;
    const totalTokens = uso.reduce((acc, item) => acc + item.consumoAtual.totalTokens, 0);
    const totalCusto = uso.reduce((acc, item) => acc + item.consumoAtual.custoTotal, 0);
    const totalBloqueados = uso.reduce(
      (acc, item) => acc + (item.status === "bloqueado" || item.cicloAtual?.bloqueado || item.plano.bloqueado ? 1 : 0),
      0,
    );

    return [
      { label: "Projetos", value: formatNumber(totalProjetos), icon: FolderKanban },
      { label: "Tokens no ciclo", value: formatNumber(totalTokens), icon: Coins },
      { label: "Custo atual", value: formatCurrency(totalCusto), icon: Wallet },
      { label: "Bloqueados", value: formatNumber(totalBloqueados), icon: ShieldAlert },
    ];
  }, [uso]);

  return (
    <main className="space-y-8">
      <section className="px-1 py-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Planos e Consumo</p>
        <h1 className="mt-3 text-4xl font-extrabold text-white">Gestao unificada</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Uma visao unica de planos, uso do ciclo atual e status operacional dos projetos.
        </p>
      </section>

      {feedback ? <section className="rounded-3xl bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{feedback}</section> : null}

      <PlansSummary items={summaryItems} />

      <PlansList
        planos={planos}
        loading={loadingPlanos}
        onEdit={(planoId) => {
          setFeedback(`Edicao do plano ${planoId} fica para a proxima etapa.`);
        }}
      />

      <ProjectUsageList rows={uso} loading={loadingUso} />
    </main>
  );
}
