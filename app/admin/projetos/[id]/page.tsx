"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Copy, ExternalLink, FileImage, MessageSquare, Paperclip, Pencil, Plus, Sparkles, TestTube2, Trash2, X } from "lucide-react";

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
  arquivos: AgenteArquivo[];
};

type AgenteArquivo = {
  id: string;
  agenteId: string;
  projetoId: string | null;
  nome: string;
  descricao: string;
  arquivoNome: string;
  mimeType: string;
  tamanhoBytes: number;
  categoria: "image" | "file";
  storagePath: string;
  publicUrl: string;
  createdAt: string;
};

type Chat = {
  id: string;
  titulo: string;
  updatedAt: string;
  totalTokens: number;
  contexto: Record<string, unknown> | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  conteudo: string;
  createdAt: string;
};

type ChatWidget = {
  id?: string;
  nome: string;
  slug: string;
  projetoId: string | null;
  agenteId: string | null;
  dominio: string;
  whatsappCelular: string;
  tema: "dark" | "light";
  corPrimaria: string;
  fundoTransparente: boolean;
  ativo: boolean;
};

type ProjetoDetalhe = {
  projeto: Projeto;
  agentes: Agente[];
  apis: Api[];
  widgets: ChatWidget[];
  chats: Chat[];
  stats: {
    totalAgentes: number;
    agenteAtivoId: string | null;
    totalApis: number;
    totalWidgets: number;
    totalChats: number;
  };
};

type WidgetFormState = ChatWidget & {
  id?: string;
};

type ChatDetailState = {
  chat: Chat;
  messages: ChatMessage[];
};

type PendingAgenteArquivo = {
  id: string;
  file: File;
};

function sanitizePhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;

  return localDigits.slice(0, 11);
}

function formatWhatsAppPhone(value: string) {
  const digits = sanitizePhoneDigits(value);

  if (!digits) {
    return "";
  }

  const area = digits.slice(0, 2);
  const local = digits.slice(2);
  let formatted = "+55";

  if (area) {
    formatted += ` ${area}`;
  }

  if (local) {
    if (local.length <= 4) {
      formatted += ` ${local}`;
    } else if (local.length <= 8) {
      formatted += ` ${local.slice(0, 4)}-${local.slice(4)}`;
    } else {
      formatted += ` ${local.slice(0, 5)}-${local.slice(5, 9)}`;
    }
  }

  return formatted;
}

function summarizeApiFields(campos: ApiCampo[], limit = 6) {
  const labels = campos.slice(0, limit).map((campo) => campo.nome);
  if (campos.length <= limit) {
    return labels.join(", ");
  }

  return `${labels.join(", ")} +${campos.length - limit}`;
}

