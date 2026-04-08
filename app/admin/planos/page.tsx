"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Coins, FolderKanban, ShieldAlert, Wallet } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/_components/admin-page-header";
import { PlansList, type PlanListItem } from "./_components/plans-list";
import { PlansSummary } from "./_components/plans-summary";
import { ProjectUsageList, type ProjectUsageListItem } from "./_components/project-usage-list";
import { formatCurrency, formatNumber } from "./_components/billing-helpers";

type Plano = PlanListItem;
type UsoRow = ProjectUsageListItem;
type ProjetoPlanPayload = {
  planoId: string | null;
  nomePlano: string;
  limiteTokensTotalMensal: number | null;
  limiteCustoMensal: number | null;
  permitirExcedente: boolean;
  bloqueado: boolean;
};

type PlanoFormState = {
  nome: string;
  precoMensal: string;
  limiteTokensTotalMensal: string;
  limiteCustoMensal: string;
  isFree: boolean;
  ativo: boolean;
};

const emptyPlanoForm: PlanoFormState = {
  nome: "",
  precoMensal: "0",
  limiteTokensTotalMensal: "",
  limiteCustoMensal: "",
  isFree: false,
  ativo: true,
};

function calculatePercentualUso(totalTokens: number, limiteTokensTotalMensal: number | null) {
  if (limiteTokensTotalMensal === null || limiteTokensTotalMensal <= 0) {
    return null;
  }

  return Number(((totalTokens / limiteTokensTotalMensal) * 100).toFixed(2));
}

function applyReturnedPlanToUsage(current: UsoRow, plan: ProjetoPlanPayload, modoCobranca: UsoRow["modoCobranca"]): UsoRow {
  return {
    ...current,
    modoCobranca,
    plano: {
      ...current.plano,
      planoId: modoCobranca === "ilimitado" ? null : plan.planoId,
      nomePlano: modoCobranca === "ilimitado" ? "Ilimitado" : plan.nomePlano,
      limiteTokensTotalMensal: modoCobranca === "ilimitado" ? null : plan.limiteTokensTotalMensal,
      limiteCustoMensal: modoCobranca === "ilimitado" ? null : plan.limiteCustoMensal,
      permitirExcedente: modoCobranca === "ilimitado" ? true : plan.permitirExcedente,
      bloqueado: modoCobranca === "ilimitado" ? false : plan.bloqueado,
    },
    percentualUso:
      modoCobranca === "ilimitado" ? null : calculatePercentualUso(current.consumoAtual.totalTokens, plan.limiteTokensTotalMensal),
    status: modoCobranca === "ilimitado" ? "ativo" : plan.bloqueado ? "bloqueado" : "ativo",
    cicloAtual: current.cicloAtual
      ? {
          ...current.cicloAtual,
          alerta80: false,
          alerta100: false,
          bloqueado: false,
          permitirExcedente: modoCobranca === "ilimitado" ? true : plan.permitirExcedente,
          excedenteTokens: 0,
        }
      : null,
  };
}

