"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, Bold, Bot, Boxes, Cable, CheckCircle2, ChevronDown, Coins, Copy, Cpu, Expand, ExternalLink, FileImage, Heading, List, ListOrdered, LoaderCircle, MessageSquare, MessageSquareText, Minimize2, PanelsTopLeft, Paperclip, Pencil, Plus, Power, ShieldAlert, Sparkles, TestTube2, Trash2, Waypoints, X } from "lucide-react";
import { getAgentRuntimeBlockEntries, normalizeAgentRuntimeConfig } from "@/lib/agent-runtime";

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
  canal: string;
  identificadorExterno: string | null;
  contexto: Record<string, unknown> | null;
  ultimaMensagem: string | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  conteudo: string;
  createdAt: string;
};

type WhatsAppChannelSession = {
  connectionStatus?: "offline" | "aguardando_qr" | "connecting" | "online";
  qrCodeUrl?: string | null;
  qrCodeDataUrl?: string | null;
  qrCodeText?: string | null;
  connectedAt?: string | null;
  disconnectedAt?: string | null;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  lastSyncAt?: string | null;
  worker?: string | null;
  notes?: string | null;
};

type WhatsAppChannel = {
  id: string;
  projetoId: string | null;
  agenteId: string | null;
  numero: string;
  status: "ativo" | "inativo";
  sessionData: WhatsAppChannelSession | null;
  createdAt: string;
  updatedAt: string;
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

type Connector = {
  id?: string;
  nome: string;
  tipo: "mercado_livre";
  projetoId: string | null;
  agenteId: string | null;
  endpointBase: string;
  configuracoes: {
    app_id?: string;
    client_secret?: string;
    seller_id?: string;
    nickname?: string;
    access_token?: string;
    refresh_token?: string;
    token_expires_at?: string;
    user_id?: string;
  } | null;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ProjetoDetalhe = {
  projeto: Projeto;
  agentes: Agente[];
  apis: Api[];
  conectores: Connector[];
  widgets: ChatWidget[];
  whatsappChannels: WhatsAppChannel[];
  chats: Chat[];
  billing: ProjetoBillingSection | null;
  stats: {
    totalAgentes: number;
    agenteAtivoId: string | null;
    totalApis: number;
    totalConectores: number;
    totalWidgets: number;
    totalWhatsAppChannels: number;
    totalChats: number;
  };
};

type BillingPricingModel = {
  id: string;
  label: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
};

type ProjetoPlanoBilling = {
  id: string;
  projetoId: string;
  nomePlano: string;
  modeloReferencia: string;
  limiteTokensInputMensal: number | null;
  limiteTokensOutputMensal: number | null;
  limiteTokensTotalMensal: number | null;
  limiteCustoMensal: number | null;
  autoBloquear: boolean;
  bloqueado: boolean;
  bloqueadoMotivo: string | null;
  observacoes: string | null;
};

type ProjetoBillingSection = {
  canManage: boolean;
  windowLabel: string;
  plan: ProjetoPlanoBilling;
  currentUsage: {
    tokensInput: number;
    tokensOutput: number;
    totalTokens: number;
    custoTotal: number;
  };
  pricingModels: BillingPricingModel[];
};

type BillingPlanFormState = {
  nomePlano: string;
  modeloReferencia: string;
  limiteTokensInputMensal: string;
  limiteTokensOutputMensal: string;
  limiteTokensTotalMensal: string;
  limiteCustoMensal: string;
  autoBloquear: boolean;
  bloqueado: boolean;
  bloqueadoMotivo: string;
  observacoes: string;
};

type AgentConnectionSummary = {
  linkedApis: number;
  activeApis: number;
  widgets: number;
  activeWidgets: number;
  whatsappChannels: number;
  onlineWhatsAppChannels: number;
  connectors: number;
  activeConnectors: number;
  chats: number;
  fallbackWidgets: number;
};

type AgentConnectionsPayload = {
  apis: Array<{
    id: string;
    nome: string;
    ativo: boolean;
    parametrosObrigatorios: string[];
  }>;
  widgets: Array<{
    id?: string;
    nome: string;
    slug: string;
    ativo: boolean;
    dominio: string;
  }>;
  fallbackWidgets: Array<{
    id?: string;
    nome: string;
    slug: string;
    ativo: boolean;
  }>;
  whatsappChannels: Array<{
    id: string;
    numero: string;
    status: "ativo" | "inativo";
    connectionStatus: string;
    worker: string | null;
    lastSyncAt: string | null;
  }>;
  connectors: Array<{
    id?: string;
    nome: string;
    tipo: string;
    ativo: boolean;
    endpointBase: string;
    sellerId: string | null;
    nickname: string | null;
  }>;
  chatsRecentes: Array<{
    id: string;
    titulo: string;
    canal: string;
    updatedAt: string;
  }>;
};

type AgentDiagnosticsOverview = {
  summary: AgentConnectionSummary;
  warnings: string[];
  connections: AgentConnectionsPayload;
};

type AgentDiagnosticRun = {
  ok: boolean;
  checks: {
    agent: { ok: boolean; detail: string };
    chat: { ok: boolean; detail: string };
    whatsapp: { ok: boolean; detail: string };
    connectors: { ok: boolean; detail: string };
    apis: Array<{
      id: string;
      nome: string;
      ok: boolean;
      status: string;
      detail: string;
    }>;
  };
};

type AgentStoreSearchProduct = {
  nome: string;
  preco: number;
  imagem: string;
  link: string;
  publicadoEm: string | null;
};

type AgentStoreSearchResult = {
  termo: string;
  produtos: AgentStoreSearchProduct[];
  error: string | null;
};

type AgentStoreLatestResult = {
  connector: {
    id: string;
    nome: string;
    sellerId: string;
    nickname: string | null;
  } | null;
  produtos: AgentStoreSearchProduct[];
  error: string | null;
};

type WidgetFormState = ChatWidget & {
  id?: string;
};

type ConnectorFormState = {
  id?: string;
  nome: string;
  tipo: "mercado_livre";
  projetoId: string;
  agenteId: string | null;
  endpointBase: string;
  appId: string;
  clientSecret: string;
  sellerId: string;
  nickname: string;
  accessToken: string;
  ativo: boolean;
};

type ChatDetailState = {
  chat: Chat;
  messages: ChatMessage[];
};

type WidgetCodeModalState = {
  widget: ChatWidget;
  variant: "essencial" | "detalhado";
  essentialCode: string;
  detailedCode: string;
};

type WhatsAppChannelFormState = {
  id?: string;
  numero: string;
  agenteId: string | null;
  status: "ativo" | "inativo";
};

type PendingAgenteArquivo = {
  id: string;
  file: File;
};

const ACTIVE_PROJECT_STORAGE_KEY = "projeto_ativo";

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

function getWhatsAppServiceUrl(pathname: string, channelId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL?.trim();
  if (!baseUrl) {
    return null;
  }

  const normalizedBase = baseUrl.replace(/\/$/, "");
  return `${normalizedBase}${pathname}?channelId=${encodeURIComponent(channelId)}`;
}

function getChannelStatusTone(status: string) {
  if (status === "conectado" || status === "online") {
    return "bg-emerald-500/15 text-emerald-300";
  }

  if (status === "aguardando_qr") {
    return "bg-amber-500/15 text-amber-200";
  }

  return "bg-slate-800 text-slate-400";
}

function getChannelStatusLabel(status: string | null | undefined) {
  if (status === "online" || status === "conectado") {
    return "conectado";
  }

  if (status === "aguardando_qr") {
    return "aguardando_qr";
  }

  return "desconectado";
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

function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) {
    return "nao registrado";
  }

  return new Date(value).toLocaleString("pt-BR");
}

function formatIntegerLabel(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatUsdLabel(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);
}

function createBillingPlanForm(billing: ProjetoBillingSection | null | undefined): BillingPlanFormState {
  return {
    nomePlano: billing?.plan.nomePlano ?? "padrao",
    modeloReferencia: billing?.plan.modeloReferencia ?? "gpt-4o-mini",
    limiteTokensInputMensal: billing?.plan.limiteTokensInputMensal?.toString() ?? "",
    limiteTokensOutputMensal: billing?.plan.limiteTokensOutputMensal?.toString() ?? "",
    limiteTokensTotalMensal: billing?.plan.limiteTokensTotalMensal?.toString() ?? "",
    limiteCustoMensal: billing?.plan.limiteCustoMensal?.toString() ?? "",
    autoBloquear: billing?.plan.autoBloquear ?? true,
    bloqueado: billing?.plan.bloqueado ?? false,
    bloqueadoMotivo: billing?.plan.bloqueadoMotivo ?? "",
    observacoes: billing?.plan.observacoes ?? "",
  };
}

function isWhatsAppChatChannel(chat: Chat) {
  return chat.canal === "whatsapp";
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

function organizeHumanLine(value: string) {
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
  const sectionOrder = [
    "Contexto",
    "Objetivo",
    "Capacidades",
    "Qualificacao",
    "Regras",
    "Precificacao",
    "WhatsApp",
    "Handoff humano",
    "API",
    "Observacoes",
  ] as const;
  const buckets = new Map<string, string[]>();
  sectionOrder.forEach((section) => buckets.set(section, []));
  let currentSection: string | null = null;

  const ensureSection = (section: string) => {
    if (!buckets.has(section)) {
      buckets.set(section, []);
    }
    return buckets.get(section)!;
  };

  const classifyLine = (value: string) => {
    const normalizedValue = normalizeSummaryKey(value);

    if (
      normalizedValue.includes("objetivo") ||
      normalizedValue.includes("meta") ||
      normalizedValue.includes("missao")
    ) {
      return "Objetivo";
    }

    if (
      normalizedValue.includes("capacidade") ||
      normalizedValue.includes("o que ele faz") ||
      normalizedValue.includes("servico") ||
      normalizedValue.includes("oferta") ||
      normalizedValue.includes("solucao")
    ) {
      return "Capacidades";
    }

    if (
      normalizedValue.includes("qualific") ||
      normalizedValue.includes("pergunta") ||
      normalizedValue.includes("descobrir")
    ) {
      return "Qualificacao";
    }

    if (
      normalizedValue.includes("regra") ||
      normalizedValue.includes("tom") ||
      normalizedValue.includes("responda") ||
      normalizedValue.includes("evite") ||
      normalizedValue.includes("nunca")
    ) {
      return "Regras";
    }

    if (
      normalizedValue.includes("preco") ||
      normalizedValue.includes("valor") ||
      normalizedValue.includes("orcamento") ||
      normalizedValue.includes("tabela")
    ) {
      return "Precificacao";
    }

    if (normalizedValue.includes("whatsapp") || normalizedValue.includes("zap")) {
      return "WhatsApp";
    }

    if (
      normalizedValue.includes("handoff") ||
      normalizedValue.includes("humano") ||
      normalizedValue.includes("encaminh") ||
      normalizedValue.includes("escalar")
    ) {
      return "Handoff humano";
    }

    if (normalizedValue.includes("api") || normalizedValue.includes("integrac")) {
      return "API";
    }

    if (
      normalizedValue.includes("voce e") ||
      normalizedValue.includes("este agente") ||
      normalizedValue.includes("contexto") ||
      normalizedValue.includes("projeto")
    ) {
      return "Contexto";
    }

    return currentSection ?? "Observacoes";
  };

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const normalizedLine = organizeHumanLine(line);

    if (!normalizedLine.startsWith("- ") && /:$/.test(normalizedLine)) {
      currentSection = normalizedLine
        .replace(/:$/, "")
        .replace(/\s+/g, " ")
        .trim();
      continue;
    }

    const section = classifyLine(normalizedLine);
    const bucket = ensureSection(section);
    bucket.push(normalizedLine.replace(/^[-*]\s*/, "").trim());
  }

  const organized: string[] = [];

  for (const section of sectionOrder) {
    const items = buckets.get(section) ?? [];
    if (!items.length) {
      continue;
    }

    if (organized.length) {
      organized.push("");
    }

    organized.push(`${section}:`);

    for (const item of items) {
      const normalizedItem = item.replace(/^[-*]\s*/, "").trim();
      organized.push(
        /:$/.test(normalizedItem) && normalizedItem.length <= 40
          ? normalizedItem
          : `- ${normalizedItem}`,
      );
    }
  }

  return organized.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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

function slugifyAgentValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function applyInlineFormatting(value: string) {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function plainTextToEditorHtml(value: string) {
  const normalized = normalizeAgentText(value);
  if (!normalized) {
    return "<p></p>";
  }

  const lines = normalized.split("\n");
  const parts: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      parts.push("<p><br></p>");
      index += 1;
      continue;
    }

    if (/^- /.test(line.trim())) {
      const items: string[] = [];
      while (index < lines.length && /^- /.test((lines[index] ?? "").trim())) {
        items.push(`<li>${applyInlineFormatting((lines[index] ?? "").trim().replace(/^- /, ""))}</li>`);
        index += 1;
      }
      parts.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s/.test((lines[index] ?? "").trim())) {
        items.push(`<li>${applyInlineFormatting((lines[index] ?? "").trim().replace(/^\d+\.\s/, ""))}</li>`);
        index += 1;
      }
      parts.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    if (/:$/.test(line.trim())) {
      parts.push(`<h3>${applyInlineFormatting(line.trim().replace(/:$/, ""))}</h3>`);
      index += 1;
      continue;
    }

    parts.push(`<p>${applyInlineFormatting(line)}</p>`);
    index += 1;
  }

  return parts.join("");
}

function serializeRichInline(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const content = Array.from(node.childNodes).map((child) => serializeRichInline(child)).join("");

  if (node.tagName === "STRONG" || node.tagName === "B") {
    return content ? `**${content}**` : "";
  }

  if (node.tagName === "BR") {
    return "\n";
  }

  return content;
}

function richTextToStructuredText(html: string) {
  if (typeof window === "undefined") {
    return html;
  }

  const container = window.document.createElement("div");
  container.innerHTML = html;
  const lines: string[] = [];

  const pushLine = (value: string) => {
    const cleaned = value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    lines.push(cleaned);
  };

  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      pushLine(node.textContent ?? "");
      continue;
    }

    if (!(node instanceof HTMLElement)) {
      continue;
    }

    if (node.tagName === "UL") {
      Array.from(node.children).forEach((child) => {
        pushLine(`- ${serializeRichInline(child)}`);
      });
      continue;
    }

    if (node.tagName === "OL") {
      Array.from(node.children).forEach((child, index) => {
        pushLine(`${index + 1}. ${serializeRichInline(child)}`);
      });
      continue;
    }

    if (/^H\d$/.test(node.tagName)) {
      pushLine(`${serializeRichInline(node)}:`);
      continue;
    }

    if (node.tagName === "P" || node.tagName === "DIV") {
      pushLine(serializeRichInline(node));
      continue;
    }

    pushLine(serializeRichInline(node));
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function parseAgentSummarySections(summary: string) {
  const normalized = compactAgentSummary(summary);
  const lines = normalized ? normalized.split("\n") : [];
  const sections: Record<string, string[]> = {};
  let currentSection = "geral";

  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (!line.startsWith("- ") && /:$/.test(line)) {
      currentSection = line.replace(/:$/, "").trim();
      if (!sections[currentSection]) {
        sections[currentSection] = [];
      }
      continue;
    }

    if (!sections[currentSection]) {
      sections[currentSection] = [];
    }

    sections[currentSection].push(line.replace(/^[-*]\s*/, "").trim());
  }

  return {
    normalized,
    sections,
  };
}

