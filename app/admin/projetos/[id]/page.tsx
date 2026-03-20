"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, CheckCircle2, MessageSquare, Pencil, Plus, Sparkles, TestTube2, Trash2, X } from "lucide-react";

type Projeto = {
  id: string;
  nome: string;
  slug: string | null;
  tipo: string | null;
  descricao: string;
  status: string;
};

type ApiCampo = {
  id?: string;
  nome: string;
  tipo: "string" | "number" | "boolean";
  descricao: string;
};

type ApiParametro = {
  nome: string;
  tipo: "string" | "number" | "boolean";
  obrigatorio: boolean;
};

type Api = {
  id: string;
  projetoId: string | null;
  nome: string;
  url: string;
  metodo: "GET";
  descricao: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  campos: ApiCampo[];
  parametros: ApiParametro[];
};

type Agente = {
  id: string;
  slug: string | null;
  nome: string;
  descricao: string;
  promptBase: string;
  configuracoes: Record<string, unknown> | null;
  ativo: boolean;
  createdAt: string;
  projetoId: string | null;
  apiIds: string[];
};

type Chat = {
  id: string;
  titulo: string;
  updatedAt: string;
  totalTokens: number;
  contexto: Record<string, unknown> | null;
};

type ProjetoDetalhe = {
  projeto: Projeto;
  agentes: Agente[];
  apis: Api[];
  chats: Chat[];
  stats: {
    totalAgentes: number;
    agenteAtivoId: string | null;
    totalApis: number;
    totalChats: number;
  };
};

function summarizeApiFields(campos: ApiCampo[], limit = 6) {
  const labels = campos.slice(0, limit).map((campo) => campo.nome);
  if (campos.length <= limit) {
    return labels.join(", ");
  }

  return `${labels.join(", ")} +${campos.length - limit}`;
}

function mergeDetectedApiCampos(campos: ApiCampo[], parametros: ApiParametro[]) {
  const map = new Map<string, ApiCampo>();

  for (const campo of campos) {
    map.set(campo.nome, campo);
  }

  for (const parametro of parametros) {
    if (!map.has(parametro.nome)) {
      map.set(parametro.nome, {
        nome: parametro.nome,
        tipo: parametro.tipo,
        descricao: "",
      });
    }
  }

  return Array.from(map.values()).sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));
}

type AgenteFormState = {
  id?: string;
  projetoId: string;
  slug: string;
  nome: string;
  descricao: string;
  promptBase: string;
  configuracoes: string;
  ativo: boolean;
  apiIds: string[];
};

type ApiFormState = {
  id?: string;
  nome: string;
  url: string;
  metodo: "GET";
  descricao: string;
  ativo: boolean;
  campos: ApiCampo[];
  parametros: ApiParametro[];
};

type ApiCampoTreeNode = {
  key: string;
  label: string;
  fullPath: string | null;
  tipo: ApiCampo["tipo"] | null;
  children: ApiCampoTreeNode[];
};

type ApiCampoTreeDraftNode = {
  key: string;
  label: string;
  fullPath: string | null;
  tipo: ApiCampo["tipo"] | null;
  children: Map<string, ApiCampoTreeDraftNode>;
};

const defaultConfiguracoes = {
  objetivo: "Qualificar leads e operar o atendimento do projeto com contexto de negocio.",
  capacidades: [],
  perguntas_qualificacao: [],
  handoff: {
    enviar_para_humano_se: [],
  },
};

const emptyAgenteForm: AgenteFormState = {
  projetoId: "",
  slug: "",
  nome: "",
  descricao: "",
  promptBase: "",
  configuracoes: JSON.stringify(defaultConfiguracoes, null, 2),
  ativo: true,
  apiIds: [],
};

const emptyApiForm: ApiFormState = {
  nome: "",
  url: "",
  metodo: "GET",
  descricao: "",
  ativo: true,
  campos: [],
  parametros: [],
};