function formatFileSize(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${value} B`;
}

function normalizeAgentText(value: string) {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSummaryKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDecorativeCharacters(value: string) {
  return value
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u2600-\u27BF]/gu, "")
    .replace(/[✓✔✕✖✳⭐🔥💬📌🎯⚙️❓🔁]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeTechnicalText(value: string) {
  return stripDecorativeCharacters(value)
    .replace(/^[-*]\s*/, "")
    .replace(/^(\d+)[.)]\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeTechnicalValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeTechnicalValue(item))
      .filter((item) => {
        if (typeof item === "string") {
          return item.trim().length > 0;
        }
        return item !== null && item !== undefined;
      }) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, sanitizeTechnicalValue(nested)]),
    ) as T;
  }

  if (typeof value === "string") {
    return sanitizeTechnicalText(value) as T;
  }

  return value;
}

function compactHumanLine(value: string) {
  const cleaned = stripDecorativeCharacters(
    value
    .replace(/\s{2,}/g, " ")
    .replace(/^[-*]\s*/, "- ")
    .replace(/^(\d+)[.)]\s*/, "$1. ")
    .trim(),
  );

  const normalized = normalizeSummaryKey(cleaned);

  if (
    normalized.includes("quando o usuario pedir analise") ||
    normalized.includes("nao apenas liste dados")
  ) {
    return "Analise: conclua, destaque os motivos e diga o que falta quando a base nao bastar.";
  }

  if (normalized.includes("importante") && normalized.includes("nao oferecer") && normalized.includes("whatsapp")) {
    return "Canal: nao oferecer WhatsApp; atendimento exclusivo no site.";
  }

  if (normalized.includes("encaminhar para atendimento humano quando")) {
    return "Handoff humano:";
  }

  return cleaned;
}

function compactAgentSummary(summary: string) {
  const normalized = normalizeAgentText(summary);
  if (!normalized) {
    return "";
  }

  const withoutJsonBlocks = normalized.replace(/\{[\s\S]*\}$/g, "").trim();
  const lines = withoutJsonBlocks.split("\n");
  const compacted: string[] = [];
  const seen = new Set<string>();
  let currentSection = "";

  for (const line of lines) {
    if (!line) {
      if (compacted[compacted.length - 1] !== "") {
        compacted.push("");
      }
      continue;
    }

    const normalizedLine = compactHumanLine(line);

    if (!normalizedLine.startsWith("- ") && /:$/.test(normalizedLine)) {
      const section = normalizedLine
        .replace(/:$/, "")
        .replace(/\s+/g, " ")
        .trim();

      if (section && section !== currentSection) {
        if (compacted[compacted.length - 1] && compacted[compacted.length - 1] !== "") {
          compacted.push("");
        }
        compacted.push(`${section}:`);
        currentSection = section;
      }
      continue;
    }

    const dedupeKey = normalizeSummaryKey(normalizedLine);
    if (dedupeKey && seen.has(dedupeKey)) {
      continue;
    }

    if (dedupeKey) {
      seen.add(dedupeKey);
    }

    compacted.push(normalizedLine);
  }

  return compacted.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function inferShortDescription(summary: string) {
  const firstParagraph = compactAgentSummary(summary).split("\n").find((line) => line && !line.startsWith("- ") && !/^\d+\.\s/.test(line)) ?? "";
  if (!firstParagraph) {
    return "";
  }

  if (firstParagraph.length <= 160) {
    return firstParagraph;
  }

  return `${firstParagraph.slice(0, 157).trimEnd()}...`;
}

function buildAgentConfigFromSummary(summary: string) {
  const normalized = compactAgentSummary(summary);
  const lines = normalized ? normalized.split("\n") : [];
  const intro: string[] = [];
  const capacidades: string[] = [];
  const perguntasQualificacao: string[] = [];
  const regrasPrecificacao: string[] = [];
  const handoff: string[] = [];
  const cta: string[] = [];
  const observacoes: string[] = [];
  let currentSection = "";

  const classifySection = (rawTitle: string) => {
    const title = rawTitle
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (title.includes("preco") || title.includes("valor") || title.includes("orcamento")) {
      return "pricing";
    }
    if (title.includes("qualifica") || title.includes("pergunta") || title.includes("descobrir")) {
      return "qualification";
    }
    if (title.includes("handoff") || title.includes("humano") || title.includes("escal") || title.includes("encaminh")) {
      return "handoff";
    }
    if (title.includes("cta") || title.includes("whatsapp") || title.includes("fechamento")) {
      return "cta";
    }
    if (title.includes("capacidade") || title.includes("servico") || title.includes("solucao") || title.includes("oferta")) {
      return "capabilities";
    }
    return "notes";
  };

  const pushLine = (line: string, preferSection = currentSection) => {
    const cleaned = line.replace(/^-\s*/, "").replace(/^\d+\.\s*/, "").trim();
    if (!cleaned) {
      return;
    }

    if (preferSection === "pricing") {
      regrasPrecificacao.push(cleaned);
      return;
    }
    if (preferSection === "qualification") {
      perguntasQualificacao.push(cleaned);
      return;
    }
    if (preferSection === "handoff") {
      handoff.push(cleaned);
      return;
    }
    if (preferSection === "cta") {
      cta.push(cleaned);
      return;
    }
    if (preferSection === "capabilities") {
      capacidades.push(cleaned);
      return;
    }

    if (!currentSection && intro.length < 2) {
      intro.push(cleaned);
      return;
    }

    observacoes.push(cleaned);
  };

  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (!line.startsWith("- ") && /:$/.test(line)) {
      currentSection = classifySection(line.slice(0, -1));
      continue;
    }

    if (line.startsWith("- ") || /^\d+\.\s/.test(line)) {
      pushLine(line);
      continue;
    }

    pushLine(line, currentSection || "notes");
  }

  const objetivo = intro.join(" ").trim() || "Qualificar leads e conduzir o atendimento com contexto do negocio.";
  const config: Record<string, unknown> = {
    objetivo,
    capacidades: capacidades.slice(0, 8),
    perguntas_qualificacao: perguntasQualificacao.slice(0, 5),
    handoff: {
      enviar_para_humano_se: handoff.slice(0, 5),
    },
  };

  if (regrasPrecificacao.length) {
    config.regras_precificacao = regrasPrecificacao.slice(0, 8);
  }

  if (cta.length) {
    config.cta_whatsapp = cta.join(" ");
  }

  if (observacoes.length) {
    config.observacoes = observacoes.slice(0, 6);
  }

  return sanitizeTechnicalValue(config);
}

function summarizePublicUrl(value: string, max = 72) {
  const url = value.trim();
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    const compact = `${parsed.hostname}${parsed.pathname}`;
    if (compact.length <= max) {
      return compact;
    }

    return `${compact.slice(0, max - 3)}...`;
  } catch {
    return url.length <= max ? url : `${url.slice(0, max - 3)}...`;
  }
}

function JsonHighlight({ value }: { value: string }) {
  const html = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(\"(?:\\.|[^\"\\])*\")(\s*:)?/g, (_match, stringLiteral: string, isKey: string) => {
      if (isKey) {
        return `<span class="text-sky-300">${stringLiteral}</span><span class="text-slate-400">:</span>`;
      }

      return `<span class="text-emerald-300">${stringLiteral}</span>`;
    })
    .replace(/\b(true|false|null)\b/g, '<span class="text-fuchsia-300">$1</span>')
    .replace(/(-?\b\d+(?:\.\d+)?\b)/g, '<span class="text-amber-300">$1</span>');

  return <pre className="overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-100 [scrollbar-width:thin]" dangerouslySetInnerHTML={{ __html: html }} />;
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
  arquivos: AgenteArquivo[];
  arquivoIdsRemovidos: string[];
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

function extractUrlParameterNames(url: string) {
  return [...url.matchAll(/\{([a-zA-Z0-9_.-]+)\}/g)]
    .map((match) => match[1]?.trim() || "")
    .filter(Boolean);
}

function normalizeApiForm(form: ApiFormState): ApiFormState {
  const inferredNames = extractUrlParameterNames(form.url);
  const manualByName = new Map(form.parametros.map((parametro) => [parametro.nome, parametro]));

  for (const nome of inferredNames) {
    const current = manualByName.get(nome);
    manualByName.set(nome, {
      nome,
      tipo: current?.tipo ?? "string",
      obrigatorio: true,
    });
  }

  return {
    ...form,
    parametros: Array.from(manualByName.values()).sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR")),
  };
}

function syncTestParameterValues(url: string, current: Record<string, string>) {
  const nextNames = extractUrlParameterNames(url);
  const nextEntries = nextNames.map((name) => [name, current[name] ?? ""] as const);
  return Object.fromEntries(nextEntries);
}

function buildApiTestContext(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => Boolean(value)),
  );
}

function hasRequiredTestValues(parametros: ApiParametro[], values: Record<string, string>) {
  return parametros
    .filter((parametro) => parametro.obrigatorio)
    .every((parametro) => Boolean(values[parametro.nome]?.trim()));
}

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

type ProjectTab = "agentes" | "apis" | "chats";

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
  arquivos: [],
  arquivoIdsRemovidos: [],
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

const emptyWidgetForm: WidgetFormState = {
  nome: "",
  slug: "",
  projetoId: null,
  agenteId: null,
  dominio: "",
  whatsappCelular: "",
  tema: "dark",
  corPrimaria: "#2563eb",
  fundoTransparente: true,
  ativo: true,
};

function FormLabel({ children }: { children: string }) {
  return <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{children}</label>;
}

function AgenteAssetPreview({
  file,
  categoria,
  publicUrl,
  alt,
}: {
  file?: File;
  categoria: "image" | "file";
  publicUrl?: string;
  alt: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(publicUrl ?? null);

  useEffect(() => {
    if (publicUrl) {
      setPreviewUrl(publicUrl);
      return;
    }

    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, publicUrl]);

  if (categoria === "image" && previewUrl) {
    return <img src={previewUrl} alt={alt} className="h-12 w-12 shrink-0 rounded-2xl object-cover" />;
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-cyan-100">
      {categoria === "image" ? <FileImage size={18} /> : <Paperclip size={18} />}
    </div>
  );
}

function renderSnippetLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return <span className="text-slate-500"> </span>;
  }

  if (trimmed.startsWith("<!--") || trimmed.startsWith("//")) {
    return <span className="text-slate-400">{line}</span>;
  }

  if (trimmed.startsWith("<script") || trimmed.startsWith("></script>") || trimmed.startsWith("</script>")) {
    return <span className="text-fuchsia-300">{line}</span>;
  }

  const parts = line.split(/(data-[\w-]+|src|InfraChat\.(?:mount|updateContext|destroy|hide|setContext))/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part === "src" || part.startsWith("data-") || part.startsWith("InfraChat.")) {
          return (
            <span key={`${part}-${index}`} className="text-cyan-300">
              {part}
            </span>
          );
        }

        if (part.includes("=") || part.includes('"') || part.includes("'")) {
          return (
            <span key={`${part}-${index}`} className="text-emerald-300">
              {part}
            </span>
          );
        }

        if (part.includes(":")) {
          return (
            <span key={`${part}-${index}`} className="text-violet-200">
              {part}
            </span>
          );
        }

        return (
          <span key={`${part}-${index}`} className="text-slate-200">
            {part}
          </span>
        );
      })}
    </>
  );
}

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
  pendingArquivos,
  saving,
  feedback,
  onClose,
  onChange,
  onAddFiles,
  onRemovePendingFile,
  onRemoveUploadedFile,
  onValidateSummary,
  onSubmit,
}: {
  open: boolean;
  form: AgenteFormState;
  apis: Api[];
  pendingArquivos: PendingAgenteArquivo[];
  saving: boolean;
  feedback: string | null;
  onClose: () => void;
  onChange: (next: Partial<AgenteFormState>) => void;
  onAddFiles: (files: FileList | null) => void;
  onRemovePendingFile: (id: string) => void;
  onRemoveUploadedFile: (id: string) => void;
  onValidateSummary: () => void;
  onSubmit: () => void;
}) {
  const [showRawConfig, setShowRawConfig] = useState(false);

  useEffect(() => {
    if (open) {
      setShowRawConfig(false);
    }
  }, [open]);

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

        <div className="grid max-h-[calc(92vh-88px)] gap-0 overflow-x-hidden overflow-y-auto lg:grid-cols-[1.05fr_0.95fr]">
          <div className="min-w-0 space-y-4 p-6">
            <div>
              <FormLabel>Slug</FormLabel>
              <input value={form.slug} onChange={(event) => onChange({ slug: event.target.value })} placeholder="agente-comercial-principal" className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500" />
            </div>
            <div>
              <FormLabel>Nome do agente</FormLabel>
              <input value={form.nome} onChange={(event) => onChange({ nome: event.target.value })} placeholder="Agente comercial principal" className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500" />
            </div>
            <div>
              <FormLabel>Descricao curta</FormLabel>
              <input value={form.descricao} onChange={(event) => onChange({ descricao: event.target.value })} placeholder="Resumo curto para identificar esse agente" className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <FormLabel>Resumo do agente</FormLabel>
                <button
                  type="button"
                  onClick={onValidateSummary}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20"
                >
                  <Sparkles size={14} />
                  Validar e organizar
                </button>
              </div>
              <textarea
                value={form.promptBase}
                onChange={(event) => onChange({ promptBase: event.target.value })}
                placeholder="Descreva como o agente deve atuar, o que oferecer, como qualificar, regras de preco, handoff e CTA."
                rows={12}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <p className="mt-2 text-xs text-slate-400">Ao validar, o texto e reorganizado para leitura humana e o JSON tecnico e regenerado automaticamente.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Configuracao tecnica</p>
                  <p className="mt-1 text-xs text-slate-400">O JSON e gerado automaticamente e fica bloqueado para edicao manual.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRawConfig((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {showRawConfig ? "Ocultar JSON" : "Ver JSON"}
                </button>
              </div>
              {showRawConfig ? (
                <div className="mt-4">
                  <div className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-4">
                    <JsonHighlight value={form.configuracoes} />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="hidden rounded-xl border border-white/10 bg-slate-950/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Arquivos e imagens do agente</p>
                  <p className="mt-1 text-xs text-slate-400">O agente pode usar esses anexos no momento certo e o chat exibe imagens e arquivos clicaveis.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                  <Paperclip size={14} />
                  Adicionar arquivos
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    onChange={(event) => {
                      onAddFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {form.arquivos.length ? (
                <div className="mt-4 space-y-2">
                  {form.arquivos.map((asset) => (
                    <div key={asset.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <AgenteAssetPreview categoria={asset.categoria} publicUrl={asset.publicUrl} alt={asset.nome} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{asset.nome}</p>
                          <p className="text-xs text-slate-400">
                            {asset.arquivoNome} • {formatFileSize(asset.tamanhoBytes)}
                          </p>
                          <a
                            href={asset.publicUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="mt-1 inline-flex items-center gap-2 text-[11px] leading-relaxed text-cyan-200/80 transition-colors hover:text-cyan-100"
                            title={asset.publicUrl}
                          >
                            Link publico
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={asset.publicUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                          aria-label="Abrir arquivo"
                        >
                          <ExternalLink size={15} />
                        </a>
                        <button
                          type="button"
                          onClick={() => onRemoveUploadedFile(asset.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-100 transition-colors hover:bg-rose-500/20"
                          aria-label="Remover arquivo"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {pendingArquivos.length ? (
                <div className="mt-4 space-y-2">
                  {pendingArquivos.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-cyan-500/15 bg-cyan-500/10 px-3 py-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <AgenteAssetPreview categoria={item.file.type.startsWith("image/") ? "image" : "file"} file={item.file} alt={item.file.name} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{item.file.name}</p>
                          <p className="text-xs text-cyan-100/80">{formatFileSize(item.file.size)} • aguardando upload</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemovePendingFile(item.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Remover arquivo pendente"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 border-t border-white/10 bg-white/[0.03] p-6 lg:border-l lg:border-t-0">
            <div className="sticky top-0 z-10 mb-5 rounded-2xl border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(6,95,70,0.1))] p-4 backdrop-blur-xl">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(event) => onChange({ ativo: event.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950/60 text-emerald-400"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-white">Agente ativo para este projeto</span>
                  <span className="mt-1 block text-xs leading-relaxed text-emerald-50/85">
                    Quando ativo, este agente fica em destaque no projeto e vira a referencia principal do chat.
                  </span>
                </span>
              </label>
            </div>

            <div className="hidden mb-5 rounded-2xl border border-cyan-500/15 bg-cyan-500/10 p-5">
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
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${api.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"}`}>
                        {api.ativo ? "ativa" : "inativa"}
                      </span>
                      {api.parametros.some((parametro) => parametro.obrigatorio) ? (
                        <span className="text-[11px] text-amber-200/80">
                          exige: {api.parametros.filter((parametro) => parametro.obrigatorio).map((parametro) => parametro.nome).join(", ")}
                        </span>
                      ) : null}
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Cadastre uma API neste projeto para vincular ao agente.</p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Arquivos e imagens do agente</p>
                  <p className="mt-1 text-xs text-slate-400">Imagens aparecem com miniatura para ficar mais facil revisar o que ja foi cadastrado.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                  <Paperclip size={14} />
                  Adicionar arquivos
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    onChange={(event) => {
                      onAddFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {form.arquivos.length ? (
                <div className="mt-4 space-y-2">
                  {form.arquivos.map((asset) => (
                    <div key={asset.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <AgenteAssetPreview categoria={asset.categoria} publicUrl={asset.publicUrl} alt={asset.nome} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{asset.nome}</p>
                          <p className="text-xs text-slate-400">
                            {asset.arquivoNome} • {formatFileSize(asset.tamanhoBytes)}
                          </p>
                          <a
                            href={asset.publicUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="mt-1 block text-[11px] leading-relaxed text-cyan-200/80 transition-colors hover:text-cyan-100"
                            title={asset.publicUrl}
                          >
                            {summarizePublicUrl(asset.publicUrl)}
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={asset.publicUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                          aria-label="Abrir arquivo"
                        >
                          <ExternalLink size={15} />
                        </a>
                        <button
                          type="button"
                          onClick={() => onRemoveUploadedFile(asset.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-100 transition-colors hover:bg-rose-500/20"
                          aria-label="Remover arquivo"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {pendingArquivos.length ? (
                <div className="mt-4 space-y-2">
                  {pendingArquivos.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-cyan-500/15 bg-cyan-500/10 px-3 py-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <AgenteAssetPreview categoria={item.file.type.startsWith("image/") ? "image" : "file"} file={item.file} alt={item.file.name} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{item.file.name}</p>
                          <p className="text-xs text-cyan-100/80">{formatFileSize(item.file.size)} • aguardando upload</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemovePendingFile(item.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Remover arquivo pendente"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {form.apiIds.length ? (
              <div className="mt-4 space-y-3">
                {apis.filter((api) => form.apiIds.includes(api.id) && !api.ativo).length ? (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    APIs inativas vinculadas:{" "}
                    {apis
                      .filter((api) => form.apiIds.includes(api.id) && !api.ativo)
                      .map((api) => api.nome)
                      .join(", ")}
                    . O agente so consulta APIs marcadas como ativas.
                  </div>
                ) : null}
                {apis.some((api) => form.apiIds.includes(api.id) && api.parametros.some((parametro) => parametro.obrigatorio)) ? (
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                    Para o agente consultar essas APIs no chat, envie no contexto:{" "}
                    {apis
                      .filter((api) => form.apiIds.includes(api.id))
                      .flatMap((api) => api.parametros.filter((parametro) => parametro.obrigatorio))
                      .filter(
                        (parametro, index, array) =>
                          array.findIndex((item) => item.nome.toLowerCase() === parametro.nome.toLowerCase()) === index,
                      )
                      .map((parametro) => parametro.nome)
                      .join(", ")}
                    .
                  </div>
                ) : null}
              </div>
            ) : null}

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
  testParameterValues,
  onClose,
  onChange,
  onChangeTestParameter,
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
  testParameterValues: Record<string, string>;
  onClose: () => void;
  onChange: (next: Partial<ApiFormState>) => void;
  onChangeTestParameter: (name: string, value: string) => void;
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
  const inferredUrlParameters = extractUrlParameterNames(form.url);
  const inferredUrlParameterNames = new Set(inferredUrlParameters);

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
            <div>
              <FormLabel>Nome da API</FormLabel>
              <input value={form.nome} onChange={(event) => onChange({ nome: event.target.value })} placeholder="Consulta de imoveis" className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500" />
            </div>
            <div>
              <FormLabel>URL da API</FormLabel>
              <input value={form.url} onChange={(event) => onChange({ url: event.target.value })} placeholder="https://api.exemplo.com/recurso" className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500" />
            </div>
            <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/8 px-4 py-3 text-sm text-cyan-50">
              <p className="font-semibold text-white">Como configurar sem erro</p>
              <p className="mt-1 text-cyan-100/80">
                Se a API precisar de um identificador, escreva na URL como <code className="rounded bg-slate-950/50 px-1.5 py-0.5 text-xs text-cyan-100">{"{id}"}</code>.
                O sistema marca esse parametro como obrigatorio automaticamente.
              </p>
              <p className="mt-2 text-xs text-cyan-100/70">
                Exemplo: <code className="rounded bg-slate-950/50 px-1.5 py-0.5">https://api.exemplo.com/imoveis/{"{id}"}</code>
              </p>
              {inferredUrlParameters.length ? (
                <p className="mt-2 text-xs text-amber-200">
                  Parametros obrigatorios detectados na URL: {inferredUrlParameters.join(", ")}
                </p>
              ) : null}
            </div>
            {inferredUrlParameters.length ? (
              <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                <p className="text-sm font-semibold text-white">Valores de teste</p>
                <p className="mt-1 text-xs text-slate-400">
                  Esses valores sao usados apenas no botao <span className="font-semibold text-cyan-100">Testar API</span> para descobrir os campos da resposta correta.
                </p>
                <div className="mt-3 space-y-3">
                  {inferredUrlParameters.map((parametro) => (
                    <label key={parametro} className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        {parametro}
                      </span>
                      <input
                        value={testParameterValues[parametro] ?? ""}
                        onChange={(event) => onChangeTestParameter(parametro, event.target.value)}
                        placeholder={`Valor de teste para ${parametro}`}
                        className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <FormLabel>Metodo</FormLabel>
              <input value={form.metodo} readOnly className="w-full rounded-xl border border-white/10 bg-slate-950/30 px-4 py-3 text-white outline-none" />
            </div>
            <div>
              <FormLabel>Descricao da API</FormLabel>
              <textarea value={form.descricao} onChange={(event) => onChange({ descricao: event.target.value })} placeholder="Explique o que essa API retorna e quando o agente deve usa-la" rows={5} className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white outline-none placeholder:text-slate-500" />
            </div>
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
                        {inferredUrlParameterNames.has(parametro.nome)
                          ? "obrigatorio pela URL"
                          : parametro.obrigatorio
                            ? "obrigatorio"
                            : "opcional"}
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

function WidgetModal({
  open,
  form,
  agentes,
  saving,
  feedback,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean;
  form: WidgetFormState;
  agentes: Agente[];
  saving: boolean;
  feedback: string | null;
  onClose: () => void;
  onChange: (next: Partial<WidgetFormState>) => void;
  onSubmit: () => void;
}) {
  if (!open) {
    return null;
  }

  const documentationHref = "/docs/chat-widget-host-control";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Widget</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{form.id ? "Editar widget" : "Novo widget"}</h2>
            <p className="mt-1 text-sm text-slate-400">Este widget ja nasce vinculado ao projeto atual para evitar ambiguidades na abertura do chat.</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={documentationHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-100 transition-colors hover:bg-cyan-500/15 hover:text-white"
              aria-label="Abrir documentacao do widget"
              title="Abrir documentacao do widget"
            >
              <ExternalLink size={18} />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fechar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(92vh-88px)] overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <FormLabel>Nome do widget</FormLabel>
              <input
                value={form.nome}
                onChange={(event) => onChange({ nome: event.target.value })}
                placeholder="Chat principal do site"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div>
              <FormLabel>Slug publico</FormLabel>
              <input
                value={form.slug}
                onChange={(event) => onChange({ slug: event.target.value })}
                placeholder="chat-site"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div>
              <FormLabel>Dominio ou contexto</FormLabel>
              <input
                value={form.dominio}
                onChange={(event) => onChange({ dominio: event.target.value })}
                placeholder="Dominio permitido ou contexto do embed"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div>
              <FormLabel>WhatsApp</FormLabel>
              <input
                value={form.whatsappCelular}
                onChange={(event) => onChange({ whatsappCelular: formatWhatsAppPhone(event.target.value) })}
                placeholder="+55 11 99999-9999"
                inputMode="tel"
                autoComplete="tel"
                maxLength={17}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-[0.7fr_0.3fr]">
              <div>
                <FormLabel>Tema</FormLabel>
                <select
                  value={form.tema}
                  onChange={(event) => onChange({ tema: event.target.value === "light" ? "light" : "dark" })}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
                >
                  <option value="dark">Tema escuro</option>
                  <option value="light">Tema claro</option>
                </select>
              </div>
              <div>
                <FormLabel>Cor principal</FormLabel>
                <input
                  type="color"
                  value={form.corPrimaria}
                  onChange={(event) => onChange({ corPrimaria: event.target.value })}
                  className="h-[50px] w-full rounded-xl border border-white/10 bg-slate-950/50 px-2 py-2"
                />
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-300">
              Projeto selecionado
            </div>
            <select
              value={form.agenteId ?? ""}
              onChange={(event) => onChange({ agenteId: event.target.value || null })}
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
            >
              <option value="">Usar o agente ativo do projeto</option>
              {agentes.map((agente) => (
                <option key={agente.id} value={agente.id}>
                  {agente.nome}
                  {agente.ativo ? " (ativo)" : ""}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <input type="checkbox" checked={form.ativo} onChange={(event) => onChange({ ativo: event.target.checked })} />
              Widget ativo
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.fundoTransparente}
                onChange={(event) => onChange({ fundoTransparente: event.target.checked })}
              />
              Fundo transparente
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onSubmit}
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white"
              >
                {form.id ? <Pencil size={16} /> : <Plus size={16} />}
                {saving ? "Salvando..." : form.id ? "Atualizar widget" : "Criar widget"}
              </button>
              <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white">
                Cancelar
              </button>
            </div>

            {feedback ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatHistoryModal({
  open,
  loading,
  error,
  detail,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  detail: ChatDetailState | null;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Conversa</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{detail?.chat.titulo ?? "Carregando conversa"}</h2>
            {detail ? <p className="mt-1 text-sm text-slate-400">Atualizada em {new Date(detail.chat.updatedAt).toLocaleString("pt-BR")}</p> : null}
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

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? <div className="rounded-xl border border-white/10 bg-slate-950/30 p-6 text-sm text-slate-300">Carregando historico da conversa...</div> : null}
          {!loading && error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">{error}</div> : null}
          {!loading && !error && detail ? (
            <div className="space-y-4">
              {detail.messages.length ? (
                detail.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-2xl border px-4 py-3 ${
                      message.role === "assistant"
                        ? "border-cyan-500/20 bg-cyan-500/10"
                        : message.role === "user"
                          ? "border-white/10 bg-slate-950/40"
                          : "border-amber-500/20 bg-amber-500/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">{message.role === "assistant" ? "Assistente" : message.role === "user" ? "Cliente" : "Sistema"}</span>
                      <span className="text-[11px] text-slate-500">{new Date(message.createdAt).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white">{message.conteudo}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">Nenhuma mensagem encontrada nesta conversa.</div>
              )}
            </div>
          ) : null}
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
  const [widgetForm, setWidgetForm] = useState<WidgetFormState>(emptyWidgetForm);
  const [detectedApiCampos, setDetectedApiCampos] = useState<ApiCampo[]>([]);
  const [apiTestParameterValues, setApiTestParameterValues] = useState<Record<string, string>>({});
  const [savingAgente, setSavingAgente] = useState(false);
  const [savingApi, setSavingApi] = useState(false);
  const [savingWidget, setSavingWidget] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [feedbackAgente, setFeedbackAgente] = useState<string | null>(null);
  const [feedbackApi, setFeedbackApi] = useState<string | null>(null);
  const [feedbackWidget, setFeedbackWidget] = useState<string | null>(null);
  const [agenteModalOpen, setAgenteModalOpen] = useState(false);
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatHistoryError, setChatHistoryError] = useState<string | null>(null);
  const [chatDetail, setChatDetail] = useState<ChatDetailState | null>(null);
  const [pendingAgenteArquivos, setPendingAgenteArquivos] = useState<PendingAgenteArquivo[]>([]);
  const [origin, setOrigin] = useState("");
  const [copiedWidgetSlug, setCopiedWidgetSlug] = useState<string | null>(null);

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
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    void loadProjeto();
  }, [params.id]);

  const resetAgenteForm = () => {
    setAgenteForm({
      ...emptyAgenteForm,
      projetoId: params.id,
    });
    setPendingAgenteArquivos([]);
    setFeedbackAgente(null);
  };

  const resetApiForm = () => {
    setApiForm(emptyApiForm);
    setApiTestParameterValues({});
    setDetectedApiCampos([]);
    setFeedbackApi(null);
  };

  const resetWidgetForm = () => {
    setWidgetForm({
      ...emptyWidgetForm,
      projetoId: params.id,
    });
    setFeedbackWidget(null);
  };

  const openNewAgenteModal = () => {
    resetAgenteForm();
    setAgenteModalOpen(true);
  };

  const openNewApiModal = () => {
    resetApiForm();
    setApiModalOpen(true);
  };

  const openNewWidgetModal = () => {
    resetWidgetForm();
    setWidgetModalOpen(true);
  };

  const handleOpenChatHistory = async (chat: Chat) => {
    setChatHistoryOpen(true);
    setChatHistoryLoading(true);
    setChatHistoryError(null);
    setChatDetail(null);

    const response = await fetch(`/api/admin/chats/${chat.id}`, { cache: "no-store" });
    const payload = (await response.json()) as {
      error?: string;
      chat?: Chat;
      messages?: ChatMessage[];
    };

    if (!response.ok || !payload.chat) {
      setChatHistoryError(payload.error ?? "Nao foi possivel carregar a conversa.");
      setChatHistoryLoading(false);
      return;
    }

    setChatDetail({
      chat: payload.chat,
      messages: payload.messages ?? [],
    });
    setChatHistoryLoading(false);
  };

  const getResolvedWidgetAgent = (widget: ChatWidget) => {
    if (widget.agenteId) {
      return data?.agentes.find((agente) => agente.id === widget.agenteId) ?? null;
    }

    return data?.agentes.find((agente) => agente.ativo) ?? null;
  };

  const getAgentLinkedApis = (agente: Agente) => {
    if (!data) {
      return [];
    }

    const allowedApiIds = new Set(agente.apiIds);
    return data.apis.filter((api) => allowedApiIds.has(api.id));
  };

  const getAgentRequiredParameters = (agente: Agente) => {
    const required = getAgentLinkedApis(agente).flatMap((api) => api.parametros.filter((parametro) => parametro.obrigatorio));
    return required.filter(
      (parametro, index, array) => array.findIndex((item) => item.nome.toLowerCase() === parametro.nome.toLowerCase()) === index,
    );
  };

  const getAgentInactiveApis = (agente: Agente) => getAgentLinkedApis(agente).filter((api) => !api.ativo);

  const getWidgetRequiredParameters = (widget: ChatWidget) => {
    const agente = getResolvedWidgetAgent(widget);
    if (!agente?.apiIds.length) {
      return [];
    }

    const allowedApiIds = new Set(agente.apiIds);
    const required = data?.apis
      .filter((api) => allowedApiIds.has(api.id))
      .flatMap((api) => api.parametros.filter((parametro) => parametro.obrigatorio)) ?? [];

    return required.filter(
      (parametro, index, array) => array.findIndex((item) => item.nome.toLowerCase() === parametro.nome.toLowerCase()) === index,
    );
  };

  const buildWidgetSnippet = (widget: ChatWidget) => {
    const base = origin || "https://seu-dominio";
    const projetoRef = data?.projeto.slug || data?.projeto.id || "seu-projeto";
    const agente = getResolvedWidgetAgent(widget);
    const agenteRef = agente?.slug || agente?.id || "agente-do-projeto";
    const requiredParameters = getWidgetRequiredParameters(widget);
    const contextLines = [
      "      route: { path: window.location.pathname },",
      "      ui: {",
      `        title: '${widget.nome.replace(/'/g, "\\'")}',`,
      `        theme: '${widget.tema}',`,
      `        accent: '${widget.corPrimaria}',`,
      `        transparent: ${widget.fundoTransparente ? "true" : "false"},`,
      "      },",
    ];

    if (requiredParameters.length) {
      contextLines.push("      resource: { id: 'recurso-atual', tipo: 'recurso' },");
      for (const parametro of requiredParameters) {
        const placeholder = parametro.tipo === "number" ? "0" : parametro.tipo === "boolean" ? "false" : "'XXX'";
        contextLines.push(`      ${parametro.nome}: ${placeholder},`);
      }
    }

    return [
      "// Carregue o SDK do widget",
      "<script",
      `  src=\"${base}/chat.js\"`,
      `  data-projeto=\"${projetoRef}\"`,
      `  data-agente=\"${agenteRef}\"`,
      "></script>",
      "",
      "// Monte o chat com o contexto inicial da pagina",
      "<script>",
      "  window.InfraChat.mount({",
      `    projeto: '${projetoRef}',`,
      `    agente: '${agenteRef}',`,
      `    apiBase: '${base}',`,
      "    strictHostControl: true,",
      "    context: {",
      ...contextLines,
      "    },",
      "  });",
      "</script>",
    ].join("\n");
  };

  const handleCopyWidgetSnippet = async (widget: ChatWidget) => {
    try {
      await navigator.clipboard.writeText(buildWidgetSnippet(widget));
      setCopiedWidgetSlug(widget.slug);
      window.setTimeout(() => {
        setCopiedWidgetSlug((current) => (current === widget.slug ? null : current));
      }, 1800);
    } catch {
      setCopiedWidgetSlug(null);
    }
  };

  const handleAddAgenteFiles = (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const nextFiles = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
    }));

    setPendingAgenteArquivos((current) => [...current, ...nextFiles]);
  };

  const handleRemovePendingAgenteFile = (id: string) => {
    setPendingAgenteArquivos((current) => current.filter((item) => item.id !== id));
  };

  const handleRemoveUploadedAgenteFile = (assetId: string) => {
    setAgenteForm((current) => ({
      ...current,
      arquivos: current.arquivos.filter((item) => item.id !== assetId),
      arquivoIdsRemovidos: current.arquivoIdsRemovidos.includes(assetId)
        ? current.arquivoIdsRemovidos
        : [...current.arquivoIdsRemovidos, assetId],
    }));
  };

  const syncAgentAssets = async (agenteId: string, projetoId: string) => {
    for (const assetId of agenteForm.arquivoIdsRemovidos) {
      await fetch("/api/admin/agentes/assets", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: assetId }),
      });
    }

    for (const pending of pendingAgenteArquivos) {
      const formData = new FormData();
      formData.set("agenteId", agenteId);
      formData.set("projetoId", projetoId);
      formData.set("nome", pending.file.name);
      formData.set("file", pending.file);

      const response = await fetch("/api/admin/agentes/assets", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Nao foi possivel enviar um dos arquivos do agente.");
      }
    }
  };

  const prepareAgenteForm = (form: AgenteFormState) => {
    const compactPromptBase = compactAgentSummary(form.promptBase);
    const generatedConfig = buildAgentConfigFromSummary(compactPromptBase);
    const condensedPromptBase = [
      inferShortDescription(compactPromptBase),
      ...compactPromptBase
        .split("\n")
        .filter((line) => line && line !== inferShortDescription(compactPromptBase))
        .slice(0, 18),
    ]
      .filter(Boolean)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return {
      ...form,
      descricao: form.descricao.trim() || inferShortDescription(condensedPromptBase),
      promptBase: condensedPromptBase,
      configuracoes: JSON.stringify(generatedConfig, null, 2),
    };
  };

  const handleValidateAgenteSummary = () => {
    if (!agenteForm.promptBase.trim()) {
      setFeedbackAgente("Preencha o resumo do agente antes de validar.");
      return;
    }

    const preparedForm = prepareAgenteForm(agenteForm);
    setAgenteForm(preparedForm);
    setFeedbackAgente("Resumo validado e configuracao tecnica atualizada.");
  };

  const handleAgenteSubmit = async () => {
    setSavingAgente(true);
    setFeedbackAgente(null);

    const preparedForm = prepareAgenteForm(agenteForm);
    setAgenteForm(preparedForm);

    const method = preparedForm.id ? "PUT" : "POST";
    const response = await fetch("/api/admin/agentes", {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preparedForm),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedbackAgente(payload.error ?? "Nao foi possivel salvar o agente.");
      setSavingAgente(false);
      return;
    }

    const savedAgente = (payload as { agente?: Agente }).agente ?? null;

    try {
      if (savedAgente?.id && savedAgente.projetoId) {
        await syncAgentAssets(savedAgente.id, savedAgente.projetoId);
      }
    } catch (error) {
      setFeedbackAgente(error instanceof Error ? error.message : "Nao foi possivel atualizar os arquivos do agente.");
      setSavingAgente(false);
      return;
    }

    await loadProjeto();
    const message = preparedForm.id ? "Agente atualizado com sucesso." : "Agente criado com sucesso.";
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
      arquivos: agente.arquivos ?? [],
      arquivoIdsRemovidos: [],
    });
    setPendingAgenteArquivos([]);
    setFeedbackAgente(null);
    setAgenteModalOpen(true);
  };

  const handleApiSubmit = async () => {
    setSavingApi(true);
    setFeedbackApi(null);

    try {
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

      const savedApi = payload.api ? await maybeRefreshApiFieldsAfterSave(payload.api) : null;

      await loadProjeto();
      const message = savedApi && hasRequiredTestValues(savedApi.parametros, apiTestParameterValues)
        ? "API atualizada com sucesso e campos reais sincronizados automaticamente."
        : apiForm.id
          ? "API atualizada com sucesso."
          : "API criada com sucesso.";

      if (savedApi) {
        setDetectedApiCampos(
          mergeDetectedApiCampos(
            savedApi.campos.map((campo) => ({
              id: campo.id,
              nome: campo.nome,
              tipo: campo.tipo,
              descricao: campo.descricao,
            })),
            savedApi.parametros.map((parametro) => ({
              nome: parametro.nome,
              tipo: parametro.tipo,
              obrigatorio: parametro.obrigatorio,
            })),
          ),
        );
        setApiForm({
          id: savedApi.id,
          nome: savedApi.nome,
          url: savedApi.url,
          metodo: "GET",
          descricao: savedApi.descricao,
          ativo: savedApi.ativo,
          campos: savedApi.campos.map((campo) => ({
            id: campo.id,
            nome: campo.nome,
            tipo: campo.tipo,
            descricao: campo.descricao,
          })),
          parametros: savedApi.parametros.map((parametro) => ({
            nome: parametro.nome,
            tipo: parametro.tipo,
            obrigatorio: parametro.obrigatorio,
          })),
        });
        setApiTestParameterValues((prev) => syncTestParameterValues(savedApi.url, prev));
      } else {
        resetApiForm();
      }

      setSavingApi(false);
      setApiModalOpen(false);
      setFeedbackApi(message);
    } catch (error) {
      setFeedbackApi(error instanceof Error ? error.message : "Nao foi possivel salvar a API.");
      setSavingApi(false);
    }
  };

  const handleWidgetSubmit = async () => {
    setSavingWidget(true);
    setFeedbackWidget(null);

    const response = await fetch("/api/admin/chat-widgets", {
      method: widgetForm.id ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...widgetForm,
        whatsappCelular: sanitizePhoneDigits(widgetForm.whatsappCelular),
        projetoId: params.id,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setFeedbackWidget(payload.error ?? "Nao foi possivel salvar o widget.");
      setSavingWidget(false);
      return;
    }

    await loadProjeto();
    const message = widgetForm.id ? "Widget atualizado com sucesso." : "Widget criado com sucesso.";
    resetWidgetForm();
    setSavingWidget(false);
    setWidgetModalOpen(false);
    setFeedbackWidget(message);
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

  const maybeRefreshApiFieldsAfterSave = async (api: Api) => {
    if (!hasRequiredTestValues(api.parametros, apiTestParameterValues)) {
      return api;
    }

    const response = await fetch(`/api/apis/${api.id}/testar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: buildApiTestContext(apiTestParameterValues) }),
    });

    const payload = (await response.json()) as { error?: string; api?: Api };
    if (!response.ok || !payload.api) {
      throw new Error(payload.error ?? "A API foi salva, mas nao foi possivel atualizar os campos automaticamente.");
    }

    return payload.api;
  };

  const handleTestApi = async () => {
    setTestingApi(true);
    setFeedbackApi(null);

    try {
      const api = await persistApiBeforeTest();
      const testContext = Object.fromEntries(
        Object.entries(apiTestParameterValues)
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => Boolean(value)),
      );
      const response = await fetch(`/api/apis/${api.id}/testar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: testContext }),
      });

      const payload = (await response.json()) as { error?: string; api?: Api };

      if (!response.ok || !payload.api) {
        setFeedbackApi(payload.error ?? "Nao foi possivel testar a API.");
        setTestingApi(false);
        return;
      }
      const testedApi = payload.api;

      setDetectedApiCampos(
        mergeDetectedApiCampos(
          testedApi.campos.map((campo) => ({
            id: campo.id,
            nome: campo.nome,
            tipo: campo.tipo,
            descricao: campo.descricao,
          })),
          testedApi.parametros.map((parametro) => ({
            nome: parametro.nome,
            tipo: parametro.tipo,
            obrigatorio: parametro.obrigatorio,
          })),
        ),
      );
      setApiForm({
        id: testedApi.id,
        nome: testedApi.nome,
        url: testedApi.url,
        metodo: "GET",
        descricao: testedApi.descricao,
        ativo: testedApi.ativo,
        campos: testedApi.campos.map((campo) => ({
          id: campo.id,
          nome: campo.nome,
          tipo: campo.tipo,
          descricao: campo.descricao,
        })),
        parametros: testedApi.parametros.map((parametro) => ({
          nome: parametro.nome,
          tipo: parametro.tipo,
          obrigatorio: parametro.obrigatorio,
        })),
      });
      setApiTestParameterValues((prev) => syncTestParameterValues(testedApi.url, prev));
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
    setApiTestParameterValues((prev) => syncTestParameterValues(api.url, prev));
    setFeedbackApi(null);
    setApiModalOpen(true);
  };

  const handleEditWidget = (widget: ChatWidget) => {
    setWidgetForm({
      ...widget,
      whatsappCelular: formatWhatsAppPhone(widget.whatsappCelular),
      projetoId: params.id,
    });
    setFeedbackWidget(null);
    setWidgetModalOpen(true);
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
      if (extractUrlParameterNames(prev.url).includes(campo.nome)) {
        return normalizeApiForm({
          ...prev,
          parametros: prev.parametros.some((item) => item.nome === campo.nome)
            ? prev.parametros
            : [
                ...prev.parametros,
                {
                  nome: campo.nome,
                  tipo: campo.tipo,
                  obrigatorio: true,
                },
              ],
        });
      }

      const exists = prev.parametros.some((item) => item.nome === campo.nome);
      return normalizeApiForm({
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
      });
    });
  };

  const handleApiFormChange = (next: Partial<ApiFormState>) => {
    setApiForm((prev) => {
      const updated = normalizeApiForm({ ...prev, ...next });
      setApiTestParameterValues((current) => syncTestParameterValues(updated.url, current));
      return updated;
    });
  };

  const handleApiTestParameterChange = (name: string, value: string) => {
    setApiTestParameterValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const toggleApiParametroObrigatorio = (campo: ApiCampo) => {
    setApiForm((prev) => {
      if (extractUrlParameterNames(prev.url).includes(campo.nome)) {
        return normalizeApiForm(prev);
      }

      if (!prev.parametros.some((item) => item.nome === campo.nome)) {
        return prev;
      }

      return normalizeApiForm({
        ...prev,
        parametros: prev.parametros.map((item) =>
          item.nome === campo.nome
            ? {
                ...item,
                obrigatorio: !item.obrigatorio,
              }
            : item,
        ),
      });
    });
  };

  const [activeTab, setActiveTab] = useState<ProjectTab>("agentes");

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
        <div className="mt-6 grid gap-4 md:grid-cols-6">
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
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Widgets</p>
            <p className="mt-2 text-lg font-bold text-white">{data.stats.totalWidgets}</p>
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
        <div className="mt-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Navegacao do projeto</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("agentes")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === "agentes"
                  ? "border border-cyan-500/20 bg-cyan-500/10 text-cyan-100"
                  : "border border-white/10 bg-white/5 text-white"
              }`}
            >
              Agentes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("apis")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === "apis"
                  ? "border border-cyan-500/20 bg-cyan-500/10 text-cyan-100"
                  : "border border-white/10 bg-white/5 text-white"
              }`}
            >
              APIs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("chats")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === "chats"
                  ? "border border-cyan-500/20 bg-cyan-500/10 text-cyan-100"
                  : "border border-white/10 bg-white/5 text-white"
              }`}
            >
              Chats
            </button>
          </div>
        </div>
      </section>

      {(feedbackAgente || feedbackApi || feedbackWidget) && (
        <section className="grid gap-3">
          {feedbackAgente ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackAgente}</div> : null}
          {feedbackApi ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackApi}</div> : null}
          {feedbackWidget ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackWidget}</div> : null}
        </section>
      )}

      <div className="space-y-6">
        <section className={`${activeTab === "agentes" ? "block" : "hidden"} overflow-hidden rounded-2xl border border-white/10 bg-white/5`}>
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
              data.agentes.map((agente) => {
                const linkedApis = getAgentLinkedApis(agente);
                const inactiveApis = getAgentInactiveApis(agente);
                const requiredParameters = getAgentRequiredParameters(agente);

                return (
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
                        <p className="mt-3 text-xs text-cyan-200/80">APIs vinculadas: {linkedApis.length ? linkedApis.map((api) => api.nome).join(", ") : "nenhuma"}</p>
                        {inactiveApis.length ? (
                          <p className="mt-2 text-xs text-amber-200/80">APIs inativas ignoradas no runtime: {inactiveApis.map((api) => api.nome).join(", ")}</p>
                        ) : null}
                        {requiredParameters.length ? (
                          <p className="mt-1 text-xs text-cyan-100/80">O chat precisa enviar no contexto: {requiredParameters.map((parametro) => parametro.nome).join(", ")}</p>
                        ) : null}
                      </div>
                      <button type="button" onClick={() => handleEditAgente(agente)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200">
                        Editar
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">Nenhum agente cadastrado para este projeto ainda.</div>
            )}
          </div>
        </section>

        <section className={`${activeTab === "apis" ? "block" : "hidden"} overflow-hidden rounded-2xl border border-white/10 bg-white/5`}>
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
                      {api.parametros.some((parametro) => parametro.obrigatorio) ? (
                        <p className="mt-1 text-xs text-cyan-100/80">
                          Essa API so funciona no chat quando o contexto enviar:{" "}
                          {api.parametros.filter((parametro) => parametro.obrigatorio).map((parametro) => parametro.nome).join(", ")}
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

      <section className={`${activeTab === "chats" ? "block" : "hidden"}`}>
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Widget do chat</h3>
                <p className="mt-1 text-sm text-slate-400">Do lado esquerdo fica a operacao do chat: widget, embed e configuracao.</p>
              </div>
              <button type="button" onClick={openNewWidgetModal} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white">
                <Plus size={16} />
                Novo widget de chat
              </button>
            </div>
            <div className="space-y-4 p-6">
              {data.widgets.length ? (
                data.widgets.map((widget) => {
                  const agente = getResolvedWidgetAgent(widget);

                  return (
                    <div key={widget.id ?? widget.slug} className="rounded-xl border border-white/10 bg-slate-950/30 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="text-lg font-bold text-white">{widget.nome}</h4>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${widget.ativo ? "bg-emerald-500/10 text-emerald-200" : "bg-slate-800 text-slate-400"}`}>
                              {widget.ativo ? "ativo" : "inativo"}
                            </span>
                          </div>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">slug: {widget.slug}</p>
                          <p className="mt-3 text-sm text-slate-300">Projeto: {data.projeto.nome}</p>
                          <p className="mt-1 text-sm text-slate-400">Agente: {agente?.nome ?? "agente ativo do projeto"}</p>
                          <p className="mt-1 text-sm text-slate-400">Dominio/contexto: {widget.dominio || "nao informado"}</p>
                          <p className="mt-1 text-sm text-slate-400">WhatsApp: {widget.whatsappCelular || "nao informado"}</p>
                          <p className="mt-1 text-sm text-slate-400">Tema: {widget.tema === "light" ? "claro" : "escuro"} | cor: {widget.corPrimaria}</p>
                          <p className="mt-1 text-sm text-slate-400">Fundo: {widget.fundoTransparente ? "transparente" : "solido"}</p>
                          <div className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950/60 p-3">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Codigo de injecao</p>
                              <div className="flex items-center gap-2">
                                <a
                                  href="/docs/chat-widget-host-control"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                  <ExternalLink size={13} />
                                  Documentacao
                                </a>
                                <button
                                  type="button"
                                  onClick={() => void handleCopyWidgetSnippet(widget)}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/15 hover:text-white"
                                >
                                  {copiedWidgetSlug === widget.slug ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                                  {copiedWidgetSlug === widget.slug ? "Copiado" : "Copiar"}
                                </button>
                              </div>
                            </div>
                            <div className="w-full overflow-x-auto rounded-lg border border-white/10 bg-[#07111f]">
                              <pre className="min-h-[170px] w-full whitespace-pre-wrap break-all px-4 py-4 font-mono text-xs leading-6">
                                {buildWidgetSnippet(widget)
                                  .split("\n")
                                  .map((line, index) => (
                                    <div key={`${widget.slug}-line-${index}`}>{renderSnippetLine(line)}</div>
                                  ))}
                              </pre>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEditWidget(widget)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">
                  Nenhum widget de chat cadastrado para este projeto ainda.
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-6 py-5">
              <h3 className="text-xl font-bold text-white">Conversas</h3>
              <p className="mt-1 text-sm text-slate-400">Do lado direito ficam as conversas. Clique para abrir o historico completo.</p>
            </div>
            <div className="space-y-4 p-6">
              {data.chats.length ? (
                data.chats.slice(0, 12).map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => void handleOpenChatHistory(chat)}
                    className="block w-full rounded-xl border border-white/10 bg-slate-950/30 p-4 text-left transition-colors hover:border-cyan-500/30 hover:bg-slate-950/50"
                  >
                    <div className="flex items-center gap-2 text-cyan-200">
                      <MessageSquare size={14} />
                      <p className="font-semibold text-white">{chat.titulo}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{new Date(chat.updatedAt).toLocaleString("pt-BR")}</p>
                    <p className="mt-2 text-xs text-slate-400">Lead: {String((chat.contexto?.lead as { nome?: string } | undefined)?.nome ?? "Nao identificado")}</p>
                    <p className="mt-1 text-xs text-cyan-200/80">Tokens: {chat.totalTokens}</p>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">Nenhum chat registrado para este projeto ainda.</div>
              )}
            </div>
          </section>
        </div>
      </section>

        <Link href="/admin/projetos" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10">
          Voltar para projetos
        </Link>

      <AgenteModal
        open={agenteModalOpen}
        form={agenteForm}
        apis={data.apis}
        pendingArquivos={pendingAgenteArquivos}
        saving={savingAgente}
        feedback={feedbackAgente}
        onClose={() => {
          setAgenteModalOpen(false);
          resetAgenteForm();
        }}
        onChange={(next) => setAgenteForm((prev) => ({ ...prev, ...next }))}
        onAddFiles={handleAddAgenteFiles}
        onRemovePendingFile={handleRemovePendingAgenteFile}
        onRemoveUploadedFile={handleRemoveUploadedAgenteFile}
        onValidateSummary={handleValidateAgenteSummary}
        onSubmit={() => void handleAgenteSubmit()}
      />

      <ApiModal
        open={apiModalOpen}
        form={apiForm}
        detectedApiCampos={detectedApiCampos}
        saving={savingApi}
        testing={testingApi}
        feedback={feedbackApi}
        testParameterValues={apiTestParameterValues}
        onClose={() => {
          setApiModalOpen(false);
          resetApiForm();
        }}
        onChange={handleApiFormChange}
        onChangeTestParameter={handleApiTestParameterChange}
        onToggleCampo={toggleApiCampo}
        onToggleParametro={toggleApiParametro}
        onToggleObrigatorio={toggleApiParametroObrigatorio}
        onSubmit={() => void handleApiSubmit()}
        onTest={() => void handleTestApi()}
      />
      <WidgetModal
        open={widgetModalOpen}
        form={widgetForm}
        agentes={data.agentes}
        saving={savingWidget}
        feedback={feedbackWidget}
        onClose={() => {
          setWidgetModalOpen(false);
          resetWidgetForm();
        }}
        onChange={(next) =>
          setWidgetForm((prev) => ({
            ...prev,
            ...next,
            whatsappCelular:
              next.whatsappCelular !== undefined ? formatWhatsAppPhone(next.whatsappCelular) : prev.whatsappCelular,
            projetoId: params.id,
          }))
        }
        onSubmit={() => void handleWidgetSubmit()}
      />
      <ChatHistoryModal
        open={chatHistoryOpen}
        loading={chatHistoryLoading}
        error={chatHistoryError}
        detail={chatDetail}
        onClose={() => {
          setChatHistoryOpen(false);
          setChatHistoryLoading(false);
          setChatHistoryError(null);
          setChatDetail(null);
        }}
      />
    </main>
  );
}