function buildAgentConfigFromSummary(summary: string) {
  const { normalized, sections } = parseAgentSummarySections(summary);
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
  const descricaoCurta = inferShortDescription(normalized || summary) || objetivo;
  const sectionAliases: Record<string, string> = {
    Contexto: "contexto",
    Objetivo: "objetivo",
    Capacidades: "capacidades",
    Qualificacao: "qualificacao",
    Regras: "regras",
    Precificacao: "precificacao",
    WhatsApp: "whatsapp",
    "Handoff humano": "handoff_humano",
    API: "api",
    Observacoes: "observacoes",
    geral: "geral",
  };
  const sourceSections = Object.fromEntries(
    Object.entries(sections)
      .map(([key, value]) => [sectionAliases[key] ?? normalizeSummaryKey(key).replace(/\s+/g, "_"), value])
      .filter(([, value]) => Array.isArray(value) && value.length > 0),
  );
  const runtime = {
    version: 1,
    overview: {
      objetivo,
      descricao_curta: descricaoCurta,
    },
    blocks: {
      core: [objetivo, ...capacidades.slice(0, 4)].filter(Boolean),
      qualification: perguntasQualificacao.slice(0, 5),
      pricing: regrasPrecificacao.slice(0, 6),
      handoff: handoff.slice(0, 5),
      whatsapp: [
        cta.join(" ").trim(),
        ...handoff.filter((item) => /whats|zap|telefone|fech|encaminh/i.test(item)),
      ]
        .filter(Boolean)
        .slice(0, 5),
      notes: observacoes.slice(0, 5),
    },
    routes: {
      greeting: ["core"],
      default: ["core", "qualification"],
      pricing: ["core", "pricing", "qualification"],
      whatsapp: ["core", "whatsapp", "handoff"],
      api: ["core", "qualification"],
    },
  };
  const config: Record<string, unknown> = {
    objetivo,
    resumo_organizado: normalized,
    secoes_fonte: sourceSections,
    capacidades: capacidades.slice(0, 8),
    perguntas_qualificacao: perguntasQualificacao.slice(0, 5),
    handoff: {
      enviar_para_humano_se: handoff.slice(0, 5),
    },
    runtime,
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

function RuntimeRoutePill({ label, blocks }: { label: string; blocks: string[] }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-xs leading-5 text-slate-300">{blocks.join(" -> ")}</p>
    </div>
  );
}

function AgentRuntimePreview({ rawConfig }: { rawConfig: string }) {
  const [expanded, setExpanded] = useState(false);
  let parsed: Record<string, unknown> | null = null;

  try {
    parsed = JSON.parse(rawConfig) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  const runtime = normalizeAgentRuntimeConfig(parsed?.runtime);
  if (!runtime) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 px-4 py-4 text-sm text-slate-400">
        Valide o resumo para gerar o kit operacional enxuto do agente.
      </div>
    );
  }

  const entries = getAgentRuntimeBlockEntries(runtime);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="group w-full rounded-[22px] border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(3,105,80,0.1))] px-4 py-4 text-left transition-[background-image,border-color,opacity] duration-200 ease-out hover:border-emerald-400/35 hover:bg-[linear-gradient(135deg,rgba(16,185,129,0.22),rgba(5,150,105,0.14))]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">Kit de execucao</p>
            <p className="mt-2 text-sm font-semibold text-white">{runtime.overview.descricao_curta || runtime.overview.objetivo}</p>
            <p className="mt-2 text-xs leading-6 text-emerald-50/80">
              Esse e o pacote curto que o orquestrador deve preferir no runtime, em vez de carregar o resumo inteiro a cada mensagem.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white transition-colors group-hover:bg-white/15">
            {expanded ? "Recolher" : "Expandir"}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {entries.slice(0, 4).map((entry) => (
            <span key={`pill-${entry.key}`} className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-50">
              {entry.key}
            </span>
          ))}
        </div>
      </button>

      <div
        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="min-h-0 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <RuntimeRoutePill label="Saudacao" blocks={runtime.routes.greeting} />
            <RuntimeRoutePill label="Inicio" blocks={runtime.routes.default} />
            <RuntimeRoutePill label="Preco" blocks={runtime.routes.pricing} />
            <RuntimeRoutePill label="WhatsApp" blocks={runtime.routes.whatsapp} />
            <RuntimeRoutePill label="API" blocks={runtime.routes.api} />
          </div>

          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.key} className="rounded-xl border border-white/8 bg-slate-950/45 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{entry.key}</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">
                    {entry.lines.length} linhas
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {entry.lines.map((line) => (
                    <p key={`${entry.key}-${line}`} className="text-xs leading-5 text-slate-300">
                      - {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
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

type ProjectTab = "agentes" | "apis" | "whatsapp" | "mercado" | "chats";

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

const emptyConnectorForm: ConnectorFormState = {
  nome: "",
  tipo: "mercado_livre",
  projetoId: "",
  agenteId: null,
  endpointBase: "https://api.mercadolibre.com",
  appId: "",
  clientSecret: "",
  sellerId: "",
  nickname: "",
  accessToken: "",
  ativo: true,
};

const emptyWhatsAppChannelForm: WhatsAppChannelFormState = {
  numero: "",
  agenteId: null,
  status: "ativo",
};

function FormLabel({ children }: { children: string }) {
  return <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{children}</label>;
}

const primaryActionButtonClass =
  "infra-click-pulse inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-50 shadow-[0_6px_18px_rgba(56,189,248,0.08)] transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out hover:border-sky-300/30 hover:bg-sky-400/14 disabled:cursor-not-allowed disabled:opacity-60";

const headerActionButtonClass =
  "infra-click-pulse inline-flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-50 shadow-[0_6px_18px_rgba(56,189,248,0.08)] transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out hover:border-sky-300/30 hover:bg-sky-400/14";

const neutralActionButtonClass =
  "infra-click-pulse inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60";

const successActionButtonClass =
  "infra-click-pulse inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-50 shadow-[0_6px_18px_rgba(16,185,129,0.08)] transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out hover:border-emerald-300/30 hover:bg-emerald-500/14 disabled:cursor-not-allowed disabled:opacity-60";

const dangerActionButtonClass =
  "infra-click-pulse inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-50 shadow-[0_6px_18px_rgba(244,63,94,0.08)] transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out hover:border-rose-300/30 hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60";

const warningActionButtonClass =
  "infra-click-pulse inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-50 shadow-[0_6px_18px_rgba(245,158,11,0.08)] transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out hover:border-amber-300/30 hover:bg-amber-500/14 disabled:cursor-not-allowed disabled:opacity-60";

function PremiumLoader({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center justify-center ${compact ? "min-h-[120px]" : "min-h-[220px]"}`}>
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute h-20 w-20 rounded-full bg-sky-500/20 blur-2xl animate-pulse" />
        <div className="absolute h-14 w-14 rounded-full bg-cyan-400/15 blur-xl animate-pulse" />
        <Image src="/logo.png" alt="InfraStudio" width={38} height={38} className="relative h-10 w-10 object-contain" />
      </div>
    </div>
  );
}

function BusyIcon() {
  return <LoaderCircle size={15} className="animate-spin" />;
}

function ModalStickyFooter({
  children,
  feedback,
}: {
  children: ReactNode;
  feedback?: string | null;
}) {
  return (
    <div className="sticky bottom-0 border-t border-white/10 bg-brand-dark/95 px-6 py-4 shadow-[0_-18px_40px_rgba(2,8,23,0.38)] backdrop-blur">
      <div className="flex flex-wrap gap-3">{children}</div>
      {feedback ? <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</div> : null}
    </div>
  );
}

function DeleteProjectModal({
  open,
  projectName,
  confirmationValue,
  saving,
  onChangeConfirmation,
  onClose,
  onConfirm,
}: {
  open: boolean;
  projectName: string;
  confirmationValue: string;
  saving: boolean;
  onChangeConfirmation: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  const confirmationMatches = confirmationValue.trim() === projectName.trim();

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/82 px-4 py-6 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-[28px] border border-rose-400/18 bg-[#07111f] shadow-[0_30px_80px_rgba(2,6,23,0.75)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-rose-100">
              <Trash2 size={13} />
              Exclusao permanente
            </div>
            <h2 className="mt-3 text-2xl font-extrabold text-white">Remover projeto e todos os dados relacionados</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Esta acao apaga o projeto <span className="font-semibold text-white">{projectName}</span> de forma permanente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`${neutralActionButtonClass} px-3 disabled:opacity-60`}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-rose-400/18 bg-rose-500/10 p-4">
            <p className="text-sm font-semibold text-rose-50">Tudo abaixo sera removido junto com o projeto:</p>
            <p className="mt-2 text-sm leading-6 text-rose-100/90">
              agentes, APIs, fontes de produto, widgets, canais WhatsApp, chats, logs, configuracoes e vinculos relacionados.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Confirmacao obrigatoria</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Para continuar, digite exatamente o nome do projeto:
              <span className="ml-2 font-semibold text-white">{projectName}</span>
            </p>
            <input
              value={confirmationValue}
              onChange={(event) => onChangeConfirmation(event.target.value)}
              placeholder={projectName}
              disabled={saving}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-rose-400/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {!confirmationMatches && confirmationValue.trim() ? (
              <p className="mt-2 text-xs text-amber-200">O nome digitado precisa ser exatamente igual ao nome do projeto.</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving || !confirmationMatches}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/12 px-4 py-3 text-sm font-semibold text-rose-50 transition-colors hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={15} />
              {saving ? "Removendo projeto..." : "Remover projeto permanentemente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteConnectorModal({
  open,
  connectorName,
  confirmationValue,
  saving,
  onChangeConfirmation,
  onClose,
  onConfirm,
}: {
  open: boolean;
  connectorName: string;
  confirmationValue: string;
  saving: boolean;
  onChangeConfirmation: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  const confirmationMatches = confirmationValue.trim() === connectorName.trim();

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/82 px-4 py-6 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-[28px] border border-rose-400/18 bg-[#07111f] shadow-[0_30px_80px_rgba(2,6,23,0.75)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-rose-100">
              <Trash2 size={13} />
              Exclusao permanente
            </div>
            <h2 className="mt-3 text-2xl font-extrabold text-white">Remover loja do Mercado Livre</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Esta acao apaga a loja <span className="font-semibold text-white">{connectorName}</span> deste projeto.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`${neutralActionButtonClass} px-3 disabled:opacity-60`}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-rose-400/18 bg-rose-500/10 p-4">
            <p className="text-sm font-semibold text-rose-50">O que sera removido:</p>
            <p className="mt-2 text-sm leading-6 text-rose-100/90">
              credenciais da loja, configuracao do conector, vinculo com agente e acesso OAuth relacionados a esta integracao.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Confirmacao obrigatoria</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Para continuar, digite exatamente o nome da loja:
              <span className="ml-2 font-semibold text-white">{connectorName}</span>
            </p>
            <input
              value={confirmationValue}
              onChange={(event) => onChangeConfirmation(event.target.value)}
              placeholder={connectorName}
              disabled={saving}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-rose-400/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {!confirmationMatches && confirmationValue.trim() ? (
              <p className="mt-2 text-xs text-amber-200">O nome digitado precisa ser exatamente igual ao nome da loja.</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving || !confirmationMatches}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/12 px-4 py-3 text-sm font-semibold text-rose-50 transition-colors hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={15} />
              {saving ? "Removendo loja..." : "Remover loja permanentemente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteAgenteModal({
  open,
  agenteName,
  confirmationValue,
  saving,
  onChangeConfirmation,
  onClose,
  onConfirm,
}: {
  open: boolean;
  agenteName: string;
  confirmationValue: string;
  saving: boolean;
  onChangeConfirmation: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  const confirmationMatches = confirmationValue.trim() === agenteName.trim();

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/82 px-4 py-6 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-[28px] border border-rose-400/18 bg-[#07111f] shadow-[0_30px_80px_rgba(2,6,23,0.75)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-rose-100">
              <Trash2 size={13} />
              Exclusao permanente
            </div>
            <h2 className="mt-3 text-2xl font-extrabold text-white">Remover agente</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Esta acao apaga o agente <span className="font-semibold text-white">{agenteName}</span> deste projeto.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`${neutralActionButtonClass} px-3 disabled:opacity-60`}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-rose-400/18 bg-rose-500/10 p-4">
            <p className="text-sm font-semibold text-rose-50">Tudo abaixo sera removido junto com o agente:</p>
            <p className="mt-2 text-sm leading-6 text-rose-100/90">
              arquivos, widgets, canais WhatsApp, conectores e chats vinculados diretamente a este agente.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Confirmacao obrigatoria</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Para continuar, digite exatamente o nome do agente:
              <span className="ml-2 font-semibold text-white">{agenteName}</span>
            </p>
            <input
              value={confirmationValue}
              onChange={(event) => onChangeConfirmation(event.target.value)}
              placeholder={agenteName}
              disabled={saving}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-rose-400/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {!confirmationMatches && confirmationValue.trim() ? (
              <p className="mt-2 text-xs text-amber-200">O nome digitado precisa ser exatamente igual ao nome do agente.</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving || !confirmationMatches}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/12 px-4 py-3 text-sm font-semibold text-rose-50 transition-colors hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={15} />
              {saving ? "Removendo agente..." : "Remover agente permanentemente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteWhatsAppChannelModal({
  open,
  channelName,
  confirmationValue,
  saving,
  onChangeConfirmation,
  onClose,
  onConfirm,
}: {
  open: boolean;
  channelName: string;
  confirmationValue: string;
  saving: boolean;
  onChangeConfirmation: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  const confirmationMatches = confirmationValue.trim() === channelName.trim();

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/82 px-4 py-6 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-[28px] border border-rose-400/18 bg-[#07111f] shadow-[0_30px_80px_rgba(2,6,23,0.75)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-rose-100">
              <Trash2 size={13} />
              Exclusao permanente
            </div>
            <h2 className="mt-3 text-2xl font-extrabold text-white">Remover canal WhatsApp</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Esta acao apaga o canal <span className="font-semibold text-white">{channelName}</span> deste projeto.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`${neutralActionButtonClass} px-3 disabled:opacity-60`}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-rose-400/18 bg-rose-500/10 p-4">
            <p className="text-sm font-semibold text-rose-50">O que sera removido:</p>
            <p className="mt-2 text-sm leading-6 text-rose-100/90">
              cadastro do numero, sessao conectada, QR atual e configuracao do canal WhatsApp deste projeto.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Confirmacao obrigatoria</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Para continuar, digite exatamente o numero do canal:
              <span className="ml-2 font-semibold text-white">{channelName}</span>
            </p>
            <input
              value={confirmationValue}
              onChange={(event) => onChangeConfirmation(event.target.value)}
              placeholder={channelName}
              disabled={saving}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-rose-400/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {!confirmationMatches && confirmationValue.trim() ? (
              <p className="mt-2 text-xs text-amber-200">O numero digitado precisa ser exatamente igual ao canal informado.</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving || !confirmationMatches}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/12 px-4 py-3 text-sm font-semibold text-rose-50 transition-colors hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={15} />
              {saving ? "Removendo canal..." : "Remover canal permanentemente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
  agentes,
  widgets,
  whatsappChannels,
  connectors,
  pendingArquivos,
  saving,
  connectionSavingKey,
  feedback,
  onClose,
  onChange,
  onAddFiles,
  onRemovePendingFile,
  onRemoveUploadedFile,
  onValidateSummary,
  onAssignWidget,
  onAssignWhatsApp,
  onAssignConnector,
  onSubmit,
}: {
  open: boolean;
  form: AgenteFormState;
  apis: Api[];
  agentes: Agente[];
  widgets: ChatWidget[];
  whatsappChannels: WhatsAppChannel[];
  connectors: Connector[];
  pendingArquivos: PendingAgenteArquivo[];
  saving: boolean;
  connectionSavingKey: string | null;
  feedback: string | null;
  onClose: () => void;
  onChange: (next: Partial<AgenteFormState>) => void;
  onAddFiles: (files: FileList | null) => void;
  onRemovePendingFile: (id: string) => void;
  onRemoveUploadedFile: (id: string) => void;
  onValidateSummary: () => void;
  onAssignWidget: (widgetId: string) => void;
  onAssignWhatsApp: (channelId: string) => void;
  onAssignConnector: (connectorId: string) => void;
  onSubmit: () => void;
}) {
  const [showRawConfig, setShowRawConfig] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(true);
  const [connectionsExpanded, setConnectionsExpanded] = useState(false);
  const [apisExpanded, setApisExpanded] = useState(false);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const lastPromptSyncRef = useRef("");

  useEffect(() => {
    if (open) {
      setShowRawConfig(false);
      setPromptExpanded(true);
      setConnectionsExpanded(false);
      setApisExpanded(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const element = promptRef.current;
    if (!element) {
      return;
    }

    const nextHtml = plainTextToEditorHtml(form.promptBase);
    const normalizedPrompt = normalizeAgentText(form.promptBase);

    if (lastPromptSyncRef.current !== normalizedPrompt) {
      element.innerHTML = nextHtml;
      lastPromptSyncRef.current = normalizedPrompt;
    }
  }, [form.promptBase, open]);

  if (!open) {
    return null;
  }

  const selectedAgentId = form.id ?? null;
  const selectedAgentName = form.nome.trim() || "este agente";
  const selectedApiCount = form.apiIds.length;
  const selectedApiInactiveCount = apis.filter((api) => form.apiIds.includes(api.id) && !api.ativo).length;
  const selectedApiRequiredParams = apis
    .filter((api) => form.apiIds.includes(api.id))
    .flatMap((api) => api.parametros.filter((parametro) => parametro.obrigatorio))
    .filter((parametro, index, array) => array.findIndex((item) => item.nome.toLowerCase() === parametro.nome.toLowerCase()) === index);
  const canManageConnections = Boolean(selectedAgentId);
  const findAgentName = (agenteId: string | null | undefined) =>
    agentes.find((agente) => agente.id === agenteId)?.nome ?? "Agente nao encontrado";

  const widgetEntries = widgets.map((widget) => {
    const assignedToCurrent = Boolean(selectedAgentId) && widget.agenteId === selectedAgentId;
    const assignedElsewhere = Boolean(widget.agenteId) && widget.agenteId !== selectedAgentId;
    const savingKey = `widget:${widget.id ?? widget.slug}`;
    return {
      id: widget.id ?? widget.slug,
      title: widget.nome,
      subtitle: widget.dominio || widget.slug,
      assignedToCurrent,
      assignedElsewhere,
      assignedAgentName: widget.agenteId ? findAgentName(widget.agenteId) : null,
      saving: connectionSavingKey === savingKey,
      onAssign: widget.id ? () => onAssignWidget(widget.id!) : null,
      actionLabel: assignedToCurrent ? "Desativar chat" : assignedElsewhere ? "Trazer para este agente" : "Selecionar chat",
    };
  });

  const whatsappEntries = whatsappChannels.map((channel) => {
    const assignedToCurrent = Boolean(selectedAgentId) && channel.agenteId === selectedAgentId;
    const assignedElsewhere = Boolean(channel.agenteId) && channel.agenteId !== selectedAgentId;
    const savingKey = `whatsapp:${channel.id}`;
    return {
      id: channel.id,
      title: formatWhatsAppPhone(channel.numero),
      subtitle: `${channel.status} | ${channel.sessionData?.connectionStatus ?? "offline"}`,
      assignedToCurrent,
      assignedElsewhere,
      assignedAgentName: channel.agenteId ? findAgentName(channel.agenteId) : null,
      saving: connectionSavingKey === savingKey,
      onAssign: () => onAssignWhatsApp(channel.id),
      actionLabel: assignedToCurrent ? "Desativar neste agente" : assignedElsewhere ? "Mover para este agente" : "Ativar neste agente",
    };
  });

  const connectorEntries = connectors
    .filter((connector) => connector.tipo === "mercado_livre")
    .map((connector) => {
      const assignedToCurrent = Boolean(selectedAgentId) && connector.agenteId === selectedAgentId;
      const assignedElsewhere = Boolean(connector.agenteId) && connector.agenteId !== selectedAgentId;
      const savingKey = `connector:${connector.id ?? connector.nome}`;
      return {
        id: connector.id ?? connector.nome,
        title: connector.nome,
        subtitle: connector.configuracoes?.nickname || connector.configuracoes?.seller_id || connector.endpointBase,
        assignedToCurrent,
        assignedElsewhere,
        assignedAgentName: connector.agenteId ? findAgentName(connector.agenteId) : null,
        saving: connectionSavingKey === savingKey,
        onAssign: connector.id ? () => onAssignConnector(connector.id!) : null,
        actionLabel: assignedToCurrent ? "Desativar neste agente" : assignedElsewhere ? "Mover para este agente" : "Ativar neste agente",
      };
    });

  const renderConnectionCard = (
    icon: ReactNode,
    title: string,
    description: string,
    entries: Array<{
      id: string;
      title: string;
      subtitle: string;
      assignedToCurrent: boolean;
      assignedElsewhere: boolean;
      assignedAgentName: string | null;
      saving: boolean;
      onAssign: (() => void) | null;
      actionLabel: string;
    }>,
    emptyMessage: string,
  ) => (
    <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-100">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>
      </div>

      {!canManageConnections ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-400">
          Salve o agente primeiro para vincular conexoes.
        </div>
      ) : entries.length ? (
        <div className="mt-4 space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{entry.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{entry.subtitle}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {entry.assignedToCurrent
                      ? `Vinculado a ${selectedAgentName}.`
                      : entry.assignedElsewhere
                        ? `Hoje vinculado a ${entry.assignedAgentName}.`
                        : "Ainda sem agente vinculado."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => entry.onAssign?.()}
                  disabled={!entry.onAssign || entry.saving || saving}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    entry.assignedToCurrent
                      ? "border-rose-500/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                      : "border-cyan-500/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                  }`}
                >
                  {entry.saving ? <BusyIcon /> : <Cable size={14} />}
                  {entry.actionLabel}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-400">
          {emptyMessage}
        </div>
      )}
    </div>
  );

  const updatePromptBase = (nextHtml: string) => {
    const nextPrompt = richTextToStructuredText(nextHtml);
    lastPromptSyncRef.current = normalizeAgentText(nextPrompt);
    onChange({ promptBase: nextPrompt });
  };

  const applyPromptFormat = (mode: "bold" | "title" | "bullet" | "numbered") => {
    const element = promptRef.current;
    if (!element) {
      return;
    }

    element.focus();

    if (mode === "bold") {
      document.execCommand("bold");
    }

    if (mode === "title") {
      document.execCommand("formatBlock", false, "h3");
    }

    if (mode === "bullet") {
      document.execCommand("insertUnorderedList");
    }

    if (mode === "numbered") {
      document.execCommand("insertOrderedList");
    }

    updatePromptBase(element.innerHTML);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className={`max-h-[92vh] w-full overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl transition-all duration-300 ${promptExpanded ? "max-w-6xl" : "max-w-5xl"}`}>
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Agente</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{form.id ? "Editar agente" : "Novo agente"}</h2>
            <p className="mt-1 text-sm text-slate-400">Defina o agente e selecione quais APIs deste projeto ele pode usar.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${neutralActionButtonClass} px-3`}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex max-h-[calc(92vh-88px)] flex-col">
          <div className={`grid flex-1 gap-0 overflow-x-hidden overflow-y-auto ${connectionsExpanded ? "lg:grid-cols-[1.05fr_0.95fr]" : "lg:grid-cols-[minmax(0,1fr)_112px]"}`}>
          <div className="min-w-0 space-y-4 p-6 pb-8">
            <div>
              <FormLabel>Nome do agente</FormLabel>
              <input value={form.nome} onChange={(event) => onChange({ nome: event.target.value })} placeholder="Agente comercial principal" className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <FormLabel>Resumo do agente</FormLabel>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPromptExpanded((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {promptExpanded ? <Minimize2 size={14} /> : <Expand size={14} />}
                    {promptExpanded ? "Recolher" : "Maximizar"}
                  </button>
                  <button
                    type="button"
                    onClick={onValidateSummary}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20"
                  >
                    <Sparkles size={14} />
                    Validar e organizar
                  </button>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-slate-950/35 p-2">
                <button
                  type="button"
                  onClick={() => applyPromptFormat("bold")}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Bold size={14} />
                  Negrito
                </button>
                <button
                  type="button"
                  onClick={() => applyPromptFormat("title")}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Heading size={14} />
                  Titulo
                </button>
                <button
                  type="button"
                  onClick={() => applyPromptFormat("bullet")}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <List size={14} />
                  Lista
                </button>
                <button
                  type="button"
                  onClick={() => applyPromptFormat("numbered")}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ListOrdered size={14} />
                  Numerada
                </button>
              </div>
              <div
                ref={promptRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => updatePromptBase(event.currentTarget.innerHTML)}
                className={`w-full overflow-y-auto rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white outline-none transition-all duration-300 [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-bold [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_strong]:font-extrabold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 ${promptExpanded ? "min-h-[560px]" : "min-h-[290px]"}`}
              />
              <p className="mt-2 text-xs text-slate-400">Preencha o resumo do agente. O slug e a descricao curta sao gerados automaticamente em segundo plano.</p>
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
            <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
              <div className="mb-4">
                <p className="text-sm font-semibold text-white">Runtime compilado</p>
                <p className="mt-1 text-xs text-slate-400">Preview do kit enxuto que o orquestrador deve usar no atendimento para reduzir token sem perder o rumo.</p>
              </div>
              <AgentRuntimePreview rawConfig={form.configuracoes} />
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

          <div className={`min-w-0 border-t border-white/10 bg-white/[0.03] transition-all duration-300 lg:border-t-0 ${connectionsExpanded ? "p-6 pb-8 lg:border-l" : "p-4 lg:border-l lg:px-3 lg:py-4"}`}>
            <div className={`flex gap-3 ${connectionsExpanded ? "items-start justify-between" : "justify-end"}`}>
              {connectionsExpanded ? (
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Conexoes do agente</p>
                  <p className="mt-1 text-xs text-slate-400">Expanda so quando quiser revisar os vinculos, APIs e arquivos deste agente.</p>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${form.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                  {form.ativo ? "ativo" : "inativo"}
                </span>
                <button
                  type="button"
                  onClick={() => setConnectionsExpanded((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {connectionsExpanded ? <Minimize2 size={14} /> : <Expand size={14} />}
                  <span className={connectionsExpanded ? "inline" : "hidden lg:inline"}>{connectionsExpanded ? "Recolher" : "Expandir"}</span>
                </button>
              </div>
            </div>

            {connectionsExpanded ? (
              <div className="mt-4">
            <div className="hidden mb-5 rounded-2xl border border-cyan-500/15 bg-cyan-500/10 p-5">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950/20 text-cyan-100">
                <Bot size={22} />
              </div>
              <p className="text-lg font-bold text-white">{form.nome || "Agente sem nome"}</p>
              <p className="mt-2 text-sm leading-relaxed text-cyan-50">{form.descricao || "Defina o papel comercial e o comportamento desse agente para o projeto selecionado."}</p>
            </div>

            {renderConnectionCard(
              <PanelsTopLeft size={18} />,
              "Chat widget",
              "Se o widget ja existir, voce pode trazer o atendimento para este agente. Se ele estiver em outro agente, a troca remove o vinculo anterior.",
              widgetEntries,
              "Nenhum widget cadastrado neste projeto.",
            )}

            <div className="mt-4">
              {renderConnectionCard(
                <MessageSquare size={18} />,
                "WhatsApp",
                "O canal WhatsApp do projeto pode ser ativado neste agente. Se hoje estiver em outro agente, o sistema transfere o vinculo.",
                whatsappEntries,
                "Nenhum canal WhatsApp cadastrado neste projeto.",
              )}
            </div>

            <div className="mt-4">
              {renderConnectionCard(
                <Boxes size={18} />,
                "Mercado Livre",
                "A integracao do Mercado Livre pode ficar visivel neste agente. Quando ja estiver em outro agente, a mudanca transfere o acesso.",
                connectorEntries,
                "Nenhuma integracao Mercado Livre cadastrada neste projeto.",
              )}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/30 p-4">
              <button
                type="button"
                onClick={() => setApisExpanded((current) => !current)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-white">APIs disponiveis para este agente</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedApiCount
                      ? `${selectedApiCount} API(s) selecionada(s) para este agente.`
                      : "Escolha quais APIs este agente pode usar no atendimento."}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200">
                  {apisExpanded ? "Recolher" : "Expandir"}
                  <ChevronDown size={14} className={`transition-transform ${apisExpanded ? "rotate-180" : ""}`} />
                </span>
              </button>

              {apisExpanded ? (
                <div className="mt-4 space-y-2">
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
              ) : null}
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

            {selectedApiCount ? (
              <div className="mt-4 space-y-3">
                {selectedApiInactiveCount ? (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    APIs inativas vinculadas:{" "}
                    {apis
                      .filter((api) => form.apiIds.includes(api.id) && !api.ativo)
                      .map((api) => api.nome)
                      .join(", ")}
                    . O agente so consulta APIs marcadas como ativas.
                  </div>
                ) : null}
                {selectedApiRequiredParams.length ? (
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                    Para o agente consultar essas APIs no chat, envie no contexto:{" "}
                    {selectedApiRequiredParams.map((parametro) => parametro.nome).join(", ")}
                    .
                  </div>
                ) : null}
              </div>
            ) : null}
              </div>
            ) : (
              <div className="flex min-h-[72px] items-start justify-end lg:min-h-[640px]">
                <div className="rounded-2xl border border-white/8 bg-slate-950/30 px-3 py-3 shadow-[0_10px_24px_rgba(2,8,23,0.12)]">
                  <p className="text-right text-[11px] font-semibold leading-relaxed text-slate-400">
                    Conexoes recolhidas.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
          <ModalStickyFooter feedback={feedback}>
            <button
              type="button"
              onClick={() => onChange({ ativo: !form.ativo })}
              disabled={saving}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                form.ativo
                  ? "border-amber-400/20 bg-amber-500/10 text-amber-50 hover:border-amber-300/30 hover:bg-amber-500/14"
                  : "border-emerald-400/20 bg-emerald-500/10 text-emerald-50 hover:border-emerald-300/30 hover:bg-emerald-500/14"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Power size={16} />
              {form.ativo ? "Desativar agente" : "Ativar agente"}
            </button>
            <button type="button" onClick={onSubmit} disabled={saving} className={`${primaryActionButtonClass} flex-1`}>
              {saving ? <BusyIcon /> : form.id ? <Pencil size={16} /> : <Plus size={16} />}
              {form.id ? "Salvar" : "Criar"}
            </button>
            <button type="button" onClick={onClose} className={neutralActionButtonClass}>
              Cancelar
            </button>
          </ModalStickyFooter>
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
            className={`${neutralActionButtonClass} px-3`}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex max-h-[calc(92vh-88px)] flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4 pb-24">
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
                <button type="button" onClick={onTest} disabled={testing || saving} className={primaryActionButtonClass}>
                  {testing ? <BusyIcon /> : <TestTube2 size={15} />}
                  Testar
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

          <ModalStickyFooter feedback={feedback}>
            <button type="button" onClick={onSubmit} disabled={saving} className={`${primaryActionButtonClass} flex-1`}>
              {saving ? <BusyIcon /> : form.id ? <Pencil size={16} /> : <Plus size={16} />}
              {form.id ? "Salvar" : "Criar"}
            </button>
            <button type="button" onClick={onClose} className={neutralActionButtonClass}>
              Cancelar
            </button>
          </ModalStickyFooter>
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

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Widget</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{form.id ? "Editar widget" : "Novo widget"}</h2>
            <p className="mt-1 text-sm text-slate-400">Este widget ja nasce vinculado ao projeto atual para evitar ambiguidades na abertura do chat.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${neutralActionButtonClass} px-3`}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex max-h-[calc(92vh-88px)] flex-col">
          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-28">
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
                onChange={(event) => onChange({ whatsappCelular: event.target.value })}
                placeholder="+55 11 99999-9999"
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
              <p className="mt-2 text-xs text-slate-400">Pode digitar ou colar livremente. O sistema limpa e salva apenas os numeros.</p>
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
              <option value="">Selecione um agente</option>
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

            
          </div>
        </div>
          <ModalStickyFooter feedback={feedback}>
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving}
              className={`${primaryActionButtonClass} flex-1`}
            >
              {saving ? <BusyIcon /> : form.id ? <Pencil size={16} /> : <Plus size={16} />}
              {form.id ? "Salvar" : "Criar"}
            </button>
            <button type="button" onClick={onClose} className={neutralActionButtonClass}>
              Cancelar
            </button>
          </ModalStickyFooter>
        </div>
      </div>
    </div>
  );
}

