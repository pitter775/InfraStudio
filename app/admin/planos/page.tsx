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

type PlanoFormState = {
  nome: string;
  precoMensal: string;
  limiteTokensTotalMensal: string;
  limiteCustoMensal: string;
  maxAgentes: string;
  maxApis: string;
  maxWhatsapp: string;
  ativo: boolean;
};

const emptyPlanoForm: PlanoFormState = {
  nome: "",
  precoMensal: "0",
  limiteTokensTotalMensal: "",
  limiteCustoMensal: "",
  maxAgentes: "0",
  maxApis: "0",
  maxWhatsapp: "0",
  ativo: true,
};

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
      maxAgentes: String(plano.maxAgentes),
      maxApis: String(plano.maxApis),
      maxWhatsapp: String(plano.maxWhatsapp),
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
      maxAgentes: planoForm.maxAgentes,
      maxApis: planoForm.maxApis,
      maxWhatsapp: planoForm.maxWhatsapp,
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

    if (planoId === unlimitedPlanId) {
      const response = await fetch(`/api/admin/projetos/${projetoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modoCobranca: "ilimitado",
          nomePlano: "Ilimitado",
          limiteTokensTotalMensal: null,
          limiteCustoMensal: null,
          permitirExcedente: true,
          custoTokenExcedente: 0,
          autoBloquear: false,
          bloqueado: false,
          bloqueadoMotivo: null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Nao foi possivel atualizar o projeto para ilimitado.",
        });
        setUpdatingProjetoId(null);
        return;
      }

      await load();
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

    const response = await fetch(`/api/admin/projetos/${projetoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modoCobranca: "plano",
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl rounded-[32px] border border-white/10 bg-slate-950 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                setPlanModalOpen(false);
                setEditingPlanoId(null);
                setPlanoForm(emptyPlanoForm);
              }}
              className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>

            <div className="border-b border-white/8 px-8 py-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Planos</p>
              <h3 className="mt-3 text-3xl font-extrabold text-white">{editingPlanoId ? "Editar plano" : "Novo plano"}</h3>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">Modal largo para evoluir o CRUD de planos sem criar outra tela.</p>
            </div>

            <div className="grid gap-6 px-8 py-8 lg:grid-cols-2">
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

              <label className="grid gap-2 text-sm text-slate-300">
                <span>Maximo de agentes</span>
                <input value={planoForm.maxAgentes} onChange={(event) => setPlanoForm((current) => ({ ...current, maxAgentes: event.target.value }))} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none" />
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                <span>Maximo de APIs</span>
                <input value={planoForm.maxApis} onChange={(event) => setPlanoForm((current) => ({ ...current, maxApis: event.target.value }))} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none" />
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                <span>Maximo de WhatsApp</span>
                <input value={planoForm.maxWhatsapp} onChange={(event) => setPlanoForm((current) => ({ ...current, maxWhatsapp: event.target.value }))} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none" />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                <input type="checkbox" checked={planoForm.ativo} onChange={(event) => setPlanoForm((current) => ({ ...current, ativo: event.target.checked }))} />
                Plano ativo
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/8 px-8 py-6">
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