export default function AdminPlanosPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [uso, setUso] = useState<UsoRow[]>([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [loadingUso, setLoadingUso] = useState(true);
  const [updatingProjetoId, setUpdatingProjetoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const unlimitedPlanId = "__ilimitado__";
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [savingPlano, setSavingPlano] = useState(false);
  const [editingPlanoId, setEditingPlanoId] = useState<string | null>(null);
  const [planoForm, setPlanoForm] = useState<PlanoFormState>(emptyPlanoForm);
  const [projectSearch, setProjectSearch] = useState("");

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

  const openCreatePlanoModal = () => {
    setEditingPlanoId(null);
    setPlanoForm(emptyPlanoForm);
    setPlanModalOpen(true);
  };

  const openEditPlanoModal = (planoId: string) => {
    const plano = planos.find((item) => item.id === planoId);
    if (!plano) {
      setFeedback({ tone: "error", message: "Plano nao encontrado." });
      return;
    }

    setEditingPlanoId(plano.id);
    setPlanoForm({
      nome: plano.nome,
      precoMensal: String(plano.precoMensal),
      limiteTokensTotalMensal: plano.limiteTokensTotalMensal === null ? "" : String(plano.limiteTokensTotalMensal),
      limiteCustoMensal: plano.limiteCustoMensal === null ? "" : String(plano.limiteCustoMensal),
      isFree: plano.isFree,
      ativo: plano.ativo,
    });
    setPlanModalOpen(true);
  };

  const handleSavePlano = async () => {
    setSavingPlano(true);
    setFeedback(null);

    const body = {
      nome: planoForm.nome,
      precoMensal: planoForm.precoMensal,
      limiteTokensTotalMensal: planoForm.limiteTokensTotalMensal,
      limiteCustoMensal: planoForm.limiteCustoMensal,
      isFree: planoForm.isFree,
      ativo: planoForm.ativo,
    };

    const response = await fetch(editingPlanoId ? `/api/admin/planos/${editingPlanoId}` : "/api/admin/planos", {
      method: editingPlanoId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setFeedback({ tone: "error", message: payload?.error ?? "Nao foi possivel salvar o plano." });
      setSavingPlano(false);
      return;
    }

    await load();
    setSavingPlano(false);
    setPlanModalOpen(false);
    setEditingPlanoId(null);
    setPlanoForm(emptyPlanoForm);
    setFeedback({ tone: "success", message: editingPlanoId ? "Plano atualizado." : "Plano criado." });
  };

  const handleTogglePlano = async (planoId: string, ativo: boolean) => {
    setFeedback(null);

    const response = await fetch(`/api/admin/planos/${planoId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setFeedback({ tone: "error", message: payload?.error ?? "Nao foi possivel alterar o status do plano." });
      return;
    }

    await load();
    setFeedback({ tone: "success", message: ativo ? "Plano ativado." : "Plano inativado." });
  };

  const handleDeletePlano = async (planoId: string) => {
    const confirmed = window.confirm("Excluir este plano?");
    if (!confirmed) {
      return;
    }

    setFeedback(null);

    const response = await fetch(`/api/admin/planos/${planoId}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setFeedback({ tone: "error", message: payload?.error ?? "Nao foi possivel excluir o plano." });
      return;
    }

    await load();
    setFeedback({ tone: "success", message: "Plano excluido." });
  };

  const handleProjectPlanChange = async (projetoId: string, planoId: string) => {
    setUpdatingProjetoId(projetoId);
    setFeedback(null);
    const previousUso = uso.find((item) => item.projetoId === projetoId) ?? null;

    const applyUsoUpdate = (next: UsoRow) => {
      setUso((current) => current.map((item) => (item.projetoId === projetoId ? next : item)));
    };

    if (planoId === unlimitedPlanId) {
      if (previousUso) {
        applyUsoUpdate({
          ...previousUso,
          modoCobranca: "ilimitado",
          plano: {
            ...previousUso.plano,
            planoId: null,
            nomePlano: "Ilimitado",
            limiteTokensTotalMensal: null,
            limiteCustoMensal: null,
            permitirExcedente: true,
            bloqueado: false,
          },
          percentualUso: null,
          status: "ativo",
          cicloAtual: previousUso.cicloAtual
            ? {
                ...previousUso.cicloAtual,
                alerta80: false,
                alerta100: false,
                bloqueado: false,
                permitirExcedente: true,
                excedenteTokens: 0,
              }
            : null,
        });
      }

      const response = await fetch(`/api/admin/projetos/${projetoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applyPlano: true,
          modoCobranca: "ilimitado",
          planoId: null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; plan?: ProjetoPlanPayload } | null;

      if (!response.ok) {
        if (previousUso) {
          applyUsoUpdate(previousUso);
        }
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Nao foi possivel atualizar o projeto para ilimitado.",
        });
        setUpdatingProjetoId(null);
        return;
      }

      if (previousUso && payload?.plan) {
        applyUsoUpdate(applyReturnedPlanToUsage(previousUso, payload.plan, "ilimitado"));
      }

      setUpdatingProjetoId(null);
      setFeedback({ tone: "success", message: "Projeto definido como ilimitado." });
      return;
    }

    const plano = planos.find((item) => item.id === planoId);
    if (!plano) {
      setFeedback({ tone: "error", message: "Plano nao encontrado." });
      setUpdatingProjetoId(null);
      return;
    }

    if (previousUso) {
      applyUsoUpdate({
        ...previousUso,
        modoCobranca: "plano",
        plano: {
          ...previousUso.plano,
          planoId: plano.id,
          nomePlano: plano.nome,
          limiteTokensTotalMensal: plano.limiteTokensTotalMensal,
          limiteCustoMensal: plano.limiteCustoMensal,
          permitirExcedente: plano.permitirExcedente,
          bloqueado: false,
        },
        percentualUso: calculatePercentualUso(previousUso.consumoAtual.totalTokens, plano.limiteTokensTotalMensal),
        status: "ativo",
        cicloAtual: previousUso.cicloAtual
          ? {
              ...previousUso.cicloAtual,
              alerta80: false,
              alerta100: false,
              bloqueado: false,
              permitirExcedente: plano.permitirExcedente,
              excedenteTokens: 0,
            }
          : null,
      });
    }

    const response = await fetch(`/api/admin/projetos/${projetoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applyPlano: true,
        modoCobranca: "plano",
        planoId: plano.id,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string; plan?: ProjetoPlanPayload } | null;

    if (!response.ok) {
      if (previousUso) {
        applyUsoUpdate(previousUso);
      }
      setFeedback({
        tone: "error",
        message: payload?.error ?? "Nao foi possivel atualizar o plano do projeto.",
      });
      setUpdatingProjetoId(null);
      return;
    }

    if (previousUso && payload?.plan) {
      applyUsoUpdate(applyReturnedPlanToUsage(previousUso, payload.plan, "plano"));
    }

    setUpdatingProjetoId(null);
    setFeedback({ tone: "success", message: "Plano do projeto atualizado." });
  };

  const projetosOrdenados = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();

    return [...uso]
      .filter((item) => (query ? item.projetoNome.toLowerCase().includes(query) : true))
      .sort((left, right) => left.projetoNome.localeCompare(right.projetoNome, "pt-BR"));
  }, [projectSearch, uso]);

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
      <AdminPageHeader
        eyebrow="Planos e consumo"
        title="Gestao unificada"
        description="Planos, consumo atual e status dos projetos em uma tela so."
      />

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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)] xl:items-start">
        <ProjectUsageList
          rows={projetosOrdenados}
          planos={planos}
          unlimitedPlanId={unlimitedPlanId}
          loading={loadingUso}
          updatingProjetoId={updatingProjetoId}
          searchValue={projectSearch}
          onSearchChange={setProjectSearch}
          onChangePlano={(projetoId, planoId) => void handleProjectPlanChange(projetoId, planoId)}
        />

        <PlansList
          planos={planos}
          loading={loadingPlanos}
          onCreate={openCreatePlanoModal}
          onEdit={openEditPlanoModal}
          onToggleActive={(planoId, ativo) => void handleTogglePlano(planoId, ativo)}
          onDelete={(planoId) => void handleDeletePlano(planoId)}
        />
      </section>

      {planModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-sm">
          <div className="relative max-h-[calc(100vh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:rounded-[32px]">
            <button
              type="button"
              onClick={() => {
                setPlanModalOpen(false);
                setEditingPlanoId(null);
                setPlanoForm(emptyPlanoForm);
              }}
              className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white sm:right-5 sm:top-5"
            >
              <X size={16} />
            </button>

            <div className="border-b border-white/8 px-5 py-5 sm:px-8 sm:py-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Planos</p>
              <h3 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{editingPlanoId ? "Editar plano" : "Novo plano"}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Modal largo para evoluir o CRUD de planos sem criar outra tela.
              </p>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-amber-300/80">
                O plano free so pode existir uma vez por usuario dono.
              </p>
            </div>

            <div className="grid gap-5 px-5 py-5 sm:px-8 sm:py-8 lg:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                <span>Nome</span>
                <input value={planoForm.nome} onChange={(event) => setPlanoForm((current) => ({ ...current, nome: event.target.value }))} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none" />
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                <span>Preco mensal</span>
                <input value={planoForm.precoMensal} onChange={(event) => setPlanoForm((current) => ({ ...current, precoMensal: event.target.value }))} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none" />
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                <span>Limite total de tokens</span>
                <input value={planoForm.limiteTokensTotalMensal} onChange={(event) => setPlanoForm((current) => ({ ...current, limiteTokensTotalMensal: event.target.value }))} placeholder="vazio = ilimitado" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none" />
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                <span>Limite de custo</span>
                <input value={planoForm.limiteCustoMensal} onChange={(event) => setPlanoForm((current) => ({ ...current, limiteCustoMensal: event.target.value }))} placeholder="vazio = sem limite" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none" />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                <input type="checkbox" checked={planoForm.ativo} onChange={(event) => setPlanoForm((current) => ({ ...current, ativo: event.target.checked }))} />
                Plano ativo
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
                <input type="checkbox" checked={planoForm.isFree} onChange={(event) => setPlanoForm((current) => ({ ...current, isFree: event.target.checked }))} />
                Plano free
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/8 px-5 py-5 sm:flex-row sm:items-center sm:justify-end sm:px-8 sm:py-6">
              <button
                type="button"
                onClick={() => {
                  setPlanModalOpen(false);
                  setEditingPlanoId(null);
                  setPlanoForm(emptyPlanoForm);
                }}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void handleSavePlano()}
                disabled={savingPlano}
                className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-sky-50 transition hover:bg-sky-400 disabled:opacity-60"
              >
                {savingPlano ? "Salvando..." : editingPlanoId ? "Salvar plano" : "Criar plano"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