function buildApiCampoTree(campos: ApiCampo[]): ApiCampoTreeNode[] {
  const root = new Map<string, ApiCampoTreeDraftNode>();

  for (const campo of campos) {
    const segments = campo.nome.split(".").filter(Boolean);
    let currentLevel = root;
    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}.${segment}` : segment;
      let node = currentLevel.get(segment);

      if (!node) {
        node = {
          key: currentPath,
          label: segment,
          fullPath: null,
          tipo: null,
          children: new Map<string, ApiCampoTreeDraftNode>(),
        };
        currentLevel.set(segment, node);
      }

      if (index === segments.length - 1) {
        node.fullPath = campo.nome;
        node.tipo = campo.tipo;
      }

      currentLevel = node.children;
    });
  }

  const normalize = (level: Map<string, ApiCampoTreeDraftNode>): ApiCampoTreeNode[] =>
    Array.from(level.values())
      .map((node) => ({
        key: node.key,
        label: node.label,
        fullPath: node.fullPath,
        tipo: node.tipo,
        children: normalize(node.children),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

  return normalize(root);
}

function ApiCampoTree({
  nodes,
  selectedNames,
  parameterNames,
  requiredNames,
  onToggleCampo,
  onToggleParametro,
  onToggleObrigatorio,
  depth = 0,
}: {
  nodes: ApiCampoTreeNode[];
  selectedNames: Set<string>;
  parameterNames: Set<string>;
  requiredNames: Set<string>;
  onToggleCampo: (campo: ApiCampo) => void;
  onToggleParametro: (campo: ApiCampo) => void;
  onToggleObrigatorio: (campo: ApiCampo) => void;
  depth?: number;
}) {
  return (
    <div className={depth === 0 ? "space-y-0.5" : "space-y-0.5"}>
      {nodes.map((node) => {
        const isLeaf = Boolean(node.fullPath && node.tipo);
        const isChecked = node.fullPath ? selectedNames.has(node.fullPath) : false;
        const isParameter = node.fullPath ? parameterNames.has(node.fullPath) : false;
        const isRequired = node.fullPath ? requiredNames.has(node.fullPath) : false;

        return (
          <div key={node.key}>
            <div
              className="grid grid-cols-[minmax(0,1fr)_110px_150px_110px] items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-slate-300"
              style={{ paddingLeft: `${depth * 12 + 6}px` }}
            >
              <div className="flex min-w-0 items-center gap-2">
                {isLeaf ? (
                  <span className="inline-block h-3.5 w-3.5 rounded-sm border border-cyan-500/20 bg-cyan-500/10" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-sm border border-white/10 bg-white/[0.03]" />
                )}
                <span className={isLeaf ? "truncate font-medium text-white" : "truncate font-medium text-slate-300"}>{node.label}</span>
                {isLeaf ? <span className="rounded bg-slate-800/80 px-1.5 py-0 text-[10px] uppercase tracking-[0.14em] text-cyan-200">{node.tipo}</span> : null}
              </div>
              {isLeaf ? (
                <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleCampo({ nome: node.fullPath!, tipo: node.tipo!, descricao: "" })}
                    className="h-3.5 w-3.5"
                  />
                  usar na IA
                </label>
              ) : (
                <span />
              )}
              {isLeaf ? (
                <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={isParameter}
                    onChange={() => onToggleParametro({ nome: node.fullPath!, tipo: node.tipo!, descricao: "" })}
                    className="h-3.5 w-3.5"
                  />
                  usar como parametro
                </label>
              ) : (
                <span />
              )}
              {isLeaf ? (
                <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    disabled={!isParameter}
                    onChange={() => onToggleObrigatorio({ nome: node.fullPath!, tipo: node.tipo!, descricao: "" })}
                    className="h-3.5 w-3.5"
                  />
                  obrigatorio
                </label>
              ) : (
                <span />
              )}
            </div>
            {node.children.length ? (
              <ApiCampoTree
                nodes={node.children}
                selectedNames={selectedNames}
                parameterNames={parameterNames}
                requiredNames={requiredNames}
                onToggleCampo={onToggleCampo}
                onToggleParametro={onToggleParametro}
                onToggleObrigatorio={onToggleObrigatorio}
                depth={depth + 1}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function AgenteModal({
  open,
  form,
  apis,
  saving,
  feedback,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean;
  form: AgenteFormState;
  apis: Api[];
  saving: boolean;
  feedback: string | null;
  onClose: () => void;
  onChange: (next: Partial<AgenteFormState>) => void;
  onSubmit: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Agente</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{form.id ? "Editar agente" : "Novo agente"}</h2>
            <p className="mt-1 text-sm text-slate-400">Defina o agente e selecione quais APIs deste projeto ele pode usar.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid max-h-[calc(92vh-88px)] gap-0 overflow-y-auto lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4 p-6">
            <input value={form.slug} onChange={(event) => onChange({ slug: event.target.value })} placeholder="Slug do agente" className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500" />
            <input value={form.nome} onChange={(event) => onChange({ nome: event.target.value })} placeholder="Nome do agente" className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500" />
            <input value={form.descricao} onChange={(event) => onChange({ descricao: event.target.value })} placeholder="Descricao curta do agente" className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500" />
            <textarea value={form.promptBase} onChange={(event) => onChange({ promptBase: event.target.value })} placeholder="Prompt base do agente" rows={8} className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white outline-none placeholder:text-slate-500" />
            <textarea value={form.configuracoes} onChange={(event) => onChange({ configuracoes: event.target.value })} rows={12} className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4 font-mono text-xs leading-relaxed text-cyan-100 outline-none placeholder:text-slate-500" />
          </div>

          <div className="border-t border-white/10 bg-white/[0.03] p-6 lg:border-l lg:border-t-0">
            <div className="mb-5 rounded-2xl border border-cyan-500/15 bg-cyan-500/10 p-5">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950/20 text-cyan-100">
                <Bot size={22} />
              </div>
              <p className="text-lg font-bold text-white">{form.nome || "Agente sem nome"}</p>
              <p className="mt-2 text-sm leading-relaxed text-cyan-50">{form.descricao || "Defina o papel comercial e o comportamento desse agente para o projeto selecionado."}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-sm font-semibold text-white">APIs disponiveis para este agente</p>
              <div className="mt-3 space-y-2">
                {apis.length ? (
                  apis.map((api) => (
                    <label key={api.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                      <input type="checkbox" checked={form.apiIds.includes(api.id)} onChange={(event) => onChange({ apiIds: event.target.checked ? [...form.apiIds, api.id] : form.apiIds.filter((item) => item !== api.id) })} />
                      <span className="font-semibold text-white">{api.nome}</span>
                      <span className="text-slate-500">{api.metodo}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Cadastre uma API neste projeto para vincular ao agente.</p>
                )}
              </div>
            </div>

            <label className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <input type="checkbox" checked={form.ativo} onChange={(event) => onChange({ ativo: event.target.checked })} />
              Agente ativo para este projeto
            </label>

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={onSubmit} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white">
                {form.id ? <Pencil size={16} /> : <Plus size={16} />}
                {saving ? "Salvando..." : form.id ? "Atualizar agente" : "Criar agente"}
              </button>
              <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white">
                Cancelar
              </button>
            </div>

            {feedback ? <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiModal({
  open,
  form,
  detectedApiCampos,
  saving,
  testing,
  feedback,
  onClose,
  onChange,
  onToggleCampo,
  onToggleParametro,
  onToggleObrigatorio,
  onSubmit,
  onTest,
}: {
  open: boolean;
  form: ApiFormState;
  detectedApiCampos: ApiCampo[];
  saving: boolean;
  testing: boolean;
  feedback: string | null;
  onClose: () => void;
  onChange: (next: Partial<ApiFormState>) => void;
  onToggleCampo: (campo: ApiCampo) => void;
  onToggleParametro: (campo: ApiCampo) => void;
  onToggleObrigatorio: (campo: ApiCampo) => void;
  onSubmit: () => void;
  onTest: () => void;
}) {
  if (!open) {
    return null;
  }

  const campoTree = buildApiCampoTree(detectedApiCampos);
  const selectedCampoNames = new Set(form.campos.map((campo) => campo.nome));
  const parameterNames = new Set(form.parametros.map((parametro) => parametro.nome));
  const requiredNames = new Set(form.parametros.filter((parametro) => parametro.obrigatorio).map((parametro) => parametro.nome));

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">API</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{form.id ? "Editar API" : "Nova API"}</h2>
            <p className="mt-1 text-sm text-slate-400">Cadastre uma API GET, teste a resposta e escolha os campos ativos, inclusive os aninhados.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex max-h-[calc(92vh-88px)] flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4 pb-6">
            <input value={form.nome} onChange={(event) => onChange({ nome: event.target.value })} placeholder="Nome da API" className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500" />
            <input value={form.url} onChange={(event) => onChange({ url: event.target.value })} placeholder="https://api.exemplo.com/recurso" className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500" />
            <input value={form.metodo} readOnly className="w-full rounded-xl border border-white/10 bg-slate-950/30 px-4 py-3 text-white outline-none" />
            <textarea value={form.descricao} onChange={(event) => onChange({ descricao: event.target.value })} placeholder="Descricao da API" rows={5} className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white outline-none placeholder:text-slate-500" />
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <input type="checkbox" checked={form.ativo} onChange={(event) => onChange({ ativo: event.target.checked })} />
              API ativa no projeto
            </label>

            <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">Campos detectados</p>
                <button type="button" onClick={onTest} disabled={testing || saving} className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                  <TestTube2 size={15} />
                  {testing ? "Testando..." : "Testar API"}
                </button>
              </div>

              <div className="mt-3 max-h-[44vh] overflow-y-auto rounded-lg border border-white/8 bg-white/[0.02] p-2">
                {campoTree.length ? (
                  <ApiCampoTree
                    nodes={campoTree}
                    selectedNames={selectedCampoNames}
                    parameterNames={parameterNames}
                    requiredNames={requiredNames}
                    onToggleCampo={onToggleCampo}
                    onToggleParametro={onToggleParametro}
                    onToggleObrigatorio={onToggleObrigatorio}
                  />
                ) : (
                  <p className="text-sm text-slate-400">Teste a API para detectar automaticamente campos simples e aninhados.</p>
                )}
              </div>
            </div>
            {form.parametros.length ? (
              <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                <p className="text-sm font-semibold text-white">Parametros configurados</p>
                <div className="mt-3 space-y-2">
                  {form.parametros.map((parametro) => (
                    <div key={parametro.nome} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                      <span>
                        {parametro.nome} ({parametro.tipo})
                      </span>
                      <span className={parametro.obrigatorio ? "text-amber-200" : "text-slate-500"}>
                        {parametro.obrigatorio ? "obrigatorio" : "opcional"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            </div>
          </div>

          <div className="border-t border-white/10 bg-brand-dark/95 px-6 py-4 backdrop-blur">
            <div className="flex gap-3">
              <button type="button" onClick={onSubmit} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white">
                {form.id ? <Pencil size={16} /> : <Plus size={16} />}
                {saving ? "Salvando..." : form.id ? "Atualizar API" : "Criar API"}
              </button>
              <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white">
                Cancelar
              </button>
            </div>

            {feedback ? <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminProjetoDetalhePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ProjetoDetalhe | null>(null);
  const [agenteForm, setAgenteForm] = useState<AgenteFormState>(emptyAgenteForm);
  const [apiForm, setApiForm] = useState<ApiFormState>(emptyApiForm);
  const [detectedApiCampos, setDetectedApiCampos] = useState<ApiCampo[]>([]);
  const [savingAgente, setSavingAgente] = useState(false);
  const [savingApi, setSavingApi] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [feedbackAgente, setFeedbackAgente] = useState<string | null>(null);
  const [feedbackApi, setFeedbackApi] = useState<string | null>(null);
  const [agenteModalOpen, setAgenteModalOpen] = useState(false);
  const [apiModalOpen, setApiModalOpen] = useState(false);

  const loadProjeto = async () => {
    const response = await fetch(`/api/admin/projetos/${params.id}`, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as ProjetoDetalhe;
    setData(payload);
    setAgenteForm((prev) => ({
      ...prev,
      projetoId: payload.projeto.id,
    }));
  };

  useEffect(() => {
    void loadProjeto();
  }, [params.id]);

  const resetAgenteForm = () => {
    setAgenteForm({
      ...emptyAgenteForm,
      projetoId: params.id,
    });
    setFeedbackAgente(null);
  };

  const resetApiForm = () => {
    setApiForm(emptyApiForm);
    setDetectedApiCampos([]);
    setFeedbackApi(null);
  };

  const openNewAgenteModal = () => {
    resetAgenteForm();
    setAgenteModalOpen(true);
  };

  const openNewApiModal = () => {
    resetApiForm();
    setApiModalOpen(true);
  };

  const handleAgenteSubmit = async () => {
    setSavingAgente(true);
    setFeedbackAgente(null);

    try {
      JSON.parse(agenteForm.configuracoes);
    } catch {
      setFeedbackAgente("O JSON de configuracoes esta invalido.");
      setSavingAgente(false);
      return;
    }

    const method = agenteForm.id ? "PUT" : "POST";
    const response = await fetch("/api/admin/agentes", {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(agenteForm),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedbackAgente(payload.error ?? "Nao foi possivel salvar o agente.");
      setSavingAgente(false);
      return;
    }

    await loadProjeto();
    const message = agenteForm.id ? "Agente atualizado com sucesso." : "Agente criado com sucesso.";
    resetAgenteForm();
    setSavingAgente(false);
    setAgenteModalOpen(false);
    setFeedbackAgente(message);
  };

  const handleEditAgente = (agente: Agente) => {
    setAgenteForm({
      id: agente.id,
      projetoId: agente.projetoId ?? params.id,
      slug: agente.slug ?? "",
      nome: agente.nome,
      descricao: agente.descricao,
      promptBase: agente.promptBase,
      configuracoes: JSON.stringify(agente.configuracoes ?? defaultConfiguracoes, null, 2),
      ativo: agente.ativo,
      apiIds: agente.apiIds ?? [],
    });
    setFeedbackAgente(null);
    setAgenteModalOpen(true);
  };

  const handleApiSubmit = async () => {
    setSavingApi(true);
    setFeedbackApi(null);

    const endpoint = apiForm.id ? `/api/apis/${apiForm.id}` : `/api/projetos/${params.id}/apis`;
    const method = apiForm.id ? "PUT" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(apiForm),
    });

    const payload = (await response.json()) as { error?: string; api?: Api };

    if (!response.ok) {
      setFeedbackApi(payload.error ?? "Nao foi possivel salvar a API.");
      setSavingApi(false);
      return;
    }

    await loadProjeto();
    const message = apiForm.id ? "API atualizada com sucesso." : "API criada com sucesso.";
    if (payload.api) {
      setDetectedApiCampos(
        mergeDetectedApiCampos(
          payload.api.campos.map((campo) => ({
            id: campo.id,
            nome: campo.nome,
            tipo: campo.tipo,
            descricao: campo.descricao,
          })),
          payload.api.parametros.map((parametro) => ({
            nome: parametro.nome,
            tipo: parametro.tipo,
            obrigatorio: parametro.obrigatorio,
          })),
        ),
      );
      setApiForm({
        id: payload.api.id,
        nome: payload.api.nome,
        url: payload.api.url,
        metodo: "GET",
        descricao: payload.api.descricao,
        ativo: payload.api.ativo,
        campos: payload.api.campos.map((campo) => ({
          id: campo.id,
          nome: campo.nome,
          tipo: campo.tipo,
          descricao: campo.descricao,
        })),
        parametros: payload.api.parametros.map((parametro) => ({
          nome: parametro.nome,
          tipo: parametro.tipo,
          obrigatorio: parametro.obrigatorio,
        })),
      });
    } else {
      resetApiForm();
    }
    setSavingApi(false);
    setApiModalOpen(false);
    setFeedbackApi(message);
  };

  const persistApiBeforeTest = async () => {
    const endpoint = apiForm.id ? `/api/apis/${apiForm.id}` : `/api/projetos/${params.id}/apis`;
    const method = apiForm.id ? "PUT" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiForm),
    });

    const payload = (await response.json()) as { error?: string; api?: Api };
    if (!response.ok || !payload.api) {
      throw new Error(payload.error ?? "Nao foi possivel salvar a API antes do teste.");
    }

    return payload.api;
  };

  const handleTestApi = async () => {
    setTestingApi(true);
    setFeedbackApi(null);

    try {
      const api = await persistApiBeforeTest();
      const response = await fetch(`/api/apis/${api.id}/testar`, {
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string; api?: Api };

      if (!response.ok || !payload.api) {
        setFeedbackApi(payload.error ?? "Nao foi possivel testar a API.");
        setTestingApi(false);
        return;
      }

      setDetectedApiCampos(
        mergeDetectedApiCampos(
          payload.api.campos.map((campo) => ({
            id: campo.id,
            nome: campo.nome,
            tipo: campo.tipo,
            descricao: campo.descricao,
          })),
          payload.api.parametros.map((parametro) => ({
            nome: parametro.nome,
            tipo: parametro.tipo,
            obrigatorio: parametro.obrigatorio,
          })),
        ),
      );
      setApiForm({
        id: payload.api.id,
        nome: payload.api.nome,
        url: payload.api.url,
        metodo: "GET",
        descricao: payload.api.descricao,
        ativo: payload.api.ativo,
        campos: payload.api.campos.map((campo) => ({
          id: campo.id,
          nome: campo.nome,
          tipo: campo.tipo,
          descricao: campo.descricao,
        })),
        parametros: payload.api.parametros.map((parametro) => ({
          nome: parametro.nome,
          tipo: parametro.tipo,
          obrigatorio: parametro.obrigatorio,
        })),
      });
      await loadProjeto();
      setFeedbackApi("API testada e campos detectados com sucesso.");
    } catch (error) {
      setFeedbackApi(error instanceof Error ? error.message : "Nao foi possivel testar a API.");
    } finally {
      setTestingApi(false);
    }
  };

  const handleEditApi = (api: Api) => {
    setDetectedApiCampos(
      mergeDetectedApiCampos(
        api.campos.map((campo) => ({
          id: campo.id,
          nome: campo.nome,
          tipo: campo.tipo,
          descricao: campo.descricao,
        })),
        api.parametros.map((parametro) => ({
          nome: parametro.nome,
          tipo: parametro.tipo,
          obrigatorio: parametro.obrigatorio,
        })),
      ),
    );
    setApiForm({
      id: api.id,
      nome: api.nome,
      url: api.url,
      metodo: "GET",
      descricao: api.descricao,
      ativo: api.ativo,
      campos: api.campos.map((campo) => ({
        id: campo.id,
        nome: campo.nome,
        tipo: campo.tipo,
        descricao: campo.descricao,
      })),
      parametros: api.parametros.map((parametro) => ({
        nome: parametro.nome,
        tipo: parametro.tipo,
        obrigatorio: parametro.obrigatorio,
      })),
    });
    setFeedbackApi(null);
    setApiModalOpen(true);
  };

  const handleDeleteApi = async (api: Api) => {
    const confirmed = window.confirm(`Tem certeza que deseja excluir a API "${api.nome}"?`);
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/apis/${api.id}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedbackApi(payload.error ?? "Nao foi possivel excluir a API.");
      return;
    }

    await loadProjeto();
    if (apiForm.id === api.id) {
      resetApiForm();
    }
    setFeedbackApi(`API "${api.nome}" excluida com sucesso.`);
  };

  const toggleApiCampo = (campo: ApiCampo) => {
    setApiForm((prev) => {
      const exists = prev.campos.some((item) => item.nome === campo.nome);
      return {
        ...prev,
        campos: exists ? prev.campos.filter((item) => item.nome !== campo.nome) : [...prev.campos, campo],
      };
    });
  };

  const toggleApiParametro = (campo: ApiCampo) => {
    setApiForm((prev) => {
      const exists = prev.parametros.some((item) => item.nome === campo.nome);
      return {
        ...prev,
        parametros: exists
          ? prev.parametros.filter((item) => item.nome !== campo.nome)
          : [
              ...prev.parametros,
              {
                nome: campo.nome,
                tipo: campo.tipo,
                obrigatorio: false,
              },
            ],
      };
    });
  };

  const toggleApiParametroObrigatorio = (campo: ApiCampo) => {
    setApiForm((prev) => {
      if (!prev.parametros.some((item) => item.nome === campo.nome)) {
        return prev;
      }

      return {
        ...prev,
        parametros: prev.parametros.map((item) =>
          item.nome === campo.nome
            ? {
                ...item,
                obrigatorio: !item.obrigatorio,
              }
            : item,
        ),
      };
    });
  };

  if (!data) {
    return (
      <main className="space-y-6">
        <section className="px-1 py-2">
          <h1 className="text-3xl font-extrabold text-white">Carregando projeto...</h1>
        </section>
      </main>
    );
  }

  const agenteAtivo = data.agentes.find((agente) => agente.ativo) ?? null;

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
          <Sparkles size={14} />
          Projeto
        </div>
        <h1 className="text-4xl font-extrabold text-white">{data.projeto.nome}</h1>
        <p className="mt-3 max-w-3xl text-slate-400">{data.projeto.descricao || "Sem descricao cadastrada."}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href="#agentes" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
            Agentes
          </a>
          <a href="#apis" className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100">
            APIs
          </a>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Slug</p>
            <p className="mt-2 text-lg font-bold text-white">{data.projeto.slug ?? "sem-slug"}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Agentes</p>
            <p className="mt-2 text-lg font-bold text-white">{data.stats.totalAgentes}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">APIs</p>
            <p className="mt-2 text-lg font-bold text-white">{data.stats.totalApis}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Chats</p>
            <p className="mt-2 text-lg font-bold text-white">{data.stats.totalChats}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Agente ativo</p>
            <p className="mt-2 text-lg font-bold text-white">{agenteAtivo?.nome ?? "Nenhum ativo"}</p>
          </div>
        </div>
      </section>

      {(feedbackAgente || feedbackApi) && (
        <section className="grid gap-3">
          {feedbackAgente ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackAgente}</div> : null}
          {feedbackApi ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackApi}</div> : null}
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section id="agentes" className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">Agentes do projeto</h3>
              <p className="mt-1 text-sm text-slate-400">O agente ativo atende este projeto e pode consumir as APIs marcadas.</p>
            </div>
            <button type="button" onClick={openNewAgenteModal} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white">
              <Plus size={16} />
              Novo agente
            </button>
          </div>
          <div className="space-y-3 p-4">
            {data.agentes.length ? (
              data.agentes.map((agente) => (
                <div key={agente.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="text-base font-bold text-white">{agente.nome}</h4>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${agente.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                          {agente.ativo ? "ativo" : "inativo"}
                        </span>
                        {agente.ativo ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200">
                            <CheckCircle2 size={12} />
                            em uso
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">{agente.descricao || "Sem descricao."}</p>
                      <p className="mt-3 text-xs text-cyan-200/80">
                        APIs vinculadas: {agente.apiIds.length ? agente.apiIds.map((apiId) => data.apis.find((api) => api.id === apiId)?.nome ?? "API").join(", ") : "nenhuma"}
                      </p>
                    </div>
                    <button type="button" onClick={() => handleEditAgente(agente)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200">
                      Editar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">Nenhum agente cadastrado para este projeto ainda.</div>
            )}
          </div>
        </section>

        <section id="apis" className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">APIs do projeto</h3>
              <p className="mt-1 text-sm text-slate-400">Gerencie as APIs externas, teste o retorno e controle os campos ativos.</p>
            </div>
            <button type="button" onClick={openNewApiModal} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white">
              <Plus size={16} />
              Nova API
            </button>
          </div>
          <div className="space-y-3 p-4">
            {data.apis.length ? (
              data.apis.map((api) => (
                <div key={api.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="text-base font-bold text-white">{api.nome}</h4>
                        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">{api.metodo}</span>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${api.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                          {api.ativo ? "ativa" : "inativa"}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm text-slate-400">{api.url}</p>
                      <p className="mt-2 line-clamp-1 text-sm leading-relaxed text-slate-400">{api.descricao || "Sem descricao."}</p>
                      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                        <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                          <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">Campos</span>
                          <span className="mt-1 block font-semibold text-white">{api.campos.length}</span>
                        </div>
                        <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                          <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">Parametros</span>
                          <span className="mt-1 block font-semibold text-white">{api.parametros.length}</span>
                        </div>
                        <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 sm:col-span-2">
                          <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">Resumo</span>
                          <span className="mt-1 block text-cyan-200/80">
                            {api.campos.length ? summarizeApiFields(api.campos) : "Nenhum campo detectado"}
                          </span>
                        </div>
                      </div>
                      {api.parametros.length ? (
                        <p className="mt-2 text-xs text-amber-200/80">
                          Parametros: {api.parametros.map((parametro) => `${parametro.nome}${parametro.obrigatorio ? "*" : ""}`).join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleEditApi(api)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200">
                        Editar
                      </button>
                      <button type="button" onClick={() => void handleDeleteApi(api)} className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100">
                        <Trash2 size={14} />
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">Nenhuma API cadastrada para este projeto ainda.</div>
            )}
          </div>
        </section>

      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-6 py-5">
            <h3 className="text-xl font-bold text-white">Chats recentes</h3>
            <p className="mt-1 text-sm text-slate-400">Visao rapida das conversas ligadas a este projeto.</p>
          </div>
          <div className="space-y-4 p-6">
            {data.chats.length ? (
              data.chats.slice(0, 8).map((chat) => (
                <div key={chat.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="flex items-center gap-2 text-cyan-200">
                    <MessageSquare size={14} />
                    <p className="font-semibold text-white">{chat.titulo}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{new Date(chat.updatedAt).toLocaleString("pt-BR")}</p>
                  <p className="mt-2 text-xs text-slate-400">Lead: {String((chat.contexto?.lead as { nome?: string } | undefined)?.nome ?? "Nao identificado")}</p>
                  <p className="mt-1 text-xs text-cyan-200/80">Tokens: {chat.totalTokens}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">Nenhum chat registrado para este projeto ainda.</div>
            )}
          </div>
        </section>

        <Link href="/admin/projetos" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10">
          Voltar para projetos
        </Link>

      <AgenteModal
        open={agenteModalOpen}
        form={agenteForm}
        apis={data.apis}
        saving={savingAgente}
        feedback={feedbackAgente}
        onClose={() => {
          setAgenteModalOpen(false);
          resetAgenteForm();
        }}
        onChange={(next) => setAgenteForm((prev) => ({ ...prev, ...next }))}
        onSubmit={() => void handleAgenteSubmit()}
      />

      <ApiModal
        open={apiModalOpen}
        form={apiForm}
        detectedApiCampos={detectedApiCampos}
        saving={savingApi}
        testing={testingApi}
        feedback={feedbackApi}
        onClose={() => {
          setApiModalOpen(false);
          resetApiForm();
        }}
        onChange={(next) => setApiForm((prev) => ({ ...prev, ...next }))}
        onToggleCampo={toggleApiCampo}
        onToggleParametro={toggleApiParametro}
        onToggleObrigatorio={toggleApiParametroObrigatorio}
        onSubmit={() => void handleApiSubmit()}
        onTest={() => void handleTestApi()}
      />
    </main>
  );
}