function ConnectorModal({
  open,
  form,
  agentes,
  saving,
  feedback,
  copiedTutorial,
  onClose,
  onChange,
  onCopyTutorial,
  onSubmit,
}: {
  open: boolean;
  form: ConnectorFormState;
  agentes: Agente[];
  saving: boolean;
  feedback: string | null;
  copiedTutorial: boolean;
  onClose: () => void;
  onChange: (next: Partial<ConnectorFormState>) => void;
  onCopyTutorial: () => void;
  onSubmit: () => void;
}) {
  const [tutorialOpen, setTutorialOpen] = useState(false);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Integracao</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{form.id ? "Editar integracao" : "Nova integracao"}</h2>
            <p className="mt-1 text-sm text-slate-400">Use este cadastro para o agente buscar produtos no Mercado Livre sem expor a resposta bruta da API.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`${neutralActionButtonClass} px-3`}
              aria-label="Fechar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex max-h-[calc(92vh-88px)] flex-col">
          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-28">
          <div className="space-y-4">
            <div>
              <FormLabel>Nome</FormLabel>
              <input
                value={form.nome}
                onChange={(event) => onChange({ nome: event.target.value })}
                placeholder="Loja Mercado Livre"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div>
              <FormLabel>Agente</FormLabel>
              <select
                value={form.agenteId ?? ""}
                onChange={(event) => onChange({ agenteId: event.target.value || null })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
              >
                <option value="">Selecione um agente</option>
                {agentes.map((agente) => (
                  <option key={agente.id} value={agente.id}>
                    {agente.nome}
                    {agente.ativo ? " (ativo)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FormLabel>APP ID do Mercado Livre</FormLabel>
              <input
                value={form.appId}
                onChange={(event) => onChange({ appId: event.target.value })}
                placeholder="1234567890123456"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
              <p className="mt-2 text-xs text-slate-400">Obrigatorio para o usuario concluir o OAuth da propria conta sem depender da configuracao global do servidor.</p>
            </div>
            <div>
              <FormLabel>CLIENT SECRET do Mercado Livre</FormLabel>
              <input
                type="password"
                value={form.clientSecret}
                onChange={(event) => onChange({ clientSecret: event.target.value })}
                placeholder="Cole o segredo da aplicacao"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div>
              <FormLabel>Seller ID</FormLabel>
              <input
                value={form.sellerId}
                onChange={(event) => onChange({ sellerId: event.target.value })}
                placeholder="123456789"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div>
              <FormLabel>Nickname opcional</FormLabel>
              <input
                value={form.nickname}
                onChange={(event) => onChange({ nickname: event.target.value })}
                placeholder="minha_loja"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div>
              <FormLabel>Access token do Mercado Livre</FormLabel>
              <input
                type="password"
                value={form.accessToken}
                onChange={(event) => onChange({ accessToken: event.target.value })}
                placeholder="APP_USR-..."
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
              <p className="mt-2 text-xs text-slate-400">Opcional para busca publica. Necessario para listar os ultimos produtos da loja quando a API exigir autenticacao.</p>
            </div>
            <div>
              <FormLabel>URL base para gestao</FormLabel>
              <input
                value={form.endpointBase}
                onChange={(event) => onChange({ endpointBase: event.target.value })}
                placeholder="https://api.mercadolibre.com"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
              <p className="mt-2 text-xs text-slate-400">Use a URL base do ambiente usado na integracao para gerir a conta e o OAuth entre usuarios.</p>
            </div>
            {!form.id ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                Salve a integracao primeiro para habilitar o botao <span className="font-semibold">Conectar Mercado Livre</span> e concluir o OAuth automatico.
              </div>
            ) : null}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Cadastro guiado do app Mercado Livre</p>
                  <p className="mt-1 text-xs text-cyan-100/80">Abra o mini tutorial para ver os links, campos e permissoes que o usuario precisa preencher.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTutorialOpen((current) => !current)}
                    className={primaryActionButtonClass}
                  >
                    {tutorialOpen ? <Minimize2 size={14} /> : <Expand size={14} />}
                    {tutorialOpen ? "Fechar tutorial" : "Mini tutorial"}
                  </button>
                  <button
                    type="button"
                    onClick={onCopyTutorial}
                    className={primaryActionButtonClass}
                  >
                    {copiedTutorial ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    {copiedTutorial ? "Copiado" : "Copiar tutorial"}
                  </button>
                </div>
              </div>
              {tutorialOpen ? <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 px-4 py-4 text-xs leading-6 text-slate-200">
                <p>Abre esse link:</p>
                <p className="font-semibold text-white">https://developers.mercadolivre.com.br/apps</p>
                <p className="mt-3">Clica em “Criar aplicação”</p>
                <p className="mt-3">Preenche assim:</p>
                <p>Nome: InfraStudio</p>
                <p>Tipo: Web</p>
                <p>URL de retorno OAuth:</p>
                <p className="font-semibold text-white">https://infrastudio.vercel.app/api/admin/conectores/mercado-livre/callback</p>
                <p className="mt-3">Callback URL Notifications / webhook:</p>
                <p className="font-semibold text-white">https://infrastudio.vercel.app/api/mercado-livre/webhook</p>
                <p className="mt-3">Fluxos OAuth:</p>
                <p>Authorization Code: ativo</p>
                <p>Refresh Token: ativo</p>
                <p>PKCE necessario: ativo</p>
                <p className="mt-3">Permissoes do app:</p>
                <p>Usuarios: Leitura e escrita</p>
                <p>Publicacao e sincronizacao: Leitura e escrita</p>
                <p>Metricas do negocio: Leitura</p>
                <p className="mt-3">Negocio liberado:</p>
                <p>Mercado Livre: marcado</p>
                <p className="mt-3">Depois de criar, vao aparecer 2 codigos na tela:</p>
                <p>APP ID</p>
                <p>CLIENT SECRET</p>
                <p className="mt-3">Envie esses dois dados para configurar a integracao da loja.</p>
                <p className="mt-3">Se aparecer botao de “autorizar” ou “permitir”, pode seguir normalmente.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-emerald-50">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100">Obrigatorio agora</p>
                    <p className="mt-2">Tipo do app: Web</p>
                    <p>URL de retorno OAuth configurada</p>
                    <p>PKCE ativo</p>
                    <p>Publicacao e sincronizacao: Leitura e escrita</p>
                    <p>APP ID</p>
                    <p>CLIENT SECRET</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-amber-50">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100">Links para cadastro</p>
                    <p className="mt-2">OAuth callback:</p>
                    <p className="font-semibold text-white">https://infrastudio.vercel.app/api/admin/conectores/mercado-livre/callback</p>
                    <p className="mt-2">Webhook de notificacoes:</p>
                    <p className="font-semibold text-white">https://infrastudio.vercel.app/api/mercado-livre/webhook</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Permissoes e marcacoes</p>
                  <p className="mt-2">Permita a autorizacao da conta quando o Mercado Livre pedir o consentimento.</p>
                  <p>Se houver secao de notificacoes ou Callback URL Notifications, cole a URL de webhook acima.</p>
                  <p>Se mudar as permissoes do app depois, desvincule a autorizacao anterior e conecte novamente no InfraStudio.</p>
                  <p>Para a integracao atual do InfraStudio, o essencial e concluir o OAuth, ativar Publicacao e sincronizacao e informar APP ID + CLIENT SECRET.</p>
                </div>
              </div> : null}
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <input type="checkbox" checked={form.ativo} onChange={(event) => onChange({ ativo: event.target.checked })} />
              Integracao ativa
            </label>

            
          </div>
        </div>
          <ModalStickyFooter feedback={feedback}>
            {form.id ? (
              <a
                href={`/api/admin/conectores/${form.id}/mercado-livre/connect`}
                className={successActionButtonClass}
              >
                <ExternalLink size={15} />
                Conectar Mercado Livre
              </a>
            ) : null}
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving}
              className={`${primaryActionButtonClass} flex-1`}
            >
              {saving ? <BusyIcon /> : form.id ? <Pencil size={16} /> : <Plus size={16} />}
              {form.id ? "Salvar" : "Criar"}
            </button>
            <button type="button" onClick={onClose} className={neutralActionButtonClass}>
              Cancelar
            </button>
          </ModalStickyFooter>
        </div>
      </div>
    </div>
  );
}

function AgentStoreSearchModal({
  open,
  agente,
  termo,
  latestLoading,
  latestResult,
  searchLoading,
  searchResult,
  onClose,
  onTermoChange,
  onLoadLatest,
  onRunSearch,
}: {
  open: boolean;
  agente: Agente | null;
  termo: string;
  latestLoading: boolean;
  latestResult: AgentStoreLatestResult | null;
  searchLoading: boolean;
  searchResult: AgentStoreSearchResult | null;
  onClose: () => void;
  onTermoChange: (value: string) => void;
  onLoadLatest: () => void;
  onRunSearch: () => void;
}) {
  if (!open || !agente) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Teste da loja</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{agente.nome}</h2>
            <p className="mt-1 text-sm text-slate-400">Este teste usa a mesma busca de produtos que o WhatsApp usa no atendimento.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${neutralActionButtonClass} px-3`}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-88px)] overflow-y-auto p-6">
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-4">
            <p className="text-sm font-semibold text-white">Diagnostico da loja</p>
            <p className="mt-1 text-xs text-emerald-100/80">O teste principal lista os ultimos produtos da loja. A busca por termo fica opcional logo abaixo.</p>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Ultimos produtos da loja</p>
                <p className="mt-1 text-xs text-slate-400">Usa o seller configurado no conector para listar os produtos mais recentes.</p>
              </div>
              <button
                type="button"
                onClick={onLoadLatest}
                disabled={latestLoading}
                className={successActionButtonClass}
              >
                {latestLoading ? <BusyIcon /> : <TestTube2 size={15} />}
                Listar
              </button>
            </div>

            {latestResult ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${latestResult.error ? "bg-rose-500/15 text-rose-100" : "bg-emerald-500/15 text-emerald-100"}`}>
                    {latestResult.error ? "Listagem com erro" : "Listagem validada"}
                  </span>
                  <p className="text-xs text-slate-300">
                    {latestResult.connector
                      ? `${latestResult.connector.nickname || latestResult.connector.nome} | seller ${latestResult.connector.sellerId}`
                : "Sem integracao valida"}
                  </p>
                </div>

                {latestResult.error ? <p className="mt-3 text-sm text-rose-100">{latestResult.error}</p> : null}

                {latestResult.produtos.length ? (
                  <div className="mt-4 space-y-3">
                    {latestResult.produtos.map((produto) => (
                      <div key={produto.link} className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
                        <div className="flex items-start gap-4">
                          {produto.imagem ? (
                            <img
                              src={produto.imagem}
                              alt={produto.nome}
                              className="h-20 w-20 rounded-xl border border-white/10 object-cover bg-slate-900/60"
                              loading="lazy"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white">{produto.nome}</p>
                            <p className="mt-1 text-xs text-slate-300">
                              R$ {produto.preco.toLocaleString("pt-BR")}
                              {produto.publicadoEm ? ` | ${new Date(produto.publicadoEm).toLocaleString("pt-BR")}` : ""}
                            </p>
                          </div>
                          <a
                            href={produto.link}
                            target="_blank"
                            rel="noreferrer"
                            className={primaryActionButtonClass}
                          >
                            <ExternalLink size={13} />
                            Abrir
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div>
              <p className="text-sm font-semibold text-white">Busca opcional</p>
              <p className="mt-1 text-xs text-slate-400">Quando quiser, rode a mesma busca por termo usada pelo WhatsApp.</p>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={termo}
              onChange={(event) => onTermoChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onRunSearch();
                }
              }}
              placeholder="Ex.: sopeira porcelana real"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={onRunSearch}
              disabled={searchLoading}
              className={successActionButtonClass}
            >
              {searchLoading ? <BusyIcon /> : <TestTube2 size={15} />}
              Buscar
            </button>
          </div>

          {searchResult ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${searchResult.error ? "bg-rose-500/15 text-rose-100" : "bg-emerald-500/15 text-emerald-100"}`}>
                  {searchResult.error ? "Busca sem retorno" : "Busca validada"}
                </span>
                <p className="text-xs text-slate-300">
                  Termo testado: <span className="font-semibold text-white">{searchResult.termo}</span>
                </p>
              </div>

              {searchResult.error ? <p className="mt-3 text-sm text-rose-100">{searchResult.error}</p> : null}

              {searchResult.produtos.length ? (
                <div className="mt-4 space-y-3">
                  {searchResult.produtos.map((produto) => (
                    <div key={produto.link} className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
                      <div className="flex items-start gap-4">
                        {produto.imagem ? (
                          <img
                            src={produto.imagem}
                            alt={produto.nome}
                            className="h-20 w-20 rounded-xl border border-white/10 object-cover bg-slate-900/60"
                            loading="lazy"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white">{produto.nome}</p>
                          <p className="mt-1 text-xs text-slate-300">
                            R$ {produto.preco.toLocaleString("pt-BR")}
                            {produto.publicadoEm ? ` | ${new Date(produto.publicadoEm).toLocaleString("pt-BR")}` : ""}
                          </p>
                        </div>
                        <a
                          href={produto.link}
                          target="_blank"
                          rel="noreferrer"
                          className={primaryActionButtonClass}
                        >
                          <ExternalLink size={13} />
                          Abrir
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppChannelModal({
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
  form: WhatsAppChannelFormState;
  agentes: Agente[];
  saving: boolean;
  feedback: string | null;
  onClose: () => void;
  onChange: (next: Partial<WhatsAppChannelFormState>) => void;
  onSubmit: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">WhatsApp oficial</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{form.id ? "Editar canal" : "Novo canal"}</h2>
            <p className="mt-1 text-sm text-slate-400">Cadastre o numero principal e escolha qual agente vai responder por esse canal.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${neutralActionButtonClass} px-3`}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex max-h-[calc(92vh-88px)] flex-col">
          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-28">
          <div className="space-y-4">
            <div>
              <FormLabel>Numero</FormLabel>
              <input
                value={form.numero}
                onChange={(event) => onChange({ numero: event.target.value })}
                placeholder="+55 11 99999-9999"
                inputMode="tel"
                autoComplete="tel"
                maxLength={17}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div>
              <FormLabel>Agente</FormLabel>
              <select
                value={form.agenteId ?? ""}
                onChange={(event) => onChange({ agenteId: event.target.value || null })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
              >
                <option value="">Selecione um agente</option>
                {agentes.map((agente) => (
                  <option key={agente.id} value={agente.id}>
                    {agente.nome}
                    {agente.ativo ? " (ativo)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FormLabel>Status</FormLabel>
              <select
                value={form.status}
                onChange={(event) => onChange({ status: event.target.value === "inativo" ? "inativo" : "ativo" })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
              >
                <option value="ativo">ativo</option>
                <option value="inativo">inativo</option>
              </select>
            </div>

            
          </div>
        </div>
          <ModalStickyFooter feedback={feedback}>
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving}
              className={`${primaryActionButtonClass} flex-1`}
            >
              {saving ? <BusyIcon /> : form.id ? <Pencil size={16} /> : <Plus size={16} />}
              {form.id ? "Salvar" : "Criar"}
            </button>
            <button type="button" onClick={onClose} className={neutralActionButtonClass}>
              Cancelar
            </button>
          </ModalStickyFooter>
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
                    <h2 className="mt-2 text-2xl font-extrabold text-white">{detail?.chat.titulo ?? "Load Premium"}</h2>
            {detail ? <p className="mt-1 text-sm text-slate-400">Atualizada em {new Date(detail.chat.updatedAt).toLocaleString("pt-BR")}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${neutralActionButtonClass} px-3`}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? <PremiumLoader compact /> : null}
          {!loading && error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">{error}</div> : null}
          {!loading && !error && detail ? (
            <div className="space-y-4">
              {detail.messages.length ? (
                detail.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-2xl border px-4 py-3 ${
                      message.role === "assistant"
                        ? "border-transparent bg-transparent"
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

function WidgetCodeModal({
  open,
  state,
  copiedKey,
  onClose,
  onChangeVariant,
  onCopy,
}: {
  open: boolean;
  state: WidgetCodeModalState | null;
  copiedKey: string | null;
  onClose: () => void;
  onChangeVariant: (variant: "essencial" | "detalhado") => void;
  onCopy: (key: string, value: string) => void;
}) {
  if (!open || !state) {
    return null;
  }

  const modalKey = `widget-code:${state.widget.slug}:${state.variant}`;
  const code = state.variant === "essencial" ? state.essentialCode : state.detailedCode;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Codigo do widget</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{state.widget.nome}</h2>
            <p className="mt-1 text-sm text-slate-400">Escolha a versao do codigo e copie o snippet pronto para este widget.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${neutralActionButtonClass} px-3`}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-2xl border border-white/10 bg-slate-950/40 p-1">
              {[
                { key: "essencial" as const, label: "Minimo preenchido" },
                { key: "detalhado" as const, label: "Completo e detalhado" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onChangeVariant(item.key)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    state.variant === item.key ? "bg-cyan-500/15 text-cyan-100" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onCopy(modalKey, code)}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/20 hover:text-white"
            >
              {copiedKey === modalKey ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copiedKey === modalKey ? "Copiado" : "Copiar codigo"}
            </button>
          </div>

          <div className={`mt-4 rounded-2xl border p-4 ${state.variant === "essencial" ? "border-cyan-500/20 bg-[#07111f]" : "border-emerald-500/20 bg-[#081611]"}`}>
            <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${state.variant === "essencial" ? "text-cyan-100" : "text-emerald-100"}`}>
              {state.variant === "essencial" ? "Snippet minimo" : "Snippet detalhado host-controlled"}
            </p>
            <p className={`mt-1 text-xs ${state.variant === "essencial" ? "text-slate-300" : "text-emerald-50/80"}`}>
              {state.variant === "essencial"
                ? "Versao mais direta para instalar rapido com o contexto inicial ja preenchido."
                : "Versao completa para quando o site controla montagem, atualizacao e destruicao do chat."}
            </p>
            <div className={`mt-4 overflow-x-auto rounded-xl border ${state.variant === "essencial" ? "border-cyan-500/20 bg-[#04111d]" : "border-emerald-500/20 bg-[#07110d]"}`}>
              <pre className="min-h-[320px] w-full whitespace-pre-wrap break-all px-4 py-4 font-mono text-xs leading-6">
                {code.split("\n").map((line: string, index: number) => (
                  <div key={`${modalKey}-${index}`}>{renderSnippetLine(line)}</div>
                ))}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmbeddedAgentTestChat({
  projeto,
  agente,
  origin,
}: {
  projeto: Projeto;
  agente: Agente;
  origin: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined" || !origin) {
      return;
    }

    const infraChatWindow = window as Window & {
      InfraChat?: {
        mount: (config: Record<string, unknown>) => boolean;
        destroy: () => boolean;
      };
    };

    const projetoRef = projeto.id;
    const agenteRef = agente.id;
    const testSessionId = `admin-agent-test:${projeto.id}:${agente.id}:${Date.now()}`;
    const scriptId = "infrastudio-admin-agent-test-chat-sdk";
    const mountWidget = () => {
      infraChatWindow.InfraChat?.destroy();
      infraChatWindow.InfraChat?.mount({
        projeto: projetoRef,
        agente: agenteRef,
        identificadorExterno: testSessionId,
        apiBase: origin,
        strictHostControl: true,
        open: true,
        destroyOnClose: true,
        hideLauncher: true,
        mobileFullscreen: true,
        ui: {
          transparent: false,
          title: agente.nome,
          subtitle: "Testando o agente 11",
        },
        context: {
          route: {
            path: window.location.pathname,
          },
          channel: {
            kind: "admin_agent_test",
          },
          admin: {
            mode: "agent_test",
            projetoId: projeto.id,
            agenteId: agente.id,
          },
        },
        policy: {
          allowed: true,
          allowedRoutes: [window.location.pathname],
        },
      });
    };

    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `${origin}/chat.js`;
      script.async = true;
      script.setAttribute("data-projeto", projetoRef);
      script.setAttribute("data-agente", agenteRef);
      document.body.appendChild(script);
    }

    script.addEventListener("load", mountWidget);
    if (infraChatWindow.InfraChat) {
      mountWidget();
    }

    return () => {
      script?.removeEventListener("load", mountWidget);
      infraChatWindow.InfraChat?.destroy();
    };
  }, [agente.id, origin, projeto.id]);

  return null;
}

export default function AdminProjetoDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath = `/admin/projetos/${params.id}`;
  const [data, setData] = useState<ProjetoDetalhe | null>(null);
  const [billingPlanForm, setBillingPlanForm] = useState<BillingPlanFormState>(createBillingPlanForm(null));
  const [agenteForm, setAgenteForm] = useState<AgenteFormState>(emptyAgenteForm);
  const [apiForm, setApiForm] = useState<ApiFormState>(emptyApiForm);
  const [connectorForm, setConnectorForm] = useState<ConnectorFormState>(emptyConnectorForm);
  const [widgetForm, setWidgetForm] = useState<WidgetFormState>(emptyWidgetForm);
  const [whatsAppChannelForm, setWhatsAppChannelForm] = useState<WhatsAppChannelFormState>(emptyWhatsAppChannelForm);
  const [detectedApiCampos, setDetectedApiCampos] = useState<ApiCampo[]>([]);
  const [apiTestParameterValues, setApiTestParameterValues] = useState<Record<string, string>>({});
  const [savingAgente, setSavingAgente] = useState(false);
  const [savingApi, setSavingApi] = useState(false);
  const [savingConnector, setSavingConnector] = useState(false);
  const [savingWidget, setSavingWidget] = useState(false);
  const [savingWhatsAppChannel, setSavingWhatsAppChannel] = useState(false);
  const [savingBillingPlan, setSavingBillingPlan] = useState(false);
  const [connectingWhatsAppChannelId, setConnectingWhatsAppChannelId] = useState<string | null>(null);
  const [disconnectingWhatsAppChannelId, setDisconnectingWhatsAppChannelId] = useState<string | null>(null);
  const [deletingAgenteId, setDeletingAgenteId] = useState<string | null>(null);
  const [deletingConnectorId, setDeletingConnectorId] = useState<string | null>(null);
  const [deletingWidgetId, setDeletingWidgetId] = useState<string | null>(null);
  const [deletingWhatsAppChannelId, setDeletingWhatsAppChannelId] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deletingProjectRedirecting, setDeletingProjectRedirecting] = useState(false);
  const [deleteProjectModalOpen, setDeleteProjectModalOpen] = useState(false);
  const [deleteProjectConfirmation, setDeleteProjectConfirmation] = useState("");
  const [deleteAgenteModalOpen, setDeleteAgenteModalOpen] = useState(false);
  const [deleteAgenteConfirmation, setDeleteAgenteConfirmation] = useState("");
  const [agentePendingDelete, setAgentePendingDelete] = useState<Agente | null>(null);
  const [deleteConnectorModalOpen, setDeleteConnectorModalOpen] = useState(false);
  const [deleteConnectorConfirmation, setDeleteConnectorConfirmation] = useState("");
  const [connectorPendingDelete, setConnectorPendingDelete] = useState<Connector | null>(null);
  const [deleteWhatsAppChannelModalOpen, setDeleteWhatsAppChannelModalOpen] = useState(false);
  const [deleteWhatsAppChannelConfirmation, setDeleteWhatsAppChannelConfirmation] = useState("");
  const [whatsAppChannelPendingDelete, setWhatsAppChannelPendingDelete] = useState<WhatsAppChannel | null>(null);
  const [testingApi, setTestingApi] = useState(false);
  const [feedbackAgente, setFeedbackAgente] = useState<string | null>(null);
  const [feedbackApi, setFeedbackApi] = useState<string | null>(null);
  const [feedbackConnector, setFeedbackConnector] = useState<string | null>(null);
  const [feedbackWidget, setFeedbackWidget] = useState<string | null>(null);
  const [feedbackWhatsApp, setFeedbackWhatsApp] = useState<string | null>(null);
  const [feedbackBilling, setFeedbackBilling] = useState<string | null>(null);
  const [agenteModalOpen, setAgenteModalOpen] = useState(false);
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [connectorModalOpen, setConnectorModalOpen] = useState(false);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [whatsAppChannelModalOpen, setWhatsAppChannelModalOpen] = useState(false);
  const [agentConnectionSavingKey, setAgentConnectionSavingKey] = useState<string | null>(null);
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatHistoryError, setChatHistoryError] = useState<string | null>(null);
  const [chatDetail, setChatDetail] = useState<ChatDetailState | null>(null);
  const [pendingAgenteArquivos, setPendingAgenteArquivos] = useState<PendingAgenteArquivo[]>([]);
  const [origin, setOrigin] = useState("");
  const [copiedSnippetKey, setCopiedSnippetKey] = useState<string | null>(null);
  const [widgetCodeModalState, setWidgetCodeModalState] = useState<WidgetCodeModalState | null>(null);
  const [serviceStatusByChannel, setServiceStatusByChannel] = useState<Record<string, string>>({});
  const [serviceQrByChannel, setServiceQrByChannel] = useState<Record<string, string | null>>({});
  const [agentDiagnosticsById, setAgentDiagnosticsById] = useState<Record<string, AgentDiagnosticsOverview>>({});
  const [runningAgentDiagnosticId, setRunningAgentDiagnosticId] = useState<string | null>(null);
  const [latestAgentDiagnosticById, setLatestAgentDiagnosticById] = useState<Record<string, AgentDiagnosticRun>>({});
  const [agentStoreSearchModalOpen, setAgentStoreSearchModalOpen] = useState(false);
  const [agentStoreSearchTarget, setAgentStoreSearchTarget] = useState<Agente | null>(null);
  const [agentStoreSearchTerm, setAgentStoreSearchTerm] = useState("");
  const [agentStoreLatestLoading, setAgentStoreLatestLoading] = useState(false);
  const [agentStoreSearchLoading, setAgentStoreSearchLoading] = useState(false);
  const [agentStoreLatestResult, setAgentStoreLatestResult] = useState<AgentStoreLatestResult | null>(null);
  const [agentStoreSearchResult, setAgentStoreSearchResult] = useState<AgentStoreSearchResult | null>(null);
  const [agentTestTarget, setAgentTestTarget] = useState<Agente | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>("agentes");
  const [renderedTab, setRenderedTab] = useState<ProjectTab>("agentes");
  const [tabContentVisible, setTabContentVisible] = useState(true);
  const [tabsPinned, setTabsPinned] = useState(false);
  const [tabsBarHeight, setTabsBarHeight] = useState(0);
  const [tabsBarLeft, setTabsBarLeft] = useState(0);
  const [projectDetailsExpanded, setProjectDetailsExpanded] = useState(false);
  const pendingAgentDiagnosticsRef = useRef<Record<string, boolean>>({});
  const tabSwitchTimeoutRef = useRef<number | null>(null);
  const tabRevealTimeoutRef = useRef<number | null>(null);
  const tabsScrollFrameRef = useRef<number | null>(null);
  const tabsAnchorRef = useRef<HTMLDivElement | null>(null);
  const tabsBarRef = useRef<HTMLDivElement | null>(null);

  const loadProjeto = async () => {
    const response = await fetch(`/api/admin/projetos/${params.id}`, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as ProjetoDetalhe;
    pendingAgentDiagnosticsRef.current = {};
    setAgentDiagnosticsById({});
    setLatestAgentDiagnosticById({});
    setData(payload);
    setBillingPlanForm(createBillingPlanForm(payload.billing));
    setAgenteForm((prev) => ({
      ...prev,
      projetoId: payload.projeto.id,
    }));
  };

  const loadAgentDiagnostics = async (agentes: Agente[]) => {
    const pending = agentes.filter((agente) => !agentDiagnosticsById[agente.id] && !pendingAgentDiagnosticsRef.current[agente.id]);
    if (!pending.length) {
      return;
    }

    pending.forEach((agente) => {
      pendingAgentDiagnosticsRef.current[agente.id] = true;
    });

    const diagnosticsEntries = await Promise.all(
      pending.map(async (agente) => {
        try {
          const diagnosticResponse = await fetch(`/api/admin/agentes/${agente.id}/diagnostico`, { cache: "no-store" });
          if (!diagnosticResponse.ok) {
            return null;
          }

          const diagnosticPayload = (await diagnosticResponse.json()) as AgentDiagnosticsOverview;
          return [agente.id, diagnosticPayload] as const;
        } catch {
          return null;
        } finally {
          delete pendingAgentDiagnosticsRef.current[agente.id];
        }
      }),
    );

    const nextEntries = diagnosticsEntries.filter((entry): entry is readonly [string, AgentDiagnosticsOverview] => Boolean(entry));
    if (!nextEntries.length) {
      return;
    }

    setAgentDiagnosticsById((current) => ({
      ...current,
      ...Object.fromEntries(nextEntries),
    }));
  };

  const withComputedProjectStats = (current: ProjetoDetalhe): ProjetoDetalhe => ({
    ...current,
    stats: {
      ...current.stats,
      totalAgentes: current.agentes.length,
      agenteAtivoId: current.agentes.find((agente) => agente.ativo)?.id ?? null,
      totalApis: current.apis.length,
      totalConectores: current.conectores.length,
      totalWidgets: current.widgets.length,
      totalWhatsAppChannels: current.whatsappChannels.length,
      totalChats: current.chats.length,
    },
  });

  const updateProjetoData = (updater: (current: ProjetoDetalhe) => ProjetoDetalhe) => {
    setData((current) => (current ? withComputedProjectStats(updater(current)) : current));
  };

  const upsertById = <T extends { id?: string }>(items: T[], item: T) => {
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index === -1) {
      return [item, ...items];
    }

    return items.map((entry, currentIndex) => (currentIndex === index ? item : entry));
  };

  const removeById = <T extends { id?: string }>(items: T[], id: string) => items.filter((entry) => entry.id !== id);
  const premiumTransitionClass = "transition-[background-color,border-color,color,opacity,box-shadow,transform] duration-180 ease-out";
  const premiumInteractiveClass = premiumTransitionClass;
  const editButtonClass = `${warningActionButtonClass} ${premiumInteractiveClass}`;
  const buildProjectUrl = (mutate?: (nextParams: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    mutate?.(nextParams);
    const query = nextParams.toString();
    return query ? `${currentPath}?${query}` : currentPath;
  };
  const replaceProjectUrl = (mutate?: (nextParams: URLSearchParams) => void) => {
    router.replace(buildProjectUrl(mutate), { scroll: false });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    void loadProjeto();
  }, [params.id]);

  useEffect(() => {
    if (activeTab !== "agentes" || !data?.agentes.length) {
      return;
    }

    void loadAgentDiagnostics(data.agentes);
  }, [activeTab, data?.agentes, agentDiagnosticsById]);

  useEffect(() => {
    const handleScroll = () => {
      if (tabsScrollFrameRef.current !== null) {
        return;
      }

      tabsScrollFrameRef.current = window.requestAnimationFrame(() => {
        tabsScrollFrameRef.current = null;

        const anchorElement = tabsAnchorRef.current;
        const barElement = tabsBarRef.current;
        if (!anchorElement || !barElement) {
          return;
        }

        const anchorRect = anchorElement.getBoundingClientRect();
        const nextPinned = anchorRect.top <= 12;
        const nextHeight = barElement.offsetHeight;
        const nextLeft = Math.round(anchorRect.left);

        setTabsPinned((current) => (current === nextPinned ? current : nextPinned));
        setTabsBarHeight((current) => (current === nextHeight ? current : nextHeight));
        setTabsBarLeft((current) => (current === nextLeft ? current : nextLeft));
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      if (tabsScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(tabsScrollFrameRef.current);
      }
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    const oauthStatus = searchParams.get("mercado_livre_oauth");
    const oauthError = searchParams.get("mercado_livre_oauth_error");

    if (oauthStatus === "success") {
      setFeedbackConnector("Conexao com o Mercado Livre concluida. A integracao recebeu os tokens da loja.");
      void loadProjeto();
      replaceProjectUrl((nextParams) => {
        nextParams.delete("mercado_livre_oauth");
        nextParams.delete("mercado_livre_oauth_error");
      });
      return;
    }

    if (oauthError) {
      setFeedbackConnector(oauthError);
      void loadProjeto();
      replaceProjectUrl((nextParams) => {
        nextParams.delete("mercado_livre_oauth");
        nextParams.delete("mercado_livre_oauth_error");
      });
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== "whatsapp" || !data?.whatsappChannels.length) {
      return;
    }

    const channelsToSync = data.whatsappChannels.filter((channel) => {
      if (channel.status !== "ativo") {
        return false;
      }

      const connectionStatus = channel.sessionData?.connectionStatus ?? "offline";
      return (
        connectionStatus !== "online" ||
        connectingWhatsAppChannelId === channel.id ||
        disconnectingWhatsAppChannelId === channel.id ||
        !channel.sessionData?.lastSyncAt
      );
    });

    if (!channelsToSync.length) {
      return;
    }

    const sync = () => {
      for (const channel of channelsToSync) {
        void refreshWhatsAppRuntime(channel.id);
      }
    };

    sync();
    const timer = window.setInterval(sync, 12000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeTab, connectingWhatsAppChannelId, data?.whatsappChannels, disconnectingWhatsAppChannelId]);

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

  const resetConnectorForm = () => {
    setConnectorForm({
      ...emptyConnectorForm,
      projetoId: params.id,
    });
    setFeedbackConnector(null);
  };

  const resetWidgetForm = () => {
    setWidgetForm({
      ...emptyWidgetForm,
      projetoId: params.id,
    });
    setFeedbackWidget(null);
  };

  const resetWhatsAppChannelForm = () => {
    setWhatsAppChannelForm(emptyWhatsAppChannelForm);
    setFeedbackWhatsApp(null);
  };

  const openNewWhatsAppChannelModal = () => {
    resetWhatsAppChannelForm();
    setWhatsAppChannelModalOpen(true);
  };

  const openNewAgenteModal = () => {
    resetAgenteForm();
    setAgenteModalOpen(true);
  };

  const openNewApiModal = () => {
    resetApiForm();
    setApiModalOpen(true);
  };

  const openNewConnectorModal = () => {
    resetConnectorForm();
    replaceProjectUrl((nextParams) => {
      nextParams.set("tab", "mercado");
      nextParams.delete("fonte");
    });
    setConnectorModalOpen(true);
  };

  const openNewWidgetModal = () => {
    resetWidgetForm();
    setWidgetModalOpen(true);
  };

  const refreshWhatsAppRuntime = async (channelId: string) => {
    const statusUrl = getWhatsAppServiceUrl("/status", channelId);
    const qrUrl = getWhatsAppServiceUrl("/qr", channelId);

    if (!statusUrl || !qrUrl) {
      return;
    }

    try {
      const statusResponse = await fetch(statusUrl, { cache: "no-store" });
      const statusPayload = (await statusResponse.json()) as { status?: string };
      if (statusResponse.ok) {
        setServiceStatusByChannel((current) => ({
          ...current,
          [channelId]: getChannelStatusLabel(statusPayload.status),
        }));
      }
    } catch {
      setServiceStatusByChannel((current) => ({
        ...current,
        [channelId]: "desconectado",
      }));
    }

    try {
      const qrResponse = await fetch(qrUrl, { cache: "no-store" });
      const qrPayload = (await qrResponse.json()) as { qrCodeDataUrl?: string | null };
      if (qrResponse.ok) {
        setServiceQrByChannel((current) => ({
          ...current,
          [channelId]: qrPayload.qrCodeDataUrl ?? null,
        }));
      }
    } catch {
      setServiceQrByChannel((current) => ({
        ...current,
        [channelId]: null,
      }));
    }
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
  const getAgentWidgets = (agente: Agente) =>
    data?.widgets.filter((widget) => (widget.agenteId ? widget.agenteId === agente.id : agente.ativo)) ?? [];

  const getAgentWhatsAppChannels = (agente: Agente) =>
    data?.whatsappChannels.filter((channel) => (channel.agenteId ? channel.agenteId === agente.id : agente.ativo)) ?? [];

  const getAgentConnectors = (agente: Agente) => data?.conectores.filter((connector) => connector.agenteId === agente.id) ?? [];

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

  const buildHostControlSnippet = (widget: ChatWidget) => {
    const base = origin || "https://seu-dominio";
    const projetoRef = data?.projeto.slug || data?.projeto.id || "seu-projeto";
    const agente = getResolvedWidgetAgent(widget);
    const agenteRef = agente?.slug || agente?.id || "agente-do-projeto";

    return [
      `<!-- SDK do chat ${widget.nome} -->`,
      `<script src="${base}/chat.js" data-projeto="${projetoRef}" data-agente="${agenteRef}"></script>`,
      "<script>",
      "  const isAllowedRoute = window.location.pathname.startsWith('/');",
      "  const hasUnlockedChat = true;",
      "",
      "  if (!isAllowedRoute || !hasUnlockedChat) {",
      "    window.InfraChat.destroy();",
      "  } else {",
      "    window.InfraChat.mount({",
      `      projeto: '${projetoRef}',`,
      `      agente: '${agenteRef}',`,
      `      apiBase: '${base}',`,
      "      strictHostControl: true,",
      "      context: {",
      "        route: { path: window.location.pathname },",
      "        resource: { id: 'recurso-atual', tipo: 'recurso' },",
      "        ui: {",
      `          title: '${widget.nome.replace(/'/g, "\\'")}',`,
      `          theme: '${widget.tema}',`,
      `          accent: '${widget.corPrimaria}',`,
      `          transparent: ${widget.fundoTransparente ? "true" : "false"},`,
      "        },",
      "      },",
      "      policy: {",
      "        allowed: true,",
      "        allowedRoutes: ['/'],",
      "      },",
      "    });",
      "  }",
      "</script>",
    ].join("\n");
  };

  const buildWhatsappSnippet = (widget: ChatWidget) => {
    const digits = sanitizePhoneDigits(widget.whatsappCelular);
    const phone = digits ? `55${digits}` : "5511999999999";
    const buttonLabel = widget.nome.replace(/'/g, "\\'") || "Falar no WhatsApp";
    const defaultMessage = `Ola! Vim do site ${data?.projeto.nome ?? "do projeto"} e quero falar sobre ${widget.nome}.`;

    return [
      "<script>",
      "  (function () {",
      "    if (document.getElementById('infra-whatsapp-free-button')) return;",
      "",
      `    const phone = '${phone}';`,
      `    const message = ${JSON.stringify(defaultMessage)};`,
      "    const link = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;",
      "",
      "    const button = document.createElement('a');",
      "    button.id = 'infra-whatsapp-free-button';",
      "    button.href = link;",
      "    button.target = '_blank';",
      "    button.rel = 'noopener noreferrer';",
      `    button.setAttribute('aria-label', '${buttonLabel}');`,
      "    button.textContent = 'WhatsApp';",
      "    Object.assign(button.style, {",
      "      position: 'fixed',",
      "      right: '24px',",
      "      bottom: '24px',",
      "      zIndex: '9999',",
      `      background: '${widget.corPrimaria}',`,
      "      color: '#ffffff',",
      "      padding: '14px 18px',",
      "      borderRadius: '999px',",
      "      textDecoration: 'none',",
      "      fontFamily: 'Arial, sans-serif',",
      "      fontSize: '14px',",
      "      fontWeight: '700',",
      "      boxShadow: '0 18px 40px rgba(15, 23, 42, 0.28)'",
      "    });",
      "",
      "    document.body.appendChild(button);",
      "  })();",
      "</script>",
    ].join("\n");
  };

  const handleCopySnippet = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedSnippetKey(key);
      window.setTimeout(() => {
        setCopiedSnippetKey((current) => (current === key ? null : current));
      }, 1800);
    } catch {
      setCopiedSnippetKey(null);
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

  const applyAgenteAutoFields = (form: AgenteFormState): AgenteFormState => {
    const normalizedPromptBase = normalizeAgentText(form.promptBase);
    const descricaoAutomatica = inferShortDescription(normalizedPromptBase || form.nome);
    const preserveExistingSlug = Boolean(form.id && form.slug.trim());
    const slugBase = form.nome.trim() || descricaoAutomatica || "agente-do-projeto";

    return {
      ...form,
      descricao: descricaoAutomatica,
      slug: preserveExistingSlug ? form.slug.trim() : slugifyAgentValue(slugBase),
      promptBase: normalizedPromptBase || form.promptBase,
    };
  };

  const prepareAgenteForm = (form: AgenteFormState) => {
    const formWithAutoFields = applyAgenteAutoFields(form);
    const organizedPromptBase = normalizeAgentText(formWithAutoFields.promptBase);
    const generatedConfig = buildAgentConfigFromSummary(organizedPromptBase);

    return {
      ...formWithAutoFields,
      descricao: inferShortDescription(organizedPromptBase || formWithAutoFields.nome),
      promptBase: organizedPromptBase,
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

  const handleRunAgentDiagnostic = async (agente: Agente) => {
    setRunningAgentDiagnosticId(agente.id);
    setFeedbackAgente(null);

    try {
      const response = await fetch(`/api/admin/agentes/${agente.id}/diagnostico`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const payload = (await response.json()) as AgentDiagnosticRun & { error?: string };

      if (!response.ok) {
        setFeedbackAgente(payload.error ?? "Nao foi possivel validar o agente.");
        return;
      }

      setLatestAgentDiagnosticById((current) => ({
        ...current,
        [agente.id]: payload,
      }));

      await loadProjeto();
      setFeedbackAgente(
        payload.ok
          ? `Validacao concluida para "${agente.nome}". Chat, APIs, fontes de produto e WhatsApp foram verificados.`
          : `Validacao concluida para "${agente.nome}" com alertas. Veja os blocos de status do agente.`,
      );
    } catch (error) {
      setFeedbackAgente(error instanceof Error ? error.message : "Nao foi possivel validar o agente.");
    } finally {
      setRunningAgentDiagnosticId(null);
    }
  };

  const handleOpenAgentStoreSearchModal = (agente: Agente) => {
    setFeedbackAgente(null);
    setAgentStoreSearchTarget(agente);
    setAgentStoreSearchTerm("");
    setAgentStoreLatestResult(null);
    setAgentStoreSearchResult(null);
    setAgentStoreLatestLoading(false);
    setAgentStoreSearchLoading(false);
    setAgentStoreSearchModalOpen(true);
  };

  const handleOpenAgentTestChat = (agente: Agente) => {
    setFeedbackAgente(null);
    setAgentTestTarget(agente);
  };

  const handleLoadAgentLatestProducts = async () => {
    const agente = agentStoreSearchTarget;

    if (!agente) {
      return;
    }

    setAgentStoreLatestLoading(true);
    setAgentStoreLatestResult(null);
    setFeedbackAgente(null);

    try {
      const response = await fetch(`/api/admin/agentes/${encodeURIComponent(agente.id)}/loja-teste`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const payload = (await response.json()) as AgentStoreLatestResult & { error?: string };
      setAgentStoreLatestResult({
        connector: payload.connector ?? null,
        produtos: Array.isArray(payload.produtos) ? payload.produtos : [],
        error: payload.error ?? null,
      });
    } catch (error) {
      setAgentStoreLatestResult({
        connector: null,
        produtos: [],
        error: error instanceof Error ? error.message : "Nao foi possivel listar os ultimos produtos da loja.",
      });
    } finally {
      setAgentStoreLatestLoading(false);
    }
  };

  const handleRunAgentStoreSearch = async () => {
    const agente = agentStoreSearchTarget;
    const termo = agentStoreSearchTerm.trim();

    if (!agente) {
      return;
    }

    if (!termo) {
      setAgentStoreSearchResult({
        termo: "",
        produtos: [],
        error: "Digite um termo para testar a busca da loja.",
      });
      return;
    }

    setAgentStoreSearchLoading(true);
    setAgentStoreSearchResult(null);
    setFeedbackAgente(null);

    try {
      const response = await fetch(`/api/produtos?termo=${encodeURIComponent(termo)}&agente_id=${encodeURIComponent(agente.id)}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`A busca da loja retornou ${response.status}.`);
      }

      const payload = (await response.json()) as AgentStoreSearchProduct[];
      setAgentStoreSearchResult({
        termo,
        produtos: payload,
        error: payload.length ? null : `Nao encontrei resultados para "${termo}" na loja agora.`,
      });
    } catch (error) {
      setAgentStoreSearchResult({
        termo,
        produtos: [],
        error: error instanceof Error ? error.message : "Nao foi possivel testar a busca da loja.",
      });
    } finally {
      setAgentStoreSearchLoading(false);
    }
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

    if (savedAgente) {
      updateProjetoData((current) => ({
        ...current,
        agentes: upsertById(current.agentes, savedAgente),
      }));
    }
    const message = preparedForm.id ? "Agente atualizado com sucesso." : "Agente criado com sucesso.";
    resetAgenteForm();
    setSavingAgente(false);
    setAgenteModalOpen(false);
    setFeedbackAgente(message);
  };

  const handleAssignWidgetToAgent = async (widgetId: string) => {
    if (!data || !agenteForm.id) {
      setFeedbackAgente("Salve o agente antes de vincular um widget.");
      return;
    }

    const widget = data.widgets.find((item) => item.id === widgetId);
    if (!widget) {
      setFeedbackAgente("Widget nao encontrado.");
      return;
    }

    const assignedToCurrent = widget.agenteId === agenteForm.id;

    if (widget.agenteId && widget.agenteId !== agenteForm.id) {
      const currentAgentName = data.agentes.find((agente) => agente.id === widget.agenteId)?.nome ?? "outro agente";
      const accepted = window.confirm(`O widget "${widget.nome}" esta vinculado a ${currentAgentName}. Deseja trocar para ${agenteForm.nome || "este agente"}?`);
      if (!accepted) {
        return;
      }
    }

    setAgentConnectionSavingKey(`widget:${widget.id}`);
    setFeedbackAgente(null);

    try {
      const updateWidgetAssignment = async (targetWidget: ChatWidget, nextAgentId: string | null) => {
        const response = await fetch("/api/admin/chat-widgets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...targetWidget,
            projetoId: params.id,
            agenteId: nextAgentId,
          }),
        });

        const payload = (await response.json()) as { error?: string; widget?: ChatWidget };
        if (!response.ok || !payload.widget) {
          throw new Error(payload.error ?? "Nao foi possivel atualizar o widget.");
        }

        return payload.widget;
      };

      const widgetsToUpdate = data.widgets.filter((item) => item.agenteId === agenteForm.id && item.id !== widget.id);
      const updatedWidgets: ChatWidget[] = [];

      if (!assignedToCurrent) {
        for (const currentWidget of widgetsToUpdate) {
          updatedWidgets.push(await updateWidgetAssignment(currentWidget, null));
        }
      }

      const mainWidget = await updateWidgetAssignment(widget, assignedToCurrent ? null : agenteForm.id);
      updatedWidgets.push(mainWidget);

      updateProjetoData((current) => {
        let nextWidgets = current.widgets;
        for (const updatedWidget of updatedWidgets) {
          nextWidgets = upsertById(nextWidgets, updatedWidget);
        }

        return {
          ...current,
          widgets: nextWidgets,
        };
      });
      setFeedbackAgente(
        assignedToCurrent
          ? `Chat widget "${mainWidget.nome}" desativado deste agente.`
          : `Chat widget "${mainWidget.nome}" vinculado a "${agenteForm.nome}".`,
      );
    } catch (error) {
      setFeedbackAgente(error instanceof Error ? error.message : "Nao foi possivel vincular o widget.");
    } finally {
      setAgentConnectionSavingKey(null);
    }
  };

  const handleAssignWhatsAppToAgent = async (channelId: string) => {
    if (!data || !agenteForm.id) {
      setFeedbackAgente("Salve o agente antes de ativar o WhatsApp nele.");
      return;
    }

    const channel = data.whatsappChannels.find((item) => item.id === channelId);
    if (!channel) {
      setFeedbackAgente("Canal WhatsApp nao encontrado.");
      return;
    }

    const assignedToCurrent = channel.agenteId === agenteForm.id;

    if (channel.agenteId && channel.agenteId !== agenteForm.id) {
      const currentAgentName = data.agentes.find((agente) => agente.id === channel.agenteId)?.nome ?? "outro agente";
      const accepted = window.confirm(`O WhatsApp ${formatWhatsAppPhone(channel.numero)} esta vinculado a ${currentAgentName}. Deseja trocar para ${agenteForm.nome || "este agente"}?`);
      if (!accepted) {
        return;
      }
    }

    setAgentConnectionSavingKey(`whatsapp:${channel.id}`);
    setFeedbackAgente(null);

    try {
      const response = await fetch("/api/admin/whatsapp-canais", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: channel.id,
          projetoId: params.id,
          agenteId: assignedToCurrent ? null : agenteForm.id,
          numero: sanitizePhoneDigits(channel.numero),
          status: channel.status,
        }),
      });

      const payload = (await response.json()) as { error?: string; channel?: WhatsAppChannel };
      if (!response.ok || !payload.channel) {
        throw new Error(payload.error ?? "Nao foi possivel ativar o WhatsApp neste agente.");
      }

      updateProjetoData((current) => ({
        ...current,
        whatsappChannels: upsertById(current.whatsappChannels, payload.channel!),
      }));
      setFeedbackAgente(
        assignedToCurrent
          ? `WhatsApp ${formatWhatsAppPhone(payload.channel.numero)} desativado deste agente.`
          : `WhatsApp ${formatWhatsAppPhone(payload.channel.numero)} vinculado a "${agenteForm.nome}".`,
      );
    } catch (error) {
      setFeedbackAgente(error instanceof Error ? error.message : "Nao foi possivel ativar o WhatsApp neste agente.");
    } finally {
      setAgentConnectionSavingKey(null);
    }
  };

  const handleAssignConnectorToAgent = async (connectorId: string) => {
    if (!data || !agenteForm.id) {
      setFeedbackAgente("Salve o agente antes de ativar o Mercado Livre nele.");
      return;
    }

    const connector = data.conectores.find((item) => item.id === connectorId);
    if (!connector) {
      setFeedbackAgente("Integracao Mercado Livre nao encontrada.");
      return;
    }

    const assignedToCurrent = connector.agenteId === agenteForm.id;

    if (connector.agenteId && connector.agenteId !== agenteForm.id) {
      const currentAgentName = data.agentes.find((agente) => agente.id === connector.agenteId)?.nome ?? "outro agente";
      const accepted = window.confirm(`A integracao "${connector.nome}" esta vinculada a ${currentAgentName}. Deseja trocar para ${agenteForm.nome || "este agente"}?`);
      if (!accepted) {
        return;
      }
    }

    setAgentConnectionSavingKey(`connector:${connector.id}`);
    setFeedbackAgente(null);

    try {
      const response = await fetch("/api/admin/conectores", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: connector.id,
          nome: connector.nome,
          tipo: connector.tipo,
          projetoId: params.id,
          agenteId: assignedToCurrent ? null : agenteForm.id,
          endpointBase: connector.endpointBase,
          configuracoes: connector.configuracoes,
          ativo: connector.ativo,
        }),
      });

      const payload = (await response.json()) as { error?: string; conector?: Connector };
      if (!response.ok || !payload.conector) {
        throw new Error(payload.error ?? "Nao foi possivel ativar o Mercado Livre neste agente.");
      }

      updateProjetoData((current) => ({
        ...current,
        conectores: upsertById(current.conectores, payload.conector!),
      }));
      setFeedbackAgente(
        assignedToCurrent
          ? `Integracao "${payload.conector.nome}" desativada deste agente.`
          : `Integracao "${payload.conector.nome}" vinculada a "${agenteForm.nome}".`,
      );
    } catch (error) {
      setFeedbackAgente(error instanceof Error ? error.message : "Nao foi possivel ativar o Mercado Livre neste agente.");
    } finally {
      setAgentConnectionSavingKey(null);
    }
  };

  const handleEditAgente = (agente: Agente) => {
    setAgenteForm(applyAgenteAutoFields({
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
    }));
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

      if (savedApi) {
        updateProjetoData((current) => ({
          ...current,
          apis: upsertById(current.apis, savedApi),
        }));
      }
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

    const payload = (await response.json()) as { error?: string; widget?: ChatWidget };

    if (!response.ok) {
      setFeedbackWidget(payload.error ?? "Nao foi possivel salvar o widget.");
      setSavingWidget(false);
      return;
    }

    if (payload.widget) {
      updateProjetoData((current) => ({
        ...current,
        widgets: upsertById(current.widgets, payload.widget!),
      }));
    }
    const message = widgetForm.id ? "Widget atualizado com sucesso." : "Widget criado com sucesso.";
    resetWidgetForm();
    setSavingWidget(false);
    setWidgetModalOpen(false);
    setFeedbackWidget(message);
  };

  const handleConnectorSubmit = async () => {
    setSavingConnector(true);
    setFeedbackConnector(null);

    const response = await fetch("/api/admin/conectores", {
      method: connectorForm.id ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: connectorForm.id,
        nome: connectorForm.nome,
        tipo: connectorForm.tipo,
        projetoId: params.id,
        agenteId: connectorForm.agenteId,
        endpointBase: connectorForm.endpointBase,
        configuracoes: {
          app_id: connectorForm.appId.trim() || undefined,
          client_secret: connectorForm.clientSecret.trim() || undefined,
          seller_id: connectorForm.sellerId.trim(),
          nickname: connectorForm.nickname.trim() || undefined,
          access_token: connectorForm.accessToken.trim() || undefined,
        },
        ativo: connectorForm.ativo,
      }),
    });

    const payload = (await response.json()) as { error?: string; conector?: Connector };
    if (!response.ok) {
      setFeedbackConnector(payload.error ?? "Nao foi possivel salvar o conector.");
      setSavingConnector(false);
      return;
    }

    if (payload.conector) {
      updateProjetoData((current) => ({
        ...current,
        conectores: upsertById(current.conectores, payload.conector!),
      }));
    }

    if (!connectorForm.id && payload.conector) {
      setConnectorForm({
        id: payload.conector.id,
        nome: payload.conector.nome,
        tipo: payload.conector.tipo === "mercado_livre" ? "mercado_livre" : "mercado_livre",
        projetoId: payload.conector.projetoId ?? params.id,
        agenteId: payload.conector.agenteId,
        endpointBase: payload.conector.endpointBase || "https://api.mercadolibre.com",
        appId: payload.conector.configuracoes?.app_id ?? "",
        clientSecret: payload.conector.configuracoes?.client_secret ?? "",
        sellerId: payload.conector.configuracoes?.seller_id ?? "",
        nickname: payload.conector.configuracoes?.nickname ?? "",
        accessToken: payload.conector.configuracoes?.access_token ?? "",
        ativo: payload.conector.ativo,
      });
      setSavingConnector(false);
      setFeedbackConnector("Integracao criada com sucesso. Agora clique em Conectar Mercado Livre para autorizar a loja.");
      return;
    }

    const message = connectorForm.id ? "Integracao atualizada com sucesso." : "Integracao criada com sucesso.";
    resetConnectorForm();
    setSavingConnector(false);
    setConnectorModalOpen(false);
    replaceProjectUrl((nextParams) => {
      nextParams.set("tab", "mercado");
      nextParams.delete("fonte");
    });
    setFeedbackConnector(message);
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
      updateProjetoData((current) => ({
        ...current,
        apis: upsertById(current.apis, testedApi),
      }));
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

  const handleEditConnector = (connector: Connector) => {
    setConnectorForm({
      id: connector.id,
      nome: connector.nome,
      tipo: connector.tipo === "mercado_livre" ? "mercado_livre" : "mercado_livre",
      projetoId: connector.projetoId ?? params.id,
      agenteId: connector.agenteId,
      endpointBase: connector.endpointBase || "https://api.mercadolibre.com",
      appId: connector.configuracoes?.app_id ?? "",
      clientSecret: connector.configuracoes?.client_secret ?? "",
      sellerId: connector.configuracoes?.seller_id ?? "",
      nickname: connector.configuracoes?.nickname ?? "",
      accessToken: connector.configuracoes?.access_token ?? "",
      ativo: connector.ativo,
    });
    setFeedbackConnector(null);
    replaceProjectUrl((nextParams) => {
      nextParams.set("tab", "mercado");
      if (connector.id) {
        nextParams.set("fonte", connector.id);
      }
    });
    setConnectorModalOpen(true);
  };

  const handleCloseConnectorModal = () => {
    setConnectorModalOpen(false);
    resetConnectorForm();
    replaceProjectUrl((nextParams) => {
      nextParams.set("tab", "mercado");
      nextParams.delete("fonte");
    });
  };

  const handleEditWhatsAppChannel = (channel: WhatsAppChannel) => {
    setWhatsAppChannelForm({
      id: channel.id,
      numero: formatWhatsAppPhone(channel.numero),
      agenteId: channel.agenteId,
      status: channel.status,
    });
    setFeedbackWhatsApp(null);
    setWhatsAppChannelModalOpen(true);
  };

  const handleSaveWhatsAppChannel = async () => {
    setSavingWhatsAppChannel(true);
    setFeedbackWhatsApp(null);

    const response = await fetch("/api/admin/whatsapp-canais", {
      method: whatsAppChannelForm.id ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: whatsAppChannelForm.id,
        projetoId: params.id,
        agenteId: whatsAppChannelForm.agenteId,
        numero: sanitizePhoneDigits(whatsAppChannelForm.numero),
        status: whatsAppChannelForm.status,
      }),
    });

    const payload = (await response.json()) as { error?: string; channel?: WhatsAppChannel };
    if (!response.ok) {
      setFeedbackWhatsApp(payload.error ?? "Nao foi possivel salvar o canal WhatsApp.");
      setSavingWhatsAppChannel(false);
      return;
    }

    if (payload.channel) {
      updateProjetoData((current) => ({
        ...current,
        whatsappChannels: upsertById(current.whatsappChannels, payload.channel!),
      }));
    }
    setSavingWhatsAppChannel(false);
    setFeedbackWhatsApp(whatsAppChannelForm.id ? "Canal WhatsApp atualizado com sucesso." : "Canal WhatsApp criado com sucesso.");
    setWhatsAppChannelModalOpen(false);
    resetWhatsAppChannelForm();
  };

  const handleConnectWhatsAppChannel = async (channel: WhatsAppChannel) => {
    const serviceUrl = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL?.trim();
    if (!serviceUrl) {
      setFeedbackWhatsApp("Defina NEXT_PUBLIC_WHATSAPP_SERVICE_URL para conectar o whatsapp-service.");
      return;
    }

    setConnectingWhatsAppChannelId(channel.id);
    setFeedbackWhatsApp(null);

    try {
      const connectResponse = await fetch(`${serviceUrl.replace(/\/$/, "")}/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelId: channel.id,
          projetoId: channel.projetoId,
          agenteId: channel.agenteId,
          numero: channel.numero,
        }),
      });

      const connectPayload = (await connectResponse.json()) as { error?: string };
      if (!connectResponse.ok) {
        throw new Error(connectPayload.error ?? "Nao foi possivel iniciar o whatsapp-service.");
      }

      await fetch(`/api/admin/whatsapp-canais/${channel.id}/connect`, { method: "POST" });
      updateProjetoData((current) => ({
        ...current,
        whatsappChannels: current.whatsappChannels.map((entry) =>
          entry.id === channel.id
            ? {
                ...entry,
                sessionData: {
                  ...entry.sessionData,
                  connectionStatus: "connecting",
                },
              }
            : entry,
        ),
      }));
      await refreshWhatsAppRuntime(channel.id);
      setFeedbackWhatsApp(`Conexao iniciada para ${formatWhatsAppPhone(channel.numero)}.`);
    } catch (error) {
      setFeedbackWhatsApp(error instanceof Error ? error.message : "Nao foi possivel conectar o WhatsApp.");
    } finally {
      setConnectingWhatsAppChannelId(null);
    }
  };

  const handleDisconnectWhatsAppChannel = async (channel: WhatsAppChannel) => {
    const serviceUrl = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL?.trim();

    setDisconnectingWhatsAppChannelId(channel.id);
    setFeedbackWhatsApp(null);

    try {
      if (serviceUrl) {
        await fetch(`${serviceUrl.replace(/\/$/, "")}/disconnect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channelId: channel.id,
          }),
        });
      }

      await fetch(`/api/admin/whatsapp-canais/${channel.id}/disconnect`, { method: "POST" });
      setServiceQrByChannel((current) => ({
        ...current,
        [channel.id]: null,
      }));
      setServiceStatusByChannel((current) => ({
        ...current,
        [channel.id]: "desconectado",
      }));
      updateProjetoData((current) => ({
        ...current,
        whatsappChannels: current.whatsappChannels.map((entry) =>
          entry.id === channel.id
            ? {
                ...entry,
                sessionData: {
                  ...entry.sessionData,
                  connectionStatus: "offline",
                  qrCodeDataUrl: null,
                  qrCodeUrl: null,
                },
              }
            : entry,
        ),
      }));
      setFeedbackWhatsApp(`Canal ${formatWhatsAppPhone(channel.numero)} desconectado.`);
    } catch (error) {
      setFeedbackWhatsApp(error instanceof Error ? error.message : "Nao foi possivel desconectar o WhatsApp.");
    } finally {
      setDisconnectingWhatsAppChannelId(null);
    }
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

    updateProjetoData((current) => ({
      ...current,
      apis: removeById(current.apis, api.id),
      agentes: current.agentes.map((agente) => ({
        ...agente,
        apiIds: agente.apiIds.filter((apiId) => apiId !== api.id),
      })),
    }));
    if (apiForm.id === api.id) {
      resetApiForm();
    }
    setFeedbackApi(`API "${api.nome}" excluida com sucesso.`);
  };

  const handleDeleteAgente = async (agente: Agente) => {
    setAgentePendingDelete(agente);
    setDeleteAgenteConfirmation("");
    setDeleteAgenteModalOpen(true);
  };

  const confirmDeleteAgente = async () => {
    if (!agentePendingDelete) {
      return;
    }

    setDeletingAgenteId(agentePendingDelete.id);
    setFeedbackAgente(null);

    try {
      const response = await fetch("/api/admin/agentes", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: agentePendingDelete.id,
          projetoId: params.id,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFeedbackAgente(payload.error ?? "Nao foi possivel excluir o agente.");
        return;
      }

      await loadProjeto();
      if (agenteForm.id === agentePendingDelete.id) {
        resetAgenteForm();
      }
      setDeleteAgenteModalOpen(false);
      setDeleteAgenteConfirmation("");
      setAgentePendingDelete(null);
      setFeedbackAgente(`Agente "${agentePendingDelete.nome}" removido completamente.`);
    } finally {
      setDeletingAgenteId(null);
    }
  };

  const handleDeleteConnector = async (connector: Connector) => {
    if (!connector.id) {
      return;
    }

    setConnectorPendingDelete(connector);
    setDeleteConnectorConfirmation("");
    setDeleteConnectorModalOpen(true);
  };

  const confirmDeleteConnector = async () => {
    if (!connectorPendingDelete?.id) {
      return;
    }

    setDeletingConnectorId(connectorPendingDelete.id);
    setFeedbackConnector(null);

    try {
      const response = await fetch("/api/admin/conectores", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: connectorPendingDelete.id,
          projetoId: params.id,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFeedbackConnector(payload.error ?? "Nao foi possivel excluir a integracao.");
        return;
      }

      updateProjetoData((current) => ({
        ...current,
        conectores: removeById(current.conectores, connectorPendingDelete.id!),
      }));
      if (connectorForm.id === connectorPendingDelete.id) {
        resetConnectorForm();
      }
      setDeleteConnectorModalOpen(false);
      setDeleteConnectorConfirmation("");
      setConnectorPendingDelete(null);
      setFeedbackConnector(`Integracao "${connectorPendingDelete.nome}" removida completamente.`);
    } finally {
      setDeletingConnectorId(null);
    }
  };

  const handleDeleteWidget = async (widget: ChatWidget) => {
    const confirmed = window.confirm(`Remover completamente o widget "${widget.nome}"?`);
    if (!confirmed || !widget.id) {
      return;
    }

    setDeletingWidgetId(widget.id);
    setFeedbackWidget(null);

    try {
      const response = await fetch("/api/admin/chat-widgets", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: widget.id,
          projetoId: params.id,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFeedbackWidget(payload.error ?? "Nao foi possivel excluir o widget.");
        return;
      }

      updateProjetoData((current) => ({
        ...current,
        widgets: removeById(current.widgets, widget.id!),
      }));
      if (widgetForm.id === widget.id) {
        resetWidgetForm();
      }
      setFeedbackWidget(`Widget "${widget.nome}" removido completamente.`);
    } finally {
      setDeletingWidgetId(null);
    }
  };

  const handleDeleteWhatsAppChannel = async (channel: WhatsAppChannel) => {
    setWhatsAppChannelPendingDelete(channel);
    setDeleteWhatsAppChannelConfirmation("");
    setDeleteWhatsAppChannelModalOpen(true);
  };

  const confirmDeleteWhatsAppChannel = async () => {
    if (!whatsAppChannelPendingDelete) {
      return;
    }

    setDeletingWhatsAppChannelId(whatsAppChannelPendingDelete.id);
    setFeedbackWhatsApp(null);

    try {
      const serviceUrl = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL?.trim();
      if (serviceUrl) {
        await fetch(`${serviceUrl.replace(/\/$/, "")}/disconnect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channelId: whatsAppChannelPendingDelete.id,
          }),
        });
      }

      const response = await fetch("/api/admin/whatsapp-canais", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: whatsAppChannelPendingDelete.id,
          projetoId: params.id,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFeedbackWhatsApp(payload.error ?? "Nao foi possivel excluir o canal WhatsApp.");
        return;
      }

      setServiceQrByChannel((current) => ({
        ...current,
        [whatsAppChannelPendingDelete.id]: null,
      }));
      setServiceStatusByChannel((current) => ({
        ...current,
        [whatsAppChannelPendingDelete.id]: "desconectado",
      }));
      updateProjetoData((current) => ({
        ...current,
        whatsappChannels: removeById(current.whatsappChannels, whatsAppChannelPendingDelete.id),
      }));
      if (whatsAppChannelForm.id === whatsAppChannelPendingDelete.id) {
        resetWhatsAppChannelForm();
      }
      setDeleteWhatsAppChannelModalOpen(false);
      setDeleteWhatsAppChannelConfirmation("");
      setWhatsAppChannelPendingDelete(null);
      setFeedbackWhatsApp(`Canal ${formatWhatsAppPhone(whatsAppChannelPendingDelete.numero)} removido completamente.`);
    } finally {
      setDeletingWhatsAppChannelId(null);
    }
  };

  const handleDeleteProject = async () => {
    const projectName = data?.projeto.nome ?? "este projeto";
    if (deleteProjectConfirmation.trim() !== projectName.trim()) {
      setFeedbackWhatsApp("Digite o nome exato do projeto para confirmar a exclusao.");
      return;
    }

    setDeletingProject(true);
    setFeedbackWhatsApp(null);
    let redirecting = false;

    try {
      const response = await fetch(`/api/admin/projetos/${params.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string; detail?: string | null };
      if (!response.ok) {
        setFeedbackWhatsApp(payload.detail ? `${payload.error ?? "Nao foi possivel excluir o projeto."} ${payload.detail}` : payload.error ?? "Nao foi possivel excluir o projeto.");
        return;
      }

      redirecting = true;
      if (typeof window !== "undefined" && window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) === params.id) {
        window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
      }
      setDeletingProjectRedirecting(true);
      setDeleteProjectModalOpen(false);
      setDeleteProjectConfirmation("");
      router.replace("/admin/projetos");
    } finally {
      if (!redirecting) {
        setDeletingProject(false);
      }
    }
  };

  const handleSaveBillingPlan = async () => {
    if (!data?.billing?.canManage) {
      return;
    }

    setSavingBillingPlan(true);
    setFeedbackBilling(null);

    try {
      const response = await fetch(`/api/admin/projetos/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(billingPlanForm),
      });

      const payload = (await response.json()) as {
        error?: string;
        plan?: ProjetoPlanoBilling;
      };

      if (!response.ok || !payload.plan) {
        setFeedbackBilling(payload.error ?? "Nao foi possivel salvar o plano do projeto.");
        return;
      }

      const savedPlan = payload.plan;
      setBillingPlanForm(createBillingPlanForm({
        canManage: data.billing.canManage,
        currentUsage: data.billing.currentUsage,
        plan: savedPlan,
        pricingModels: data.billing.pricingModels,
        windowLabel: data.billing.windowLabel,
      }));
      updateProjetoData((current) => ({
        ...current,
        billing: current.billing
          ? {
              ...current.billing,
              plan: savedPlan,
            }
          : current.billing,
      }));
      setFeedbackBilling("Plano do projeto atualizado.");
    } finally {
      setSavingBillingPlan(false);
    }
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

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "agentes" || tabParam === "apis" || tabParam === "whatsapp" || tabParam === "mercado" || tabParam === "chats") {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== "agentes") {
      setAgentTestTarget(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, params.id as string);
  }, [params.id]);

  useEffect(() => {
    return () => {
      if (tabSwitchTimeoutRef.current) {
        window.clearTimeout(tabSwitchTimeoutRef.current);
      }
      if (tabRevealTimeoutRef.current) {
        window.clearTimeout(tabRevealTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (tabSwitchTimeoutRef.current) {
      window.clearTimeout(tabSwitchTimeoutRef.current);
    }
    if (tabRevealTimeoutRef.current) {
      window.clearTimeout(tabRevealTimeoutRef.current);
    }

    if (activeTab === renderedTab) {
      setTabContentVisible(true);
      return;
    }

    setTabContentVisible(false);
    tabSwitchTimeoutRef.current = window.setTimeout(() => {
      setRenderedTab(activeTab);
      tabRevealTimeoutRef.current = window.setTimeout(() => {
        setTabContentVisible(true);
      }, 28);
    }, 140);
  }, [activeTab, renderedTab]);

  useEffect(() => {
    if (!data) {
      return;
    }

    const fonteId = searchParams.get("fonte");
    if (!fonteId) {
      return;
    }

    const connector = data.conectores.find((item) => item.id === fonteId);
    if (!connector) {
      return;
    }

    setActiveTab("mercado");
    setConnectorForm({
      id: connector.id,
      nome: connector.nome,
      tipo: connector.tipo === "mercado_livre" ? "mercado_livre" : "mercado_livre",
      projetoId: connector.projetoId ?? params.id,
      agenteId: connector.agenteId,
      endpointBase: connector.endpointBase || "https://api.mercadolibre.com",
      appId: connector.configuracoes?.app_id ?? "",
      clientSecret: connector.configuracoes?.client_secret ?? "",
      sellerId: connector.configuracoes?.seller_id ?? "",
      nickname: connector.configuracoes?.nickname ?? "",
      accessToken: connector.configuracoes?.access_token ?? "",
      ativo: connector.ativo,
    });
    setFeedbackConnector(null);
    setConnectorModalOpen(true);
  }, [data, params.id, searchParams]);

  if (deletingProjectRedirecting) {
    return (
      <main className="space-y-6">
        <section className="px-1 py-2">
          <PremiumLoader />
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="space-y-6">
        <section className="px-1 py-2">
          <PremiumLoader />
        </section>
      </main>
    );
  }

  const agenteAtivo = data.agentes.find((agente) => agente.ativo) ?? null;
  const activeAgentTestTarget = agentTestTarget ? data.agentes.find((agente) => agente.id === agentTestTarget.id) ?? agentTestTarget : null;
  const primaryWhatsAppChannel = data.whatsappChannels[0] ?? null;
  const recentWhatsAppChats = data.chats
    .filter((chat) => isWhatsAppChatChannel(chat))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 3);
  const overviewStats = [
    { key: "agentes", label: "Agentes", value: data.stats.totalAgentes, icon: Bot, tone: "text-cyan-100", glow: "bg-cyan-400/16" },
    { key: "apis", label: "APIs", value: data.stats.totalApis, icon: Activity, tone: "text-sky-100", glow: "bg-sky-400/16" },
    { key: "conectores", label: "Integracoes", value: data.stats.totalConectores, icon: Cable, tone: "text-violet-100", glow: "bg-violet-400/16" },
    { key: "widgets", label: "Widgets", value: data.stats.totalWidgets, icon: PanelsTopLeft, tone: "text-amber-100", glow: "bg-amber-400/16" },
    { key: "whatsapp", label: "WhatsApp", value: data.stats.totalWhatsAppChannels, icon: Waypoints, tone: "text-emerald-100", glow: "bg-emerald-400/16" },
    { key: "chats", label: "Chats", value: data.stats.totalChats, icon: MessageSquareText, tone: "text-rose-100", glow: "bg-rose-400/16" },
  ] as const;
  const projectTabs = [
    {
      key: "agentes" as const,
      label: "Agentes",
      icon: Bot,
      activeClass: "border-cyan-400/30 bg-cyan-400/14 text-cyan-50 shadow-[0_10px_25px_rgba(34,211,238,0.12)]",
      inactiveClass: "border-white/10 bg-white/[0.04] text-slate-200 hover:border-cyan-400/18 hover:bg-cyan-400/[0.08] hover:text-cyan-50",
    },
    {
      key: "apis" as const,
      label: "APIs",
      icon: Activity,
      activeClass: "border-sky-400/30 bg-sky-400/14 text-sky-50 shadow-[0_10px_25px_rgba(56,189,248,0.12)]",
      inactiveClass: "border-white/10 bg-white/[0.04] text-slate-200 hover:border-sky-400/18 hover:bg-sky-400/[0.08] hover:text-sky-50",
    },
    {
      key: "whatsapp" as const,
      label: "WhatsApp",
      icon: Waypoints,
      activeClass: "border-emerald-400/30 bg-emerald-400/14 text-emerald-50 shadow-[0_10px_25px_rgba(52,211,153,0.12)]",
      inactiveClass: "border-white/10 bg-white/[0.04] text-slate-200 hover:border-emerald-400/18 hover:bg-emerald-400/[0.08] hover:text-emerald-50",
    },
    {
      key: "mercado" as const,
      label: "Mercado Livre",
      icon: Cable,
      activeClass: "border-amber-400/30 bg-amber-400/14 text-amber-50 shadow-[0_10px_25px_rgba(251,191,36,0.12)]",
      inactiveClass: "border-white/10 bg-white/[0.04] text-slate-200 hover:border-amber-400/18 hover:bg-amber-400/[0.08] hover:text-amber-50",
    },
    {
      key: "chats" as const,
      label: "Chats",
      icon: MessageSquareText,
      activeClass: "border-violet-400/30 bg-violet-400/14 text-violet-50 shadow-[0_10px_25px_rgba(167,139,250,0.12)]",
      inactiveClass: "border-white/10 bg-white/[0.04] text-slate-200 hover:border-violet-400/18 hover:bg-violet-400/[0.08] hover:text-violet-50",
    },
  ];
  const selectedBillingModel =
    data.billing?.pricingModels.find((item) => item.id === billingPlanForm.modeloReferencia) ??
    data.billing?.pricingModels.find((item) => item.id === data.billing?.plan.modeloReferencia) ??
    null;
  const tabContentTransitionClass = `transition-[opacity] duration-150 ease-out ${tabContentVisible ? "opacity-100" : "pointer-events-none opacity-0"}`;

  return (
    <main className="space-y-6">
      <section className="px-1 py-1">
          <div className="space-y-3">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-100/90">
                  <Sparkles size={13} />
                  Projeto
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-black tracking-tight text-white sm:text-[2.15rem]">{data.projeto.nome}</h1>
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
                      <CheckCircle2 size={12} />
                      {data.projeto.status ?? "ativo"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteProjectConfirmation("");
                        setDeleteProjectModalOpen(true);
                      }}
                      disabled={deletingProject}
                      className="infra-click-pulse inline-flex items-center justify-center gap-2 rounded-full border border-rose-400/14 bg-rose-400/[0.07] px-3 py-1 text-[11px] font-semibold text-rose-100 transition-all hover:border-rose-300/24 hover:bg-rose-400/[0.11] disabled:opacity-60"
                    >
                      <Trash2 size={12} />
                      {deletingProject ? "Removendo..." : "Remover"}
                    </button>
                  </div>
                  <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-[15px]">
                    {data.projeto.descricao || "Sem descricao cadastrada."}
                  </p>
                </div>
              </div>

              <Link
                href="/admin/projetos"
                className="infra-click-pulse inline-flex h-11 w-11 items-center justify-center self-start rounded-2xl border border-white/10 bg-white/5 text-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.18)] transition-all hover:border-white/20 hover:bg-white/10"
                aria-label="Voltar para projetos"
                title="Voltar para projetos"
              >
                <ArrowLeft size={18} />
              </Link>
            </div>

          </div>
      </section>

      {(feedbackAgente || feedbackApi || feedbackConnector || feedbackWidget || feedbackWhatsApp || feedbackBilling) && (
        <section className="grid gap-3">
          {feedbackAgente ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackAgente}</div> : null}
          {feedbackApi ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackApi}</div> : null}
          {feedbackConnector ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackConnector}</div> : null}
          {feedbackWidget ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackWidget}</div> : null}
          {feedbackWhatsApp ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackWhatsApp}</div> : null}
          {feedbackBilling ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackBilling}</div> : null}
        </section>
      )}

      <div className="space-y-4">
        {data.billing ? (
          <section className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_48px_rgba(2,8,23,0.22)] sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="inline-flex items-center gap-2 text-xl font-bold text-white"><Coins size={18} className="text-emerald-200" />Plano e consumo de IA</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Referencia financeira do projeto em {data.billing.windowLabel}, com {selectedBillingModel?.label ?? "GPT-4o Mini"} como base atual.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                <ShieldAlert size={13} className={billingPlanForm.bloqueado ? "text-rose-300" : billingPlanForm.autoBloquear ? "text-amber-200" : "text-emerald-200"} />
                {billingPlanForm.bloqueado ? "Bloqueio manual ativo" : billingPlanForm.autoBloquear ? "Bloqueio automatico ativo" : "Bloqueio automatico desligado"}
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-5">
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Modelo atual</p>
                <p className="mt-2 text-lg font-bold text-white">{selectedBillingModel?.label ?? data.billing.plan.modeloReferencia}</p>
                <p className="mt-1 text-xs text-slate-400">{data.billing.plan.nomePlano}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Tokens input</p>
                <p className="mt-2 text-2xl font-black text-white">{formatIntegerLabel(data.billing.currentUsage.tokensInput)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Tokens output</p>
                <p className="mt-2 text-2xl font-black text-white">{formatIntegerLabel(data.billing.currentUsage.tokensOutput)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Tokens totais</p>
                <p className="mt-2 text-2xl font-black text-white">{formatIntegerLabel(data.billing.currentUsage.totalTokens)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100/75">Custo atual</p>
                <p className="mt-2 text-2xl font-black text-white">{formatUsdLabel(data.billing.currentUsage.custoTotal)}</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-200">Nome do plano</span>
                  <input
                    value={billingPlanForm.nomePlano}
                    onChange={(event) => setBillingPlanForm((current) => ({ ...current, nomePlano: event.target.value }))}
                    disabled={!data.billing.canManage}
                    className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200"><Cpu size={15} className="text-cyan-200" />Modelo de referencia</span>
                  <select
                    value={billingPlanForm.modeloReferencia}
                    onChange={(event) => setBillingPlanForm((current) => ({ ...current, modeloReferencia: event.target.value }))}
                    disabled={!data.billing.canManage}
                    className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {data.billing.pricingModels.map((item) => (
                      <option key={item.id} value={item.id} className="bg-slate-950 text-white">
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-200">Limite mensal de tokens input</span>
                  <input
                    value={billingPlanForm.limiteTokensInputMensal}
                    onChange={(event) => setBillingPlanForm((current) => ({ ...current, limiteTokensInputMensal: event.target.value }))}
                    disabled={!data.billing.canManage}
                    inputMode="numeric"
                    placeholder="vazio = sem limite"
                    className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-200">Limite mensal de tokens output</span>
                  <input
                    value={billingPlanForm.limiteTokensOutputMensal}
                    onChange={(event) => setBillingPlanForm((current) => ({ ...current, limiteTokensOutputMensal: event.target.value }))}
                    disabled={!data.billing.canManage}
                    inputMode="numeric"
                    placeholder="vazio = sem limite"
                    className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-200">Limite mensal total de tokens</span>
                  <input
                    value={billingPlanForm.limiteTokensTotalMensal}
                    onChange={(event) => setBillingPlanForm((current) => ({ ...current, limiteTokensTotalMensal: event.target.value }))}
                    disabled={!data.billing.canManage}
                    inputMode="numeric"
                    placeholder="vazio = sem limite"
                    className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-200">Limite mensal de custo (USD)</span>
                  <input
                    value={billingPlanForm.limiteCustoMensal}
                    onChange={(event) => setBillingPlanForm((current) => ({ ...current, limiteCustoMensal: event.target.value.replace(",", ".") }))}
                    disabled={!data.billing.canManage}
                    inputMode="decimal"
                    placeholder="vazio = sem limite"
                    className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100/80">Tabela usada na referencia</p>
                  <p className="mt-2 text-sm font-semibold text-white">{selectedBillingModel?.label ?? "GPT-4o Mini"}</p>
                  <p className="mt-2 text-xs text-cyan-50/80">Input: {formatUsdLabel(selectedBillingModel?.inputPerMillionUsd ?? 0)} por 1M tokens</p>
                  <p className="mt-1 text-xs text-cyan-50/80">Output: {formatUsdLabel(selectedBillingModel?.outputPerMillionUsd ?? 0)} por 1M tokens</p>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span>
                    <span className="block text-sm font-semibold text-white">Bloqueio automatico</span>
                    <span className="mt-1 block text-xs text-slate-400">Interrompe consumo ao bater os limites configurados.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={billingPlanForm.autoBloquear}
                    onChange={(event) => setBillingPlanForm((current) => ({ ...current, autoBloquear: event.target.checked }))}
                    disabled={!data.billing.canManage}
                    className="h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400 disabled:cursor-not-allowed"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3">
                  <span>
                    <span className="block text-sm font-semibold text-white">Bloqueio manual</span>
                    <span className="mt-1 block text-xs text-rose-100/75">Forca a parada do uso mesmo sem atingir o limite.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={billingPlanForm.bloqueado}
                    onChange={(event) => setBillingPlanForm((current) => ({ ...current, bloqueado: event.target.checked }))}
                    disabled={!data.billing.canManage}
                    className="h-4 w-4 rounded border-white/20 bg-slate-950 text-rose-400 disabled:cursor-not-allowed"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-200">Motivo do bloqueio</span>
                  <textarea
                    value={billingPlanForm.bloqueadoMotivo}
                    onChange={(event) => setBillingPlanForm((current) => ({ ...current, bloqueadoMotivo: event.target.value }))}
                    disabled={!data.billing.canManage}
                    rows={3}
                    className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-200">Observacoes financeiras</span>
                  <textarea
                    value={billingPlanForm.observacoes}
                    onChange={(event) => setBillingPlanForm((current) => ({ ...current, observacoes: event.target.value }))}
                    disabled={!data.billing.canManage}
                    rows={4}
                    className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                {data.billing.canManage ? (
                  <button
                    type="button"
                    onClick={() => void handleSaveBillingPlan()}
                    disabled={savingBillingPlan}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white ${premiumInteractiveClass} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {savingBillingPlan ? <BusyIcon /> : <Coins size={16} />}
                    Salvar
                  </button>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                    Voce pode visualizar o plano, mas nao tem permissao para alterar as definicoes financeiras deste projeto.
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-8 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-3 shadow-[0_8px_18px_rgba(2,8,23,0.08)] sm:px-4">
          <button
            type="button"
            onClick={() => setProjectDetailsExpanded((current) => !current)}
            aria-expanded={projectDetailsExpanded}
            className="flex w-full items-center justify-between gap-3 rounded-2xl text-left transition-colors hover:text-white"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-200">Detalhes do projeto</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Painel auxiliar recolhido por padrao.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
              {projectDetailsExpanded ? "Ocultar" : "Mostrar"}
              <ChevronDown
                size={14}
                className={`transition-transform duration-300 ${projectDetailsExpanded ? "rotate-180" : "rotate-0"}`}
              />
            </span>
          </button>

          <div
            className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
              projectDetailsExpanded ? "mt-3 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="grid gap-2 pt-1 sm:grid-cols-2 xl:grid-cols-3">
                {overviewStats.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.key}
                      className="relative overflow-hidden rounded-xl border border-white/8 bg-slate-950/25 px-3 py-2.5 shadow-[0_8px_18px_rgba(2,8,23,0.1)]"
                    >
                      <div className={`pointer-events-none absolute right-3 top-3 ${item.tone} opacity-20`}>
                        <Icon size={18} />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                      <p className="mt-2 text-2xl font-black leading-none text-slate-100">{item.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div ref={tabsAnchorRef} className="mt-8" style={{ minHeight: tabsBarHeight ? `${tabsBarHeight}px` : undefined }}>
          <section
            ref={tabsBarRef}
            style={tabsPinned ? { left: `${tabsBarLeft}px` } : undefined}
            className={`${tabsPinned ? "fixed top-3 z-40" : "relative"} flex w-max max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-center gap-2 rounded-[26px] px-3 py-3 transition-[background-color,box-shadow,opacity] duration-150 ease-out ${tabsPinned ? "bg-[#07111f]/82 shadow-[0_12px_24px_rgba(2,8,23,0.24)] backdrop-blur-sm" : "bg-transparent shadow-none backdrop-blur-0"}`}
          >
              {projectTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.key);
                      replaceProjectUrl((nextParams) => {
                        nextParams.set("tab", tab.key);
                        nextParams.delete("fonte");
                      });
                    }}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold ${premiumInteractiveClass} ${
                      active
                        ? tab.activeClass
                        : tab.inactiveClass
                    }`}
                  >
                    <Icon size={15} />
                    {tab.label}
                  </button>
                );
              })}
          </section>
        </div>

        <section className={`${renderedTab === "agentes" ? "block" : "hidden"} ${premiumTransitionClass} ${tabContentTransitionClass}`}>
          <div className="flex flex-col gap-4 px-2 py-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="inline-flex items-center gap-2 text-xl font-bold text-white"><Bot size={18} className="text-cyan-200" />Agentes do projeto</h3>
              <p className="mt-1 text-sm text-slate-400">O agente ativo atende este projeto e pode consumir as APIs marcadas.</p>
            </div>
            <button
              type="button"
              onClick={openNewAgenteModal}
              className={`inline-flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-50 shadow-[0_10px_30px_rgba(56,189,248,0.12)] transition-all hover:border-sky-300/30 hover:bg-sky-400/14 ${premiumInteractiveClass}`}
            >
              <Plus size={16} />
              Novo agente
            </button>
          </div>
          {renderedTab === "agentes" && activeAgentTestTarget ? (
            <EmbeddedAgentTestChat
              key={activeAgentTestTarget.id}
              projeto={data.projeto}
              agente={activeAgentTestTarget}
              origin={origin}
            />
          ) : null}
          <div className="pt-2">
            {data.agentes.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[...data.agentes].sort((left, right) => {
                  if (left.ativo !== right.ativo) {
                    return left.ativo ? -1 : 1;
                  }

                  return left.nome.localeCompare(right.nome, "pt-BR");
                }).map((agente) => {
                const linkedApis = getAgentLinkedApis(agente);
                const inactiveApis = getAgentInactiveApis(agente);
                const requiredParameters = getAgentRequiredParameters(agente);
                const agentWidgets = getAgentWidgets(agente);
                const activeAgentWidgets = agentWidgets.filter((widget) => widget.ativo);
                const agentWhatsAppChannels = getAgentWhatsAppChannels(agente);
                const onlineAgentWhatsAppChannels = agentWhatsAppChannels.filter((channel) => {
                  const runtimeStatus = serviceStatusByChannel[channel.id] ?? getChannelStatusLabel(channel.sessionData?.connectionStatus);
                  return runtimeStatus === "conectado" || runtimeStatus === "online";
                });
                const agentConnectors = getAgentConnectors(agente);
                const activeAgentConnectors = agentConnectors.filter((connector) => connector.ativo);
                const diagnostic = agentDiagnosticsById[agente.id];
                const latestDiagnostic = latestAgentDiagnosticById[agente.id];
                const miniSummaryParts = [
                  linkedApis.length ? `${linkedApis.length} API${linkedApis.length > 1 ? "s" : ""}` : null,
                  requiredParameters.length ? `${requiredParameters.length} contexto${requiredParameters.length > 1 ? "s" : ""}` : null,
                  agentWhatsAppChannels.length ? `${agentWhatsAppChannels.length} WhatsApp` : null,
                  agentConnectors.length ? `${agentConnectors.length} loja${agentConnectors.length > 1 ? "s" : ""}` : null,
                  agentWidgets.length ? `${agentWidgets.length} widget${agentWidgets.length > 1 ? "s" : ""}` : null,
                ].filter(Boolean);
                const miniSummary = miniSummaryParts.length
                  ? `Configurado com ${miniSummaryParts.join(", ")}.`
                  : "Ainda sem canais, APIs ou integrações vinculadas.";
                const agentCardPreview = (() => {
                  const source = normalizeAgentText(agente.promptBase || agente.descricao || "");
                  if (!source) {
                    return "Sem texto principal cadastrado ainda.";
                  }

                  return `${source.slice(0, 180)}${source.length > 180 ? "..." : ""}`;
                })();
                const agentOptions = [
                  {
                    key: "apis",
                    label: "APIs",
                    icon: Activity,
                    active: linkedApis.length > 0,
                    detail: linkedApis.length,
                    activeClass: "text-sky-100",
                    inactiveClass: "text-slate-500",
                  },
                  {
                    key: "whatsapp",
                    label: "WhatsApp",
                    icon: Waypoints,
                    active: agentWhatsAppChannels.length > 0,
                    detail: onlineAgentWhatsAppChannels.length > 0 ? onlineAgentWhatsAppChannels.length : agentWhatsAppChannels.length,
                    activeClass: "text-emerald-100",
                    inactiveClass: "text-slate-500",
                  },
                  {
                    key: "mercado",
                    label: "Mercado Livre",
                    icon: Cable,
                    active: agentConnectors.length > 0,
                    detail: activeAgentConnectors.length > 0 ? activeAgentConnectors.length : agentConnectors.length,
                    activeClass: "text-amber-100",
                    inactiveClass: "text-slate-500",
                  },
                  {
                    key: "widgets",
                    label: "Widgets",
                    icon: PanelsTopLeft,
                    active: agentWidgets.length > 0,
                    detail: activeAgentWidgets.length > 0 ? activeAgentWidgets.length : agentWidgets.length,
                    activeClass: "text-violet-100",
                    inactiveClass: "text-slate-500",
                  },
                  {
                    key: "chats",
                    label: "Chats",
                    icon: MessageSquareText,
                    active: (diagnostic?.summary.chats ?? 0) > 0,
                    detail: diagnostic?.summary.chats ?? 0,
                    activeClass: "text-rose-100",
                    inactiveClass: "text-slate-500",
                  },
                ] as const;

                return (
                  <article key={agente.id} className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-cyan-400/12 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),rgba(255,255,255,0.03)_24%,rgba(255,255,255,0.012)_60%)] p-4 shadow-[0_18px_40px_rgba(2,8,23,0.24),0_0_0_1px_rgba(34,211,238,0.04)] ${premiumTransitionClass}`}>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent"
                    />
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute right-4 top-4 ${
                        agente.ativo
                          ? "text-cyan-300/40 animate-pulse drop-shadow-[0_0_18px_rgba(34,211,238,0.35)]"
                          : "text-slate-500/28"
                      }`}
                    >
                      <Bot size={34} strokeWidth={1.6} />
                    </div>

                    <div className="relative flex items-start justify-between gap-3 pr-12">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-base font-bold text-white">{agente.nome}</h4>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${agente.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                            {agente.ativo ? "ativo" : "inativo"}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">{agente.descricao || "Sem descrição."}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Trecho do agente</p>
                      <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-slate-200">{agentCardPreview}</p>
                      {requiredParameters.length ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-cyan-100/80">
                          {requiredParameters.map((parametro) => parametro.nome).join(", ")}
                        </p>
                      ) : null}
                      {inactiveApis.length ? (
                        <p className="mt-2 text-xs text-amber-200/80">
                          {inactiveApis.length} API{inactiveApis.length > 1 ? "s" : ""} vinculada{inactiveApis.length > 1 ? "s" : ""} estao inativas.
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {agentOptions.map((option) => {
                        const Icon = option.icon;

                        return (
                          <span
                            key={option.key}
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                              option.active ? option.activeClass : option.inactiveClass
                            }`}
                          >
                            <Icon size={13} />
                            {option.label}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${option.active ? "bg-black/15 text-current" : "bg-white/5 text-slate-400"}`}>
                              {option.detail}
                            </span>
                          </span>
                        );
                      })}
                    </div>

                    {latestDiagnostic ? (
                      <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${latestDiagnostic.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"}`}>
                            {latestDiagnostic.ok ? "validado" : "com alertas"}
                          </span>
                          {diagnostic ? (
                            <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                              {diagnostic.summary.activeConnectors}/{diagnostic.summary.connectors} fontes
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <p className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2 text-slate-300">
                            Chat: <span className={latestDiagnostic.checks.chat.ok ? "text-emerald-300" : "text-amber-200"}>{latestDiagnostic.checks.chat.detail}</span>
                          </p>
                          <p className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2 text-slate-300">
                            WhatsApp: <span className={latestDiagnostic.checks.whatsapp.ok ? "text-emerald-300" : "text-amber-200"}>{latestDiagnostic.checks.whatsapp.detail}</span>
                          </p>
                          <p className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2 text-slate-300">
                            Loja: <span className={latestDiagnostic.checks.connectors.ok ? "text-emerald-300" : "text-amber-200"}>{latestDiagnostic.checks.connectors.detail}</span>
                          </p>
                          <p className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2 text-slate-300">
                            Agente: <span className={latestDiagnostic.checks.agent.ok ? "text-emerald-300" : "text-amber-200"}>{latestDiagnostic.checks.agent.detail}</span>
                          </p>
                        </div>
                        {diagnostic ? (
                          <div className="mt-3 space-y-2 text-xs text-slate-300">
                            <p>
                              Conectado em:{" "}
                              <span className="text-slate-200">
                                {[
                                  diagnostic.connections.widgets.length ? `${diagnostic.connections.widgets.length} widget(s)` : null,
                                  diagnostic.connections.whatsappChannels.length ? `${diagnostic.connections.whatsappChannels.length} WhatsApp` : null,
                                  diagnostic.connections.connectors.length ? `${diagnostic.connections.connectors.length} fonte(s)` : null,
                                  diagnostic.connections.apis.length ? `${diagnostic.connections.apis.length} API(s)` : null,
                                ].filter(Boolean).join(" | ") || "sem vínculos diretos"}
                              </span>
                            </p>
                            {diagnostic.warnings.length ? (
                              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-100/85">
                                {diagnostic.warnings.join(" | ")}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-5 border-t border-white/10 pt-4">
                      <div className="rounded-2xl border border-white/8 bg-slate-950/45 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <button
                        type="button"
                        onClick={() => void handleRunAgentDiagnostic(agente)}
                        disabled={runningAgentDiagnosticId === agente.id}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-50 transition-all hover:border-sky-300/30 hover:bg-sky-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {runningAgentDiagnosticId === agente.id ? <BusyIcon /> : <TestTube2 size={14} />}
                        Validar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAgentTestChat(agente)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-50 transition-all hover:border-emerald-300/30 hover:bg-emerald-500/14 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <TestTube2 size={14} />
                        Testar o agente
                      </button>
                      <button type="button" onClick={() => handleEditAgente(agente)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-50 transition-all hover:border-amber-300/30 hover:bg-amber-500/14 disabled:cursor-not-allowed disabled:opacity-60">
                        <Pencil size={14} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAgente(agente)}
                        disabled={deletingAgenteId === agente.id}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-50 transition-all hover:border-rose-300/30 hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                        {deletingAgenteId === agente.id ? "Removendo..." : "Remover"}
                      </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">Nenhum agente cadastrado para este projeto ainda.</div>
            )}
          </div>
        </section>

        <section className={`${renderedTab === "apis" ? "block" : "hidden"} ${premiumTransitionClass} ${tabContentTransitionClass}`}>
          <div className="flex flex-col gap-4 px-2 py-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="inline-flex items-center gap-2 text-xl font-bold text-white"><Activity size={18} className="text-sky-200" />APIs do projeto</h3>
              <p className="mt-1 text-sm text-slate-400">Gerencie as APIs externas, teste o retorno e controle os campos ativos.</p>
            </div>
            <button type="button" onClick={openNewApiModal} className={`${headerActionButtonClass} ${premiumInteractiveClass}`}>
              <Plus size={16} />
              Nova API
            </button>
          </div>
          <div className="space-y-3 pt-2">
            {data.apis.length ? (
              data.apis.map((api) => (
                    <div key={api.id} className={`rounded-xl border border-white/10 bg-slate-950/30 p-4 ${premiumTransitionClass}`}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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
                      <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
                      <button type="button" onClick={() => handleEditApi(api)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${editButtonClass}`}>
                        <Pencil size={14} />
                        Editar
                      </button>
                      <button type="button" onClick={() => void handleDeleteApi(api)} className={dangerActionButtonClass}>
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

      <section className={`${renderedTab === "mercado" ? "block" : "hidden"} ${premiumTransitionClass} ${tabContentTransitionClass}`}>
        <div className="space-y-6">
          <section>
            <div className="flex flex-col gap-4 px-2 py-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="inline-flex items-center gap-2 text-xl font-bold text-white"><Cable size={18} className="text-violet-200" />Mercado Livre</h3>
                <p className="mt-1 text-sm text-slate-400">Gerencie aqui as lojas e credenciais do Mercado Livre deste projeto.</p>
              </div>
              <button type="button" onClick={openNewConnectorModal} className={`${headerActionButtonClass} ${premiumInteractiveClass}`}>
                <Plus size={16} />
                Nova loja
              </button>
            </div>
            <div className="grid gap-5 pt-2 xl:grid-cols-[minmax(0,560px)_minmax(560px,680px)] xl:items-start xl:justify-between">
              <div className="space-y-3">
                {data.conectores.length ? (
                  data.conectores.map((connector) => {
                    const agente = connector.agenteId ? data.agentes.find((item) => item.id === connector.agenteId) ?? null : null;
                    const canTestConnectorStore = Boolean(agente);
                    return (
                      <article key={connector.id} className={`relative overflow-hidden rounded-2xl border border-cyan-400/12 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(255,255,255,0.025)_24%,rgba(255,255,255,0.012)_60%)] p-4 shadow-[0_18px_40px_rgba(2,8,23,0.2),0_0_0_1px_rgba(34,211,238,0.03)] ${premiumTransitionClass}`}>
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h4 className="text-base font-bold text-white">{connector.nome}</h4>
                            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">{connector.tipo}</span>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${connector.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                              {connector.ativo ? "ativo" : "inativo"}
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-white/8 bg-slate-950/45 px-3.5 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Agente</p>
                              <p className="mt-2 text-sm font-semibold text-white">{agente?.nome ?? "nao vinculado"}</p>
                            </div>
                            <div className="rounded-xl border border-white/8 bg-slate-950/45 px-3.5 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Seller ID</p>
                              <p className="mt-2 text-sm font-semibold text-white">{connector.configuracoes?.seller_id ?? "nao informado"}</p>
                            </div>
                            <div className="rounded-xl border border-white/8 bg-slate-950/45 px-3.5 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Nickname</p>
                              <p className="mt-2 text-sm font-semibold text-white">{connector.configuracoes?.nickname ?? "nao informado"}</p>
                            </div>
                            <div className="rounded-xl border border-white/8 bg-slate-950/45 px-3.5 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">OAuth</p>
                              <p className="mt-2 text-sm font-semibold text-white">
                                {connector.configuracoes?.refresh_token ? "conectado" : connector.configuracoes?.access_token ? "token manual" : "nao conectado"}
                              </p>
                            </div>
                          </div>
                          <p className="mt-3 truncate text-xs text-cyan-200/80">{connector.endpointBase}</p>
                        </div>
                        <div className="mt-5 border-t border-white/10 pt-4">
                          <div className="rounded-2xl border border-white/8 bg-slate-950/45 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (agente) {
                                  handleOpenAgentStoreSearchModal(agente);
                                }
                              }}
                              disabled={!canTestConnectorStore}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-50 transition-all hover:border-emerald-300/30 hover:bg-emerald-500/14 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <TestTube2 size={14} />
                              {canTestConnectorStore ? "Testar loja" : "Vincule um agente"}
                            </button>
                            <button type="button" onClick={() => handleEditConnector(connector)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-50 transition-all hover:border-amber-300/30 hover:bg-amber-500/14">
                              <Pencil size={14} />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteConnector(connector)}
                              disabled={deletingConnectorId === connector.id}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-50 transition-all hover:border-rose-300/30 hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 size={14} />
                              {deletingConnectorId === connector.id ? "Removendo..." : "Remover completamente"}
                            </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">Nenhuma loja do Mercado Livre cadastrada para este projeto ainda.</div>
                )}
              </div>

              <aside className="rounded-2xl border border-amber-400/14 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),rgba(15,23,42,0.22))] p-5 shadow-[0_18px_36px_rgba(2,8,23,0.18)] xl:sticky xl:top-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-100/85">Tutorial rapido</p>
                <h4 className="mt-2 text-lg font-bold text-white">Como conectar o Mercado Livre</h4>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Como agora fica uma loja por projeto, deixei aqui o passo a passo rapido com os dados principais para o usuario concluir o app e o OAuth sem precisar sair copiando link quebrado.</p>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <a
                    href="https://developers.mercadolivre.com.br/apps"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/35 px-3.5 py-3 text-sm font-semibold text-white transition-colors hover:border-amber-300/25 hover:bg-slate-950/50"
                  >
                    Painel de apps do Mercado Livre
                    <ExternalLink size={15} />
                  </a>
                  <div className="rounded-xl border border-white/10 bg-slate-950/35 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100/80">URL de retorno OAuth</p>
                        <p className="mt-2 break-all font-mono text-xs text-white">https://infrastudio.vercel.app/api/admin/conectores/mercado-livre/callback</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopySnippet("mercado-livre-callback-url", "https://infrastudio.vercel.app/api/admin/conectores/mercado-livre/callback")}
                        className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/20"
                      >
                        {copiedSnippetKey === "mercado-livre-callback-url" ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        {copiedSnippetKey === "mercado-livre-callback-url" ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/35 px-4 py-3 lg:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100/80">URL de webhook</p>
                        <p className="mt-2 break-all font-mono text-xs text-white">https://infrastudio.vercel.app/api/mercado-livre/webhook</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopySnippet("mercado-livre-webhook-url", "https://infrastudio.vercel.app/api/mercado-livre/webhook")}
                        className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/20"
                      >
                        {copiedSnippetKey === "mercado-livre-webhook-url" ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        {copiedSnippetKey === "mercado-livre-webhook-url" ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-300">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Checklist</p>
                  <p className="mt-3">1. Criar aplicacao do tipo `Web`.</p>
                  <p className="mt-2">2. Ativar `Authorization Code`, `Refresh Token` e `PKCE`.</p>
                  <p className="mt-2">3. Liberar `Usuarios`, `Publicacao e sincronizacao` e `Metricas do negocio`.</p>
                  <p className="mt-2">4. Copiar `APP ID` e `CLIENT SECRET` para o cadastro da loja.</p>
                  <p className="mt-2">5. Salvar a integracao e depois concluir a autorizacao OAuth.</p>
                </div>

                <div className="mt-4 rounded-xl border border-emerald-500/18 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-50/90">
                  Depois de salvar a loja, o proximo passo recomendado e usar `Editar` para revisar credenciais e concluir a conexao da conta.
                </div>
              </aside>
            </div>
          </section>
        </div>
      </section>

      <section className={`${renderedTab === "whatsapp" ? "block" : "hidden"} ${premiumTransitionClass} ${tabContentTransitionClass}`}>
        <div className="space-y-4">
          <section>
            <div className="px-1 py-1">
              <h3 className="inline-flex items-center gap-2 text-xl font-bold text-white"><Waypoints size={18} className="text-cyan-100" />WhatsApp do projeto</h3>
              <p className="mt-2 max-w-3xl text-sm text-cyan-50/80">Conecte, acompanhe e ajuste o numero principal que atende seus clientes.</p>
              {!process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL ? (
                <p className="mt-3 text-xs text-amber-200/90">A conexao do WhatsApp ainda nao esta disponivel neste ambiente.</p>
              ) : null}
            </div>
            <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1.35fr),minmax(340px,0.92fr)] xl:items-start">
              {primaryWhatsAppChannel ? (() => {
                const channel = primaryWhatsAppChannel;
                const agente = channel.agenteId ? data.agentes.find((item) => item.id === channel.agenteId) ?? null : agenteAtivo;
                const runtimeStatus = serviceStatusByChannel[channel.id] ?? getChannelStatusLabel(channel.sessionData?.connectionStatus);
                const qrImage = serviceQrByChannel[channel.id] ?? channel.sessionData?.qrCodeDataUrl ?? channel.sessionData?.qrCodeUrl ?? null;
                const isConnected = runtimeStatus === "conectado" || runtimeStatus === "online";
                const isWaitingQr = runtimeStatus === "aguardando_qr" && Boolean(qrImage);

                return (
                  <div className="grid gap-6 xl:col-start-1">
                    <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),rgba(8,47,73,0.14)_35%,rgba(2,6,23,0.9)_75%)] p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Canal principal</p>
                          <h4 className="mt-3 text-3xl font-black text-white">{formatWhatsAppPhone(channel.numero)}</h4>
                          <p className="mt-2 text-sm text-slate-300">Agente: {agente?.nome ?? "agente ativo do projeto"}</p>
                        </div>
                        <div className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] ${getChannelStatusTone(runtimeStatus)}`}>
                          {isConnected ? "conectado" : runtimeStatus}
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Estado</p>
                          <p className="mt-3 text-lg font-bold text-white">{isConnected ? "WhatsApp conectado" : isWaitingQr ? "Escaneie o QR" : "Aguardando conexao"}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Ultima sincronizacao</p>
                          <p className="mt-3 text-sm font-semibold text-white">
                            {channel.sessionData?.lastSyncAt ? new Date(channel.sessionData.lastSyncAt).toLocaleString("pt-BR") : "nao sincronizada"}
                          </p>
                        </div>
                      </div>

                      {channel.sessionData?.notes ? (
                        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                          {channel.sessionData.notes}
                        </div>
                      ) : null}

                      <div className="mt-6 border-t border-white/10 pt-4">
                        <div className="rounded-2xl border border-white/8 bg-slate-950/45 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                          <button
                            type="button"
                            onClick={() => void handleConnectWhatsAppChannel(channel)}
                            disabled={connectingWhatsAppChannelId === channel.id}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-50 transition-all hover:border-emerald-300/30 hover:bg-emerald-500/14 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {connectingWhatsAppChannelId === channel.id ? <BusyIcon /> : null}
                            {isConnected ? "Reconectar" : "Conectar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDisconnectWhatsAppChannel(channel)}
                            disabled={disconnectingWhatsAppChannelId === channel.id}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-50 transition-all hover:border-rose-300/30 hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {disconnectingWhatsAppChannelId === channel.id ? <BusyIcon /> : null}
                            Desconectar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditWhatsAppChannel(channel)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-50 transition-all hover:border-amber-300/30 hover:bg-amber-500/14"
                          >
                            <Pencil size={15} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteWhatsAppChannel(channel)}
                            disabled={deletingWhatsAppChannelId === channel.id}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-50 transition-all hover:border-rose-300/30 hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingWhatsAppChannelId === channel.id ? <BusyIcon /> : null}
                            Remover
                          </button>
                          <button
                            type="button"
                            onClick={() => void refreshWhatsAppRuntime(channel.id)}
                            className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition-all hover:bg-white/10 hover:text-white ${premiumInteractiveClass}`}
                          >
                            <Activity size={15} />
                            Atualizar
                          </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{isConnected ? "Status da conexao" : "QR Code para escanear"}</p>
                      {isConnected ? (
                        <div className="mt-4 rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 px-5 py-8 text-center">
                          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                            <CheckCircle2 size={42} />
                          </div>
                          <h5 className="mt-5 text-2xl font-black text-white">WhatsApp conectado</h5>
                          <p className="mt-2 text-sm text-emerald-50/80">Nao e necessario escanear novamente enquanto a sessao permanecer ativa.</p>
                        </div>
                      ) : qrImage ? (
                        <div className="mt-4 rounded-[24px] border border-cyan-500/20 bg-cyan-500/[0.07] p-4">
                          <img src={qrImage} alt={`QR do canal ${channel.numero}`} className="mx-auto w-full max-w-[300px] rounded-2xl bg-white p-4 shadow-2xl shadow-cyan-950/40" />
                          <p className="mt-4 text-center text-sm font-semibold text-white">Abra o WhatsApp no celular e escaneie este QR.</p>
                          <p className="mt-1 text-center text-xs text-slate-400">Se o codigo expirar, clique em “Conectar e gerar QR”.</p>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-slate-950/40 px-5 py-12 text-center">
                          <p className="text-lg font-bold text-white">QR ainda nao disponivel</p>
                          <p className="mt-2 text-sm text-slate-400">Clique em “Conectar e gerar QR” para iniciar a sessao deste numero.</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <div className="grid gap-4 xl:col-span-2 xl:grid-cols-[minmax(0,1.15fr),420px]">
                  <div className="grid gap-4">
                    <div className="px-1 py-2">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Primeiro passo</p>
                      <h4 className="mt-3 text-3xl font-black text-white">Crie o numero que vai atender no WhatsApp</h4>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                        Assim que o canal for criado, esta area passa a mostrar o QR bem grande para escanear ou o estado “WhatsApp conectado”.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Canal oficial</p>
                        <p className="mt-3 text-lg font-bold text-white">1 numero principal</p>
                        <p className="mt-2 text-xs leading-6 text-slate-400">A tela agora prioriza um unico WhatsApp para ficar mais clara e rapida.</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">QR em destaque</p>
                        <p className="mt-3 text-lg font-bold text-white">Escaneamento facil</p>
                        <p className="mt-2 text-xs leading-6 text-slate-400">Depois de criar o canal, o QR ocupa o bloco principal da direita.</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Resposta automatica</p>
                        <p className="mt-3 text-lg font-bold text-white">Mesmo agente</p>
                        <p className="mt-2 text-xs leading-6 text-slate-400">O atendimento reutiliza o fluxo atual do chat sem duplicar logica.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-slate-950/42 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-base font-bold text-white">Criar canal oficial</h4>
                        <p className="mt-1 text-sm text-slate-400">Abra o modal para cadastrar o numero principal.</p>
                      </div>
                      <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">
                        2 passos
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={openNewWhatsAppChannelModal}
                        className={headerActionButtonClass}
                      >
                        <Plus size={16} />
                        Novo canal oficial
                      </button>
                    </div>
                    <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Depois disso</p>
                      <p className="mt-2 text-sm text-slate-300">O card principal muda para mostrar o QR em destaque ou o estado “WhatsApp conectado”.</p>
                    </div>
                  </div>
                </div>
              )}

              {primaryWhatsAppChannel ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5 xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:sticky xl:top-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Configuracao do canal</p>
                      <h4 className="mt-2 text-lg font-bold text-white">Acoes rapidas do canal atual</h4>
                    </div>
                    {data.whatsappChannels.length > 1 ? (
                      <p className="text-xs text-amber-100/80">Existem {data.whatsappChannels.length} canais cadastrados. A interface esta priorizando o primeiro.</p>
                    ) : null}
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Numero atual</p>
                      <p className="mt-2 text-base font-bold text-white">{formatWhatsAppPhone(primaryWhatsAppChannel.numero)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Agente atual</p>
                      <p className="mt-2 text-base font-bold text-white">
                        {primaryWhatsAppChannel.agenteId
                          ? data.agentes.find((agente) => agente.id === primaryWhatsAppChannel.agenteId)?.nome ?? "Agente nao encontrado"
                          : agenteAtivo?.nome ?? "Agente ativo do projeto"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Status</p>
                      <p className="mt-2 text-base font-bold text-white">{primaryWhatsAppChannel.status}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Atividade do canal</p>
                      <div className="mt-3 space-y-3 text-sm text-slate-300">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Ultima mensagem recebida</p>
                          <p className="mt-1 font-semibold text-white">{formatDateTimeLabel(primaryWhatsAppChannel.sessionData?.lastInboundAt)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Ultima resposta enviada</p>
                          <p className="mt-1 font-semibold text-white">{formatDateTimeLabel(primaryWhatsAppChannel.sessionData?.lastOutboundAt)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Numero bruto</p>
                          <p className="mt-1 font-mono text-sm text-cyan-100">{primaryWhatsAppChannel.numero}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/45 px-4 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Ultimas conversas</p>
                      {recentWhatsAppChats.length ? (
                        <div className="mt-3 space-y-3">
                          {recentWhatsAppChats.map((chat) => (
                            <button
                              key={chat.id}
                              type="button"
                              onClick={() => void handleOpenChatHistory(chat)}
                              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-left transition-colors hover:border-cyan-400/20 hover:bg-slate-900/80"
                            >
                              <p className="truncate text-sm font-semibold text-white">{chat.titulo || chat.identificadorExterno || "Conversa WhatsApp"}</p>
                              <p className="mt-1 text-xs text-slate-400">{chat.identificadorExterno || "sem identificador"}</p>
                              <p className="mt-1 text-[11px] text-slate-500">{new Date(chat.updatedAt).toLocaleString("pt-BR")}</p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-6 text-sm text-slate-400">
                          As conversas do WhatsApp vao aparecer aqui conforme o canal receber mensagens.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 border-t border-white/10 bg-slate-950/20 px-1 pt-5">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleEditWhatsAppChannel(primaryWhatsAppChannel)}
                        className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 font-semibold ${editButtonClass}`}
                      >
                        <Pencil size={16} />
                        Editar canal
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteWhatsAppChannel(primaryWhatsAppChannel)}
                        disabled={deletingWhatsAppChannelId === primaryWhatsAppChannel.id}
                        className={dangerActionButtonClass}
                      >
                        <Trash2 size={16} />
                        {deletingWhatsAppChannelId === primaryWhatsAppChannel.id ? "Removendo..." : "Remover canal"}
                      </button>
                      <button
                        type="button"
                        onClick={openNewWhatsAppChannelModal}
                        className={headerActionButtonClass}
                      >
                        <Plus size={16} />
                        Novo canal
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

        </div>
      </section>

      <section className={`${renderedTab === "chats" ? "block" : "hidden"} ${premiumTransitionClass} ${tabContentTransitionClass}`}>
        <div className="grid gap-6">
          <section>
            <div className="flex flex-col gap-4 px-2 py-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="inline-flex items-center gap-2 text-xl font-bold text-white"><MessageSquareText size={18} className="text-rose-200" />Chats do projeto</h3>
                <p className="mt-1 text-sm text-slate-400">Widgets criados para este projeto e os codigos prontos para instalar no site.</p>
              </div>
              <button
                type="button"
                onClick={openNewWidgetModal}
                className={`${headerActionButtonClass} ${premiumInteractiveClass}`}
              >
                <Plus size={16} />
                Criar widget do site
              </button>
            </div>

            <div className="space-y-4 p-2 pt-4">
              <div className="rounded-2xl border border-amber-400/14 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),rgba(15,23,42,0.18))] px-4 py-4 shadow-[0_18px_36px_rgba(2,8,23,0.16)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100/85">Documentacao</p>
                    <p className="mt-2 text-sm text-slate-200">Referencia unica para todos os widgets quando o site precisar controlar criacao, atualizacao e destruicao do chat.</p>
                  </div>
                  <a
                    href="/docs/chat-widget-host-control"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-white/5 px-4 py-3 text-sm font-semibold text-amber-50 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <ExternalLink size={15} />
                    Abrir documentacao completa
                  </a>
                </div>
              </div>

              {data.widgets.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {data.widgets.map((widget) => {
                    const agente = getResolvedWidgetAgent(widget);

                    return (
                      <article key={`chat-widget-card-${widget.id ?? widget.slug}`} className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-cyan-400/12 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),rgba(255,255,255,0.03)_24%,rgba(255,255,255,0.012)_60%)] p-4 shadow-[0_18px_40px_rgba(2,8,23,0.24),0_0_0_1px_rgba(34,211,238,0.04)] ${premiumTransitionClass}`}>
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent"
                        />
                        <div
                          aria-hidden="true"
                          className={`pointer-events-none absolute right-4 top-4 ${widget.ativo ? "text-cyan-300/40 animate-pulse drop-shadow-[0_0_18px_rgba(34,211,238,0.3)]" : "text-slate-500/28"}`}
                        >
                          <PanelsTopLeft size={34} strokeWidth={1.6} />
                        </div>

                        <div className="relative flex items-start justify-between gap-3 pr-12">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-base font-bold text-white">{widget.nome}</h4>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${widget.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                                {widget.ativo ? "ativo" : "inativo"}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">
                              {widget.dominio || "Widget pronto para instalar no site deste projeto."}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Trecho do widget</p>
                          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-200">
                            {agente?.nome ? `Conectado ao agente ${agente.nome}.` : "Sem agente especifico; usa o agente principal do projeto."} Tema {widget.tema} com cor {widget.corPrimaria} e slug {widget.slug}.
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {[
                            { key: "agente", label: "Agente", value: agente?.nome ?? "Projeto", active: Boolean(agente), activeClass: "text-cyan-100", inactiveClass: "text-slate-500", icon: Bot },
                            { key: "dominio", label: "Dominio", value: widget.dominio || "Livre", active: Boolean(widget.dominio), activeClass: "text-emerald-100", inactiveClass: "text-slate-500", icon: Cable },
                            { key: "tema", label: "Tema", value: widget.tema, active: true, activeClass: "text-amber-100", inactiveClass: "text-slate-500", icon: Sparkles },
                            { key: "slug", label: "Slug", value: widget.slug, active: true, activeClass: "text-violet-100", inactiveClass: "text-slate-500", icon: MessageSquareText },
                          ].map((item) => {
                            const Icon = item.icon;
                            return (
                              <span
                                key={`${widget.slug}-${item.key}`}
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${item.active ? item.activeClass : item.inactiveClass}`}
                              >
                                <Icon size={13} />
                                {item.label}
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${item.active ? "bg-black/15 text-current" : "bg-white/5 text-slate-400"}`}>
                                  {item.value}
                                </span>
                              </span>
                            );
                          })}
                        </div>

                        <div className="mt-5 border-t border-white/10 pt-4">
                          <div className="rounded-2xl border border-white/8 bg-slate-950/45 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setWidgetCodeModalState({
                                    widget,
                                    variant: "essencial",
                                    essentialCode: buildWidgetSnippet(widget),
                                    detailedCode: buildHostControlSnippet(widget),
                                  })
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-50 transition-all hover:border-sky-300/30 hover:bg-sky-400/14"
                              >
                                <Expand size={14} />
                                Ver codigo
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditWidget(widget)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-50 transition-all hover:border-amber-300/30 hover:bg-amber-500/14"
                              >
                                <Pencil size={14} />
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteWidget(widget)}
                                disabled={Boolean(widget.id) && deletingWidgetId === widget.id}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-50 transition-all hover:border-rose-300/30 hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash2 size={14} />
                                {Boolean(widget.id) && deletingWidgetId === widget.id ? "Removendo..." : "Remover"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">
                  Nenhum widget de chat criado ainda. Crie um widget para exibir aqui os cards com os codigos de integracao.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
      <WidgetCodeModal
        open={Boolean(widgetCodeModalState)}
        state={widgetCodeModalState}
        copiedKey={copiedSnippetKey}
        onClose={() => setWidgetCodeModalState(null)}
        onChangeVariant={(variant) =>
          setWidgetCodeModalState((current) => (current ? { ...current, variant } : current))
        }
        onCopy={(key, value) => void handleCopySnippet(key, value)}
      />
      <AgenteModal
        open={agenteModalOpen}
        form={agenteForm}
        apis={data.apis}
        agentes={data.agentes}
        widgets={data.widgets}
        whatsappChannels={data.whatsappChannels}
        connectors={data.conectores}
        pendingArquivos={pendingAgenteArquivos}
        saving={savingAgente}
        connectionSavingKey={agentConnectionSavingKey}
        feedback={feedbackAgente}
        onClose={() => {
          setAgenteModalOpen(false);
          resetAgenteForm();
        }}
        onChange={(next) => setAgenteForm((prev) => applyAgenteAutoFields({ ...prev, ...next }))}
        onAddFiles={handleAddAgenteFiles}
        onRemovePendingFile={handleRemovePendingAgenteFile}
        onRemoveUploadedFile={handleRemoveUploadedAgenteFile}
        onValidateSummary={handleValidateAgenteSummary}
        onAssignWidget={(widgetId) => void handleAssignWidgetToAgent(widgetId)}
        onAssignWhatsApp={(channelId) => void handleAssignWhatsAppToAgent(channelId)}
        onAssignConnector={(connectorId) => void handleAssignConnectorToAgent(connectorId)}
        onSubmit={() => void handleAgenteSubmit()}
      />
      <AgentStoreSearchModal
        open={agentStoreSearchModalOpen}
        agente={agentStoreSearchTarget}
        termo={agentStoreSearchTerm}
        latestLoading={agentStoreLatestLoading}
        latestResult={agentStoreLatestResult}
        searchLoading={agentStoreSearchLoading}
        searchResult={agentStoreSearchResult}
        onClose={() => {
          setAgentStoreSearchModalOpen(false);
          setAgentStoreSearchTarget(null);
          setAgentStoreSearchTerm("");
          setAgentStoreLatestResult(null);
          setAgentStoreSearchResult(null);
          setAgentStoreLatestLoading(false);
          setAgentStoreSearchLoading(false);
        }}
        onTermoChange={setAgentStoreSearchTerm}
        onLoadLatest={() => void handleLoadAgentLatestProducts()}
        onRunSearch={() => void handleRunAgentStoreSearch()}
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
            whatsappCelular: next.whatsappCelular !== undefined ? next.whatsappCelular : prev.whatsappCelular,
            projetoId: params.id,
          }))
        }
        onSubmit={() => void handleWidgetSubmit()}
      />
      <ConnectorModal
        open={connectorModalOpen}
        form={connectorForm}
        agentes={data.agentes}
        saving={savingConnector}
        feedback={feedbackConnector}
        copiedTutorial={copiedSnippetKey === "mercado-livre-oauth-tutorial"}
        onClose={handleCloseConnectorModal}
        onChange={(next) =>
          setConnectorForm((prev) => ({
            ...prev,
            ...next,
            projetoId: params.id,
          }))
        }
        onCopyTutorial={() =>
          void handleCopySnippet(
            "mercado-livre-oauth-tutorial",
            [
              "Abre esse link:",
              "https://developers.mercadolivre.com.br/apps",
              "",
              "Clica em \"Criar aplicação\"",
              "",
              "Preenche assim:",
              "Nome: InfraStudio",
              "Tipo: Web",
              "URL de retorno OAuth:",
              "https://infrastudio.vercel.app/api/admin/conectores/mercado-livre/callback",
              "",
              "Callback URL Notifications / webhook:",
              "https://infrastudio.vercel.app/api/mercado-livre/webhook",
              "",
              "Fluxos OAuth:",
              "- Authorization Code: ativo",
              "- Refresh Token: ativo",
              "- PKCE necessario: ativo",
              "",
              "Permissoes do app:",
              "- Usuarios: Leitura e escrita",
              "- Publicacao e sincronizacao: Leitura e escrita",
              "- Metricas do negocio: Leitura",
              "",
              "Negocio liberado:",
              "- Mercado Livre: marcado",
              "",
              "Permissoes e marcacoes:",
              "- Permita a autorizacao da conta quando o Mercado Livre pedir",
              "- Se houver secao de notificacoes ou Callback URL Notifications, cole a URL de webhook acima",
              "- Se mudar as permissoes do app depois, desvincule a autorizacao anterior e conecte novamente no InfraStudio",
              "- Para a integracao atual do InfraStudio, o essencial e concluir o OAuth, ativar Publicacao e sincronizacao e pegar APP ID + CLIENT SECRET",
              "",
              "Depois de criar, vao aparecer 2 codigos na tela:",
              "APP ID",
              "CLIENT SECRET",
              "",
              "Envie esses dois dados para configurar a integracao da loja.",
              "",
              "Se aparecer botao de \"autorizar\" ou \"permitir\", pode seguir normalmente.",
            ].join("\n"),
          )
        }
        onSubmit={() => void handleConnectorSubmit()}
      />
      <WhatsAppChannelModal
        open={whatsAppChannelModalOpen}
        form={whatsAppChannelForm}
        agentes={data.agentes}
        saving={savingWhatsAppChannel}
        feedback={feedbackWhatsApp}
        onClose={() => {
          setWhatsAppChannelModalOpen(false);
          resetWhatsAppChannelForm();
        }}
        onChange={(next) =>
          setWhatsAppChannelForm((prev) => ({
            ...prev,
            ...next,
            numero: next.numero !== undefined ? formatWhatsAppPhone(next.numero) : prev.numero,
          }))
        }
        onSubmit={() => void handleSaveWhatsAppChannel()}
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
      <DeleteProjectModal
        open={deleteProjectModalOpen}
        projectName={data.projeto.nome}
        confirmationValue={deleteProjectConfirmation}
        saving={deletingProject}
        onChangeConfirmation={setDeleteProjectConfirmation}
        onClose={() => {
          if (deletingProject) {
            return;
          }
          setDeleteProjectModalOpen(false);
          setDeleteProjectConfirmation("");
        }}
        onConfirm={() => void handleDeleteProject()}
      />
      <DeleteConnectorModal
        open={deleteConnectorModalOpen}
        connectorName={connectorPendingDelete?.nome ?? ""}
        confirmationValue={deleteConnectorConfirmation}
        saving={Boolean(connectorPendingDelete?.id) && deletingConnectorId === connectorPendingDelete?.id}
        onChangeConfirmation={setDeleteConnectorConfirmation}
        onClose={() => {
          if (connectorPendingDelete?.id && deletingConnectorId === connectorPendingDelete.id) {
            return;
          }
          setDeleteConnectorModalOpen(false);
          setDeleteConnectorConfirmation("");
          setConnectorPendingDelete(null);
        }}
        onConfirm={() => void confirmDeleteConnector()}
      />
      <DeleteAgenteModal
        open={deleteAgenteModalOpen}
        agenteName={agentePendingDelete?.nome ?? ""}
        confirmationValue={deleteAgenteConfirmation}
        saving={Boolean(agentePendingDelete?.id) && deletingAgenteId === agentePendingDelete?.id}
        onChangeConfirmation={setDeleteAgenteConfirmation}
        onClose={() => {
          if (agentePendingDelete?.id && deletingAgenteId === agentePendingDelete.id) {
            return;
          }
          setDeleteAgenteModalOpen(false);
          setDeleteAgenteConfirmation("");
          setAgentePendingDelete(null);
        }}
        onConfirm={() => void confirmDeleteAgente()}
      />
      <DeleteWhatsAppChannelModal
        open={deleteWhatsAppChannelModalOpen}
        channelName={whatsAppChannelPendingDelete ? formatWhatsAppPhone(whatsAppChannelPendingDelete.numero) : ""}
        confirmationValue={deleteWhatsAppChannelConfirmation}
        saving={Boolean(whatsAppChannelPendingDelete?.id) && deletingWhatsAppChannelId === whatsAppChannelPendingDelete?.id}
        onChangeConfirmation={setDeleteWhatsAppChannelConfirmation}
        onClose={() => {
          if (whatsAppChannelPendingDelete?.id && deletingWhatsAppChannelId === whatsAppChannelPendingDelete.id) {
            return;
          }
          setDeleteWhatsAppChannelModalOpen(false);
          setDeleteWhatsAppChannelConfirmation("");
          setWhatsAppChannelPendingDelete(null);
        }}
        onConfirm={() => void confirmDeleteWhatsAppChannel()}
      />
    </main>
  );
}


