"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bold, Bot, CheckCircle2, Copy, Expand, ExternalLink, FileImage, Heading, List, ListOrdered, MessageSquare, Minimize2, Paperclip, Pencil, Plus, Sparkles, TestTube2, Trash2, X } from "lucide-react";
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
    seller_id?: string;
    nickname?: string;
    access_token?: string;
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
  sellerId: string;
  nickname: string;
  accessToken: string;
  ativo: boolean;
};

type ChatDetailState = {
  chat: Chat;
  messages: ChatMessage[];
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

function getChatLeadName(chat: Chat) {
  const lead = chat.contexto?.lead as { nome?: string | null } | undefined;
  return lead?.nome?.trim() || "Nao identificado";
}

function getChatObjective(chat: Chat) {
  const qualification = chat.contexto?.qualificacao as { objetivo?: string | null } | undefined;
  return qualification?.objetivo?.trim() || "Objetivo nao identificado";
}

function getChatSummary(chat: Chat) {
  const memory = chat.contexto?.memoria as { resumo?: string | null } | undefined;
  return memory?.resumo?.trim() || null;
}

function getChatPriorityScore(chat: Chat) {
  const lead = chat.contexto?.lead as { identificado?: boolean } | undefined;
  const qualification = chat.contexto?.qualificacao as { pronto_para_whatsapp?: boolean } | undefined;
  let score = 0;

  if (chat.canal === "whatsapp") score += 4;
  if (lead?.identificado) score += 3;
  if (qualification?.pronto_para_whatsapp) score += 2;
  if (chat.totalTokens > 0) score += 1;

  return score;
}

function getChatChannelLabel(chat: Chat) {
  return chat.canal === "whatsapp" ? "WhatsApp" : "Site";
}

function getChatChannelTone(chat: Chat) {
  return chat.canal === "whatsapp" ? "bg-emerald-500/10 text-emerald-200" : "bg-cyan-500/10 text-cyan-100";
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
        className="group w-full rounded-[22px] border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(3,105,80,0.1))] px-4 py-4 text-left transition-all duration-300 hover:border-emerald-400/35 hover:bg-[linear-gradient(135deg,rgba(16,185,129,0.22),rgba(5,150,105,0.14))]"
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
        className={`grid overflow-hidden transition-all duration-300 ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
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

type ProjectTab = "agentes" | "apis" | "conectores" | "whatsapp" | "chats";

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
  const [promptExpanded, setPromptExpanded] = useState(false);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const lastPromptSyncRef = useRef("");

  useEffect(() => {
    if (open) {
      setShowRawConfig(false);
      setPromptExpanded(false);
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(37,99,235,0.28)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {form.id ? <Pencil size={16} /> : <Plus size={16} />}
              {saving ? "Salvando..." : form.id ? "Atualizar agente" : "Criar agente"}
            </button>
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
              <p className="mt-2 text-xs text-slate-400">Ao validar, o texto e reorganizado para leitura humana e o JSON tecnico e regenerado automaticamente sem virar um resumao podado.</p>
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
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Conector</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{form.id ? "Editar conector" : "Novo conector"}</h2>
            <p className="mt-1 text-sm text-slate-400">Use este cadastro para o agente buscar produtos no Mercado Livre sem expor a resposta bruta da API.</p>
          </div>
          <div className="flex items-center gap-2">
            {form.id ? (
              <a
                href={`/api/admin/conectores/${form.id}/mercado-livre/connect`}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/15 hover:text-white"
              >
                <ExternalLink size={14} />
                Conectar Mercado Livre
              </a>
            ) : null}
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
              <FormLabel>Nome</FormLabel>
              <input
                value={form.nome}
                onChange={(event) => onChange({ nome: event.target.value })}
                placeholder="Loja Mercado Livre"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div>
              <FormLabel>Tipo</FormLabel>
              <select
                value={form.tipo}
                onChange={(event) => onChange({ tipo: event.target.value === "mercado_livre" ? "mercado_livre" : "mercado_livre" })}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none"
              >
                <option value="mercado_livre">mercado_livre</option>
              </select>
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
            {!form.id ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                Salve o conector primeiro para habilitar o botao <span className="font-semibold">Conectar Mercado Livre</span> e concluir o OAuth automatico.
              </div>
            ) : null}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Tutorial para o cliente da loja</p>
                  <p className="mt-1 text-xs text-cyan-100/80">Use esse texto para pedir o APP ID e o CLIENT SECRET da conta do Mercado Livre.</p>
                </div>
                <button
                  type="button"
                  onClick={onCopyTutorial}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/15 hover:text-white"
                >
                  {copiedTutorial ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  {copiedTutorial ? "Copiado" : "Copiar tutorial"}
                </button>
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 px-4 py-4 text-xs leading-6 text-slate-200">
                <p>Abre esse link:</p>
                <p className="font-semibold text-white">https://developers.mercadolivre.com.br/apps</p>
                <p className="mt-3">Clica em “Criar aplicação”</p>
                <p className="mt-3">Preenche assim:</p>
                <p>Nome: InfraStudio</p>
                <p>Tipo: Web</p>
                <p>URL de retorno:</p>
                <p className="font-semibold text-white">https://infrastudio.vercel.app/api/admin/conectores/mercado-livre/callback</p>
                <p className="mt-3">Depois de criar, vao aparecer 2 codigos na tela:</p>
                <p>APP ID</p>
                <p>CLIENT SECRET</p>
                <p className="mt-3">Envie esses dois dados para configurar a integracao da loja.</p>
                <p className="mt-3">Se aparecer botao de “autorizar” ou “permitir”, pode seguir normalmente.</p>
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <input type="checkbox" checked={form.ativo} onChange={(event) => onChange({ ativo: event.target.checked })} />
              Conector ativo
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onSubmit}
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white"
              >
                {form.id ? <Pencil size={16} /> : <Plus size={16} />}
                {saving ? "Salvando..." : form.id ? "Atualizar conector" : "Criar conector"}
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
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
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
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 disabled:opacity-60"
              >
                <TestTube2 size={15} />
                {latestLoading ? "Carregando..." : "Listar ultimos"}
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
                      : "Sem conector valido"}
                  </p>
                </div>

                {latestResult.error ? <p className="mt-3 text-sm text-rose-100">{latestResult.error}</p> : null}

                {latestResult.produtos.length ? (
                  <div className="mt-4 space-y-3">
                    {latestResult.produtos.map((produto) => (
                      <div key={produto.link} className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
                        <div className="flex items-start justify-between gap-4">
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
                            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/15 hover:text-white"
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
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 disabled:opacity-60"
            >
              <TestTube2 size={15} />
              {searchLoading ? "Testando..." : "Testar busca"}
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
                      <div className="flex items-start justify-between gap-4">
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
                          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/15 hover:text-white"
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
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-88px)] overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <FormLabel>Numero</FormLabel>
              <input
                value={form.numero}
                onChange={(event) => onChange({ numero: formatWhatsAppPhone(event.target.value) })}
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
                <option value="">Agente ativo do projeto</option>
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

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onSubmit}
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white"
              >
                {form.id ? <Pencil size={16} /> : <Plus size={16} />}
                {saving ? "Salvando..." : form.id ? "Salvar alteracoes" : "Criar canal"}
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

export default function AdminProjetoDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ProjetoDetalhe | null>(null);
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
  const [connectingWhatsAppChannelId, setConnectingWhatsAppChannelId] = useState<string | null>(null);
  const [disconnectingWhatsAppChannelId, setDisconnectingWhatsAppChannelId] = useState<string | null>(null);
  const [deletingAgenteId, setDeletingAgenteId] = useState<string | null>(null);
  const [deletingConnectorId, setDeletingConnectorId] = useState<string | null>(null);
  const [deletingWidgetId, setDeletingWidgetId] = useState<string | null>(null);
  const [deletingWhatsAppChannelId, setDeletingWhatsAppChannelId] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [feedbackAgente, setFeedbackAgente] = useState<string | null>(null);
  const [feedbackApi, setFeedbackApi] = useState<string | null>(null);
  const [feedbackConnector, setFeedbackConnector] = useState<string | null>(null);
  const [feedbackWidget, setFeedbackWidget] = useState<string | null>(null);
  const [feedbackWhatsApp, setFeedbackWhatsApp] = useState<string | null>(null);
  const [agenteModalOpen, setAgenteModalOpen] = useState(false);
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [connectorModalOpen, setConnectorModalOpen] = useState(false);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [whatsAppChannelModalOpen, setWhatsAppChannelModalOpen] = useState(false);
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatHistoryError, setChatHistoryError] = useState<string | null>(null);
  const [chatDetail, setChatDetail] = useState<ChatDetailState | null>(null);
  const [chatChannelFilter, setChatChannelFilter] = useState<"todos" | "web" | "whatsapp">("todos");
  const [chatSortMode, setChatSortMode] = useState<"prioridade" | "recentes" | "tokens">("prioridade");
  const [chatPage, setChatPage] = useState(1);
  const [pendingAgenteArquivos, setPendingAgenteArquivos] = useState<PendingAgenteArquivo[]>([]);
  const [origin, setOrigin] = useState("");
  const [copiedSnippetKey, setCopiedSnippetKey] = useState<string | null>(null);
  const [expandedSnippetKeys, setExpandedSnippetKeys] = useState<Record<string, boolean>>({});
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

    const diagnosticsEntries = await Promise.all(
      payload.agentes.map(async (agente) => {
        try {
          const diagnosticResponse = await fetch(`/api/admin/agentes/${agente.id}/diagnostico`, { cache: "no-store" });
          if (!diagnosticResponse.ok) {
            return null;
          }

          const diagnosticPayload = (await diagnosticResponse.json()) as AgentDiagnosticsOverview;
          return [agente.id, diagnosticPayload] as const;
        } catch {
          return null;
        }
      }),
    );

    setAgentDiagnosticsById(
      Object.fromEntries(diagnosticsEntries.filter((entry): entry is readonly [string, AgentDiagnosticsOverview] => Boolean(entry))),
    );
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    void loadProjeto();
  }, [params.id]);

  useEffect(() => {
    const oauthStatus = searchParams.get("mercado_livre_oauth");
    const oauthError = searchParams.get("mercado_livre_oauth_error");

    if (oauthStatus === "success") {
      setFeedbackConnector("Conexao com o Mercado Livre concluida. O conector recebeu os tokens da loja.");
      router.replace(`/admin/projetos/${params.id}`);
      return;
    }

    if (oauthError) {
      setFeedbackConnector(oauthError);
      router.replace(`/admin/projetos/${params.id}`);
    }
  }, [params.id, router, searchParams]);

  useEffect(() => {
    if (!data?.whatsappChannels.length) {
      return;
    }

    const sync = () => {
      for (const channel of data.whatsappChannels) {
        void refreshWhatsAppRuntime(channel.id);
      }
    };

    sync();
    const timer = window.setInterval(sync, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [data?.whatsappChannels]);

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

  const toggleSnippetExpanded = (key: string) => {
    setExpandedSnippetKeys((current) => ({
      ...current,
      [key]: !current[key],
    }));
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
    const organizedPromptBase = normalizeAgentText(form.promptBase);
    const generatedConfig = buildAgentConfigFromSummary(organizedPromptBase);

    return {
      ...form,
      descricao: form.descricao.trim() || inferShortDescription(organizedPromptBase),
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
          ? `Validacao concluida para "${agente.nome}". Chat, APIs, conectores e WhatsApp foram verificados.`
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

    await loadProjeto();

    if (!connectorForm.id && payload.conector) {
      setConnectorForm({
        id: payload.conector.id,
        nome: payload.conector.nome,
        tipo: payload.conector.tipo === "mercado_livre" ? "mercado_livre" : "mercado_livre",
        projetoId: payload.conector.projetoId ?? params.id,
        agenteId: payload.conector.agenteId,
        endpointBase: payload.conector.endpointBase || "https://api.mercadolibre.com",
        sellerId: payload.conector.configuracoes?.seller_id ?? "",
        nickname: payload.conector.configuracoes?.nickname ?? "",
        accessToken: payload.conector.configuracoes?.access_token ?? "",
        ativo: payload.conector.ativo,
      });
      setSavingConnector(false);
      setFeedbackConnector("Conector criado com sucesso. Agora clique em Conectar Mercado Livre para autorizar a loja.");
      return;
    }

    const message = connectorForm.id ? "Conector atualizado com sucesso." : "Conector criado com sucesso.";
    resetConnectorForm();
    setSavingConnector(false);
    setConnectorModalOpen(false);
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

  const handleEditConnector = (connector: Connector) => {
    setConnectorForm({
      id: connector.id,
      nome: connector.nome,
      tipo: connector.tipo === "mercado_livre" ? "mercado_livre" : "mercado_livre",
      projetoId: connector.projetoId ?? params.id,
      agenteId: connector.agenteId,
      endpointBase: connector.endpointBase || "https://api.mercadolibre.com",
      sellerId: connector.configuracoes?.seller_id ?? "",
      nickname: connector.configuracoes?.nickname ?? "",
      accessToken: connector.configuracoes?.access_token ?? "",
      ativo: connector.ativo,
    });
    setFeedbackConnector(null);
    setConnectorModalOpen(true);
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

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setFeedbackWhatsApp(payload.error ?? "Nao foi possivel salvar o canal WhatsApp.");
      setSavingWhatsAppChannel(false);
      return;
    }

    await loadProjeto();
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
      await refreshWhatsAppRuntime(channel.id);
      await loadProjeto();
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
      await loadProjeto();
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

    await loadProjeto();
    if (apiForm.id === api.id) {
      resetApiForm();
    }
    setFeedbackApi(`API "${api.nome}" excluida com sucesso.`);
  };

  const handleDeleteAgente = async (agente: Agente) => {
    const confirmed = window.confirm(
      `Remover completamente o agente "${agente.nome}"?\n\nIsso tambem apaga arquivos, widgets, canais WhatsApp, conectores e chats vinculados a ele.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingAgenteId(agente.id);
    setFeedbackAgente(null);

    try {
      const response = await fetch("/api/admin/agentes", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: agente.id,
          projetoId: params.id,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFeedbackAgente(payload.error ?? "Nao foi possivel excluir o agente.");
        return;
      }

      await loadProjeto();
      if (agenteForm.id === agente.id) {
        resetAgenteForm();
      }
      setFeedbackAgente(`Agente "${agente.nome}" removido completamente.`);
    } finally {
      setDeletingAgenteId(null);
    }
  };

  const handleDeleteConnector = async (connector: Connector) => {
    const confirmed = window.confirm(`Remover completamente o conector "${connector.nome}"?`);
    if (!confirmed || !connector.id) {
      return;
    }

    setDeletingConnectorId(connector.id);
    setFeedbackConnector(null);

    try {
      const response = await fetch("/api/admin/conectores", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: connector.id,
          projetoId: params.id,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFeedbackConnector(payload.error ?? "Nao foi possivel excluir o conector.");
        return;
      }

      await loadProjeto();
      if (connectorForm.id === connector.id) {
        resetConnectorForm();
      }
      setFeedbackConnector(`Conector "${connector.nome}" removido completamente.`);
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

      await loadProjeto();
      if (widgetForm.id === widget.id) {
        resetWidgetForm();
      }
      setFeedbackWidget(`Widget "${widget.nome}" removido completamente.`);
    } finally {
      setDeletingWidgetId(null);
    }
  };

  const handleDeleteWhatsAppChannel = async (channel: WhatsAppChannel) => {
    const confirmed = window.confirm(
      `Remover completamente o canal ${formatWhatsAppPhone(channel.numero)}?\n\nIsso apaga o cadastro do WhatsApp deste projeto.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingWhatsAppChannelId(channel.id);
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
            channelId: channel.id,
          }),
        });
      }

      const response = await fetch("/api/admin/whatsapp-canais", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channel.id,
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
        [channel.id]: null,
      }));
      setServiceStatusByChannel((current) => ({
        ...current,
        [channel.id]: "desconectado",
      }));
      await loadProjeto();
      if (whatsAppChannelForm.id === channel.id) {
        resetWhatsAppChannelForm();
      }
      setFeedbackWhatsApp(`Canal ${formatWhatsAppPhone(channel.numero)} removido completamente.`);
    } finally {
      setDeletingWhatsAppChannelId(null);
    }
  };

  const handleDeleteProject = async () => {
    const projectName = data?.projeto.nome ?? "este projeto";
    const confirmed = window.confirm(
      `Remover completamente o projeto "${projectName}"?\n\nIsso apaga agentes, APIs, conectores, widgets, WhatsApp, chats, logs e vinculos do projeto.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingProject(true);
    setFeedbackWhatsApp(null);

    try {
      const response = await fetch(`/api/admin/projetos/${params.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFeedbackWhatsApp(payload.error ?? "Nao foi possivel excluir o projeto.");
        return;
      }

      router.push("/admin/projetos");
    } finally {
      setDeletingProject(false);
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
  const primaryWhatsAppChannel = data.whatsappChannels[0] ?? null;
  const recentWhatsAppChats = data.chats
    .filter((chat) => chat.canal === "whatsapp")
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, 3);
  const identifiedChatsCount = data.chats.filter((chat) => {
    const lead = chat.contexto?.lead as { identificado?: boolean } | undefined;
    return Boolean(lead?.identificado);
  }).length;
  const whatsappChatsCount = data.chats.filter((chat) => chat.canal === "whatsapp").length;
  const channelReadyChatsCount = data.chats.filter((chat) => {
    const qualification = chat.contexto?.qualificacao as { pronto_para_whatsapp?: boolean } | undefined;
    return Boolean(qualification?.pronto_para_whatsapp);
  }).length;
  const totalChatTokens = data.chats.reduce((sum, chat) => sum + (chat.totalTokens || 0), 0);
  const filteredChats = data.chats.filter((chat) => chatChannelFilter === "todos" ? true : chat.canal === chatChannelFilter);
  const sortedChats = [...filteredChats].sort((left, right) => {
    if (chatSortMode === "tokens") {
      return right.totalTokens - left.totalTokens || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    }

    if (chatSortMode === "recentes") {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    }

    return (
      getChatPriorityScore(right) - getChatPriorityScore(left) ||
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });
  const chatsPerPage = 8;
  const chatTotalPages = Math.max(1, Math.ceil(sortedChats.length / chatsPerPage));
  const currentChatPage = Math.min(chatPage, chatTotalPages);
  const paginatedChats = sortedChats.slice((currentChatPage - 1) * chatsPerPage, currentChatPage * chatsPerPage);

  return (
    <main className="space-y-6">
      <section className="px-1 py-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
          <Sparkles size={14} />
          Projeto
        </div>
        <h1 className="text-4xl font-extrabold text-white">{data.projeto.nome}</h1>
        <p className="mt-3 max-w-3xl text-slate-400">{data.projeto.descricao || "Sem descricao cadastrada."}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleDeleteProject()}
            disabled={deletingProject}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 disabled:opacity-60"
          >
            <Trash2 size={16} />
            {deletingProject ? "Removendo projeto..." : "Remover projeto completamente"}
          </button>
        </div>
        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr),minmax(0,0.9fr)]">
          <div className="rounded-2xl border border-white/8 bg-slate-950/30 p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),minmax(260px,0.72fr)]">
              <div className="min-w-0 rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Slug do projeto</p>
                <p className="mt-2 truncate text-lg font-bold text-white" title={data.projeto.slug ?? "sem-slug"}>
                  {data.projeto.slug ?? "sem-slug"}
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Agente ativo</p>
                <p className="mt-2 text-xl font-extrabold leading-tight text-white">
                  {agenteAtivo?.nome ?? "Nenhum ativo"}
                </p>
                <p className="mt-2 text-sm text-cyan-50/75">
                  {agenteAtivo ? "Esse agente responde pelo projeto quando o canal estiver valido." : "Sem agente ativo para atender este projeto."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-3">
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4 xl:col-span-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Agentes</p>
            <p className="mt-2 text-lg font-bold text-white">{data.stats.totalAgentes}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4 xl:col-span-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">APIs</p>
            <p className="mt-2 text-lg font-bold text-white">{data.stats.totalApis}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4 xl:col-span-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Conectores</p>
            <p className="mt-2 text-lg font-bold text-white">{data.stats.totalConectores}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4 xl:col-span-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Widgets</p>
            <p className="mt-2 text-lg font-bold text-white">{data.stats.totalWidgets}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4 xl:col-span-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">WhatsApp</p>
            <p className="mt-2 text-lg font-bold text-white">{data.stats.totalWhatsAppChannels}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4 xl:col-span-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Chats</p>
            <p className="mt-2 text-lg font-bold text-white">{data.stats.totalChats}</p>
          </div>
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
              onClick={() => setActiveTab("conectores")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === "conectores"
                  ? "border border-cyan-500/20 bg-cyan-500/10 text-cyan-100"
                  : "border border-white/10 bg-white/5 text-white"
              }`}
            >
              Conectores
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
            <button
              type="button"
              onClick={() => setActiveTab("whatsapp")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === "whatsapp"
                  ? "border border-cyan-500/20 bg-cyan-500/10 text-cyan-100"
                  : "border border-white/10 bg-white/5 text-white"
              }`}
            >
              WhatsApp
            </button>
          </div>
        </div>
      </section>

      {(feedbackAgente || feedbackApi || feedbackConnector || feedbackWidget || feedbackWhatsApp) && (
        <section className="grid gap-3">
          {feedbackAgente ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackAgente}</div> : null}
          {feedbackApi ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackApi}</div> : null}
          {feedbackConnector ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackConnector}</div> : null}
          {feedbackWidget ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackWidget}</div> : null}
          {feedbackWhatsApp ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedbackWhatsApp}</div> : null}
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
                const diagnostic = agentDiagnosticsById[agente.id];
                const latestDiagnostic = latestAgentDiagnosticById[agente.id];

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

                        {diagnostic ? (
                          <div className="mt-4 grid gap-3 md:grid-cols-5">
                            <div className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-3">
                              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">APIs</p>
                              <p className="mt-2 text-sm font-bold text-white">{diagnostic.summary.activeApis}/{diagnostic.summary.linkedApis}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-3">
                              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Widgets</p>
                              <p className="mt-2 text-sm font-bold text-white">{diagnostic.summary.activeWidgets}/{diagnostic.summary.widgets}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-3">
                              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">WhatsApp</p>
                              <p className="mt-2 text-sm font-bold text-white">{diagnostic.summary.onlineWhatsAppChannels}/{diagnostic.summary.whatsappChannels}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-3">
                              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Conectores</p>
                              <p className="mt-2 text-sm font-bold text-white">{diagnostic.summary.activeConnectors}/{diagnostic.summary.connectors}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-3">
                              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Chats</p>
                              <p className="mt-2 text-sm font-bold text-white">{diagnostic.summary.chats}</p>
                            </div>
                          </div>
                        ) : null}

                        {diagnostic ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold text-slate-300">
                              Conectado em:{" "}
                              {[
                                diagnostic.connections.widgets.length ? `${diagnostic.connections.widgets.length} widget(s) diretos` : null,
                                diagnostic.connections.whatsappChannels.length ? `${diagnostic.connections.whatsappChannels.length} canal(is) WhatsApp` : null,
                                diagnostic.connections.connectors.length ? `${diagnostic.connections.connectors.length} conector(es)` : null,
                                diagnostic.connections.apis.length ? `${diagnostic.connections.apis.length} API(s)` : null,
                              ]
                                .filter(Boolean)
                                .join(" | ") || "sem vinculos diretos"}
                            </p>
                            {diagnostic.summary.fallbackWidgets ? (
                              <p className="text-xs text-amber-200/80">
                                Widgets genericos do projeto: {diagnostic.summary.fallbackWidgets}. Eles podem atender sem ficar presos a este agente.
                              </p>
                            ) : null}
                            {diagnostic.connections.whatsappChannels.length ? (
                              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">WhatsApp ativo no agente</p>
                                <div className="mt-2 space-y-1">
                                  {diagnostic.connections.whatsappChannels.map((channel) => (
                                    <p key={channel.id} className="text-sm font-semibold text-white">
                                      {formatWhatsAppPhone(channel.numero)}{" "}
                                      <span className={`text-xs font-medium ${channel.connectionStatus === "online" ? "text-emerald-200" : "text-amber-200"}`}>
                                        {channel.status} | {channel.connectionStatus}
                                      </span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {diagnostic.connections.connectors.length ? (
                              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200">Loja conectada ao agente</p>
                                <div className="mt-2 space-y-1">
                                  {diagnostic.connections.connectors.map((connector) => (
                                    <p key={connector.id ?? connector.nome} className="text-sm font-semibold text-white">
                                      {connector.nickname || connector.nome}
                                      <span className="ml-2 text-xs font-medium text-cyan-100/80">
                                        {connector.tipo}
                                        {connector.sellerId ? ` | seller ${connector.sellerId}` : ""}
                                      </span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {diagnostic.warnings.map((warning) => (
                              <p key={warning} className="text-xs text-amber-200/80">{warning}</p>
                            ))}
                          </div>
                        ) : null}

                        {latestDiagnostic ? (
                          <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${latestDiagnostic.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"}`}>
                                {latestDiagnostic.ok ? "validado" : "com alertas"}
                              </span>
                              <p className="text-xs text-slate-300">Teste de loja, APIs, WhatsApp e chat do agente</p>
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              <p className="text-xs text-slate-300">Chat: <span className={latestDiagnostic.checks.chat.ok ? "text-emerald-300" : "text-amber-200"}>{latestDiagnostic.checks.chat.detail}</span></p>
                              <p className="text-xs text-slate-300">WhatsApp: <span className={latestDiagnostic.checks.whatsapp.ok ? "text-emerald-300" : "text-amber-200"}>{latestDiagnostic.checks.whatsapp.detail}</span></p>
                              <p className="text-xs text-slate-300">Conectores: <span className={latestDiagnostic.checks.connectors.ok ? "text-emerald-300" : "text-amber-200"}>{latestDiagnostic.checks.connectors.detail}</span></p>
                              <p className="text-xs text-slate-300">Agente: <span className={latestDiagnostic.checks.agent.ok ? "text-emerald-300" : "text-amber-200"}>{latestDiagnostic.checks.agent.detail}</span></p>
                            </div>
                            {diagnostic?.connections.connectors.length ? (
                              <div className="mt-3 space-y-1">
                                {diagnostic.connections.connectors.map((connector) => (
                                  <p key={connector.id ?? connector.nome} className="text-xs text-slate-300">
                                    Conector {connector.nome}:{" "}
                                    <span className={connector.ativo ? "text-emerald-300" : "text-slate-400"}>
                                      {connector.tipo}
                                      {connector.nickname ? ` | ${connector.nickname}` : ""}
                                      {connector.sellerId ? ` | seller ${connector.sellerId}` : ""}
                                    </span>
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            {diagnostic?.connections.whatsappChannels.length ? (
                              <div className="mt-3 space-y-1">
                                {diagnostic.connections.whatsappChannels.map((channel) => (
                                  <p key={channel.id} className="text-xs text-slate-300">
                                    Canal WhatsApp {formatWhatsAppPhone(channel.numero)}:{" "}
                                    <span className={channel.connectionStatus === "online" ? "text-emerald-300" : "text-amber-200"}>
                                      {channel.status} | {channel.connectionStatus}
                                    </span>
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            {diagnostic?.connections.widgets.length ? (
                              <div className="mt-3 space-y-1">
                                {diagnostic.connections.widgets.map((widget) => (
                                  <p key={widget.id ?? widget.slug} className="text-xs text-slate-300">
                                    Widget {widget.nome}:{" "}
                                    <span className={widget.ativo ? "text-emerald-300" : "text-slate-400"}>
                                      slug {widget.slug}
                                      {widget.dominio ? ` | ${widget.dominio}` : ""}
                                    </span>
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            {latestDiagnostic.checks.apis.length ? (
                              <div className="mt-3 space-y-1">
                                {latestDiagnostic.checks.apis.map((apiCheck) => (
                                  <p key={apiCheck.id} className="text-xs text-slate-300">
                                    API {apiCheck.nome}:{" "}
                                    <span className={apiCheck.ok ? "text-emerald-300" : apiCheck.status === "pendente_contexto" ? "text-cyan-200" : "text-amber-200"}>
                                      {apiCheck.detail}
                                    </span>
                                  </p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => void handleRunAgentDiagnostic(agente)}
                          disabled={runningAgentDiagnosticId === agente.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60"
                        >
                          <TestTube2 size={14} />
                          {runningAgentDiagnosticId === agente.id ? "Validando..." : "Validar tudo"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAgentStoreSearchModal(agente)}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-60"
                        >
                          <TestTube2 size={14} />
                          Testar busca da loja
                        </button>
                        <button type="button" onClick={() => handleEditAgente(agente)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200">
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAgente(agente)}
                          disabled={deletingAgenteId === agente.id}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100 disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                          {deletingAgenteId === agente.id ? "Removendo..." : "Remover completamente"}
                        </button>
                      </div>
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

        <section className={`${activeTab === "conectores" ? "block" : "hidden"} overflow-hidden rounded-2xl border border-white/10 bg-white/5`}>
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">Conectores do projeto</h3>
              <p className="mt-1 text-sm text-slate-400">Cadastre fontes de produto por agente. O primeiro tipo disponivel e o `mercado_livre`.</p>
            </div>
            <button type="button" onClick={openNewConnectorModal} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white">
              <Plus size={16} />
              Novo conector
            </button>
          </div>
          <div className="space-y-3 p-4">
            {data.conectores.length ? (
              data.conectores.map((connector) => {
                const agente = connector.agenteId ? data.agentes.find((item) => item.id === connector.agenteId) ?? null : null;
                return (
                  <div key={connector.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="text-base font-bold text-white">{connector.nome}</h4>
                          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">{connector.tipo}</span>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${connector.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                            {connector.ativo ? "ativo" : "inativo"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">Agente: {agente?.nome ?? "nao vinculado"}</p>
                        <p className="mt-1 text-sm text-slate-400">Seller ID: {connector.configuracoes?.seller_id ?? "nao informado"}</p>
                        {connector.configuracoes?.nickname ? <p className="mt-1 text-sm text-slate-400">Nickname: {connector.configuracoes.nickname}</p> : null}
                        <p className="mt-1 text-sm text-slate-400">
                          OAuth: {connector.configuracoes?.refresh_token ? "conectado" : connector.configuracoes?.access_token ? "token manual" : "nao conectado"}
                        </p>
                        <p className="mt-1 truncate text-xs text-cyan-200/80">{connector.endpointBase}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <a
                          href={`/api/admin/conectores/${connector.id}/mercado-livre/connect`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100"
                        >
                          <ExternalLink size={14} />
                          Conectar ML
                        </a>
                        <button type="button" onClick={() => handleEditConnector(connector)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200">
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteConnector(connector)}
                          disabled={deletingConnectorId === connector.id}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100 disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                          {deletingConnectorId === connector.id ? "Removendo..." : "Remover completamente"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">Nenhum conector cadastrado para este projeto ainda.</div>
            )}
          </div>
        </section>

      </div>

      <section className={`${activeTab === "whatsapp" ? "block" : "hidden"}`}>
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
            <div className="border-b border-cyan-500/20 px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">whatsapp-web.js</p>
              <h3 className="mt-2 text-xl font-bold text-white">Canal oficial com sessao persistente</h3>
              <p className="mt-2 max-w-3xl text-sm text-cyan-50/80">
                O motor real fica no `whatsapp-service`, separado do Next.js. A aba usa `POST /connect`, `GET /status` e `GET /qr` para acompanhar a sessao.
              </p>
              {!process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL ? (
                <p className="mt-3 text-xs text-amber-200/90">Defina `NEXT_PUBLIC_WHATSAPP_SERVICE_URL` para habilitar a conexao e a leitura do QR.</p>
              ) : null}
            </div>
            <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.35fr),minmax(340px,0.92fr)] xl:items-start">
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

                      <div className="mt-6 grid gap-4 md:grid-cols-3">
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
                        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Worker</p>
                          <p className="mt-3 text-sm font-semibold text-white">{channel.sessionData?.worker || "whatsapp-service"}</p>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void handleConnectWhatsAppChannel(channel)}
                          disabled={connectingWhatsAppChannelId === channel.id}
                          className="rounded-2xl bg-gradient-to-r from-emerald-500 to-green-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
                        >
                          {connectingWhatsAppChannelId === channel.id ? "Conectando..." : isConnected ? "Reconectar WhatsApp" : "Conectar e gerar QR"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDisconnectWhatsAppChannel(channel)}
                          disabled={disconnectingWhatsAppChannelId === channel.id}
                          className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-3 text-sm font-bold text-rose-100 disabled:opacity-60"
                        >
                          {disconnectingWhatsAppChannelId === channel.id ? "Desconectando..." : "Desconectar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditWhatsAppChannel(channel)}
                          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-200"
                        >
                          Editar numero
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteWhatsAppChannel(channel)}
                          disabled={deletingWhatsAppChannelId === channel.id}
                          className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-3 text-sm font-bold text-rose-100 disabled:opacity-60"
                        >
                          {deletingWhatsAppChannelId === channel.id ? "Removendo..." : "Remover completamente"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void refreshWhatsAppRuntime(channel.id)}
                          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-200"
                        >
                          Atualizar
                        </button>
                      </div>

                      {channel.sessionData?.notes ? (
                        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                          {channel.sessionData.notes}
                        </div>
                      ) : null}
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
                    <div className="rounded-[28px] border border-dashed border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(8,47,73,0.08)_35%,rgba(2,6,23,0.78)_75%)] p-7">
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
                        className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/15 hover:text-white"
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
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleEditWhatsAppChannel(primaryWhatsAppChannel)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <Pencil size={16} />
                      Editar canal
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteWhatsAppChannel(primaryWhatsAppChannel)}
                      disabled={deletingWhatsAppChannelId === primaryWhatsAppChannel.id}
                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 font-semibold text-rose-100 transition-colors hover:bg-rose-500/15 hover:text-white disabled:opacity-60"
                    >
                      <Trash2 size={16} />
                      {deletingWhatsAppChannelId === primaryWhatsAppChannel.id ? "Removendo..." : "Remover canal"}
                    </button>
                    <button
                      type="button"
                      onClick={openNewWhatsAppChannelModal}
                      className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/15 hover:text-white"
                    >
                      <Plus size={16} />
                      Novo canal
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Modo free com JS</p>
                <h3 className="mt-2 text-xl font-bold text-white">Canal rapido de WhatsApp sem API oficial</h3>
                <p className="mt-2 max-w-3xl text-sm text-emerald-50/80">
                  Esta aba entrega um botao flutuante em JavaScript puro para qualquer site. E o caminho mais leve para abrir conversa no WhatsApp sem depender de integracao paga.
                </p>
              </div>
              <button
                type="button"
                onClick={openNewWidgetModal}
                className="inline-flex w-full items-center justify-center gap-2 self-start rounded-xl bg-gradient-to-r from-emerald-500 to-green-400 px-4 py-3 font-semibold text-slate-950 lg:w-auto lg:shrink-0"
              >
                <Plus size={16} />
                Novo canal WhatsApp
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-6 py-5">
              <h3 className="text-xl font-bold text-white">Canais configurados</h3>
              <p className="mt-1 text-sm text-slate-400">Cada widget pode virar um botao free de WhatsApp com copia pronta em JS.</p>
            </div>
            <div className="space-y-4 p-6">
              {data.widgets.length ? (
                data.widgets.map((widget) => {
                  const agente = getResolvedWidgetAgent(widget);
                  const hasWhatsapp = Boolean(sanitizePhoneDigits(widget.whatsappCelular));
                  const whatsappSnippetKey = `whatsapp:${widget.slug}`;
                  const widgetSnippetKey = `widget:${widget.slug}`;
                  const widgetSnippetExpanded = expandedSnippetKeys[widgetSnippetKey] === true;
                  const whatsappSnippetExpanded = expandedSnippetKeys[whatsappSnippetKey] === true;

                  return (
                    <div key={`whatsapp-${widget.id ?? widget.slug}`} className="rounded-xl border border-white/10 bg-slate-950/30 p-5">
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h4 className="text-lg font-bold text-white">{widget.nome}</h4>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${widget.ativo ? "bg-emerald-500/10 text-emerald-200" : "bg-slate-800 text-slate-400"}`}>
                              {widget.ativo ? "ativo" : "inativo"}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${hasWhatsapp ? "bg-cyan-500/10 text-cyan-100" : "bg-amber-500/10 text-amber-100"}`}>
                              {hasWhatsapp ? "pronto para whatsapp" : "faltando numero"}
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-slate-300">Agente: {agente?.nome ?? "agente ativo do projeto"}</p>
                          <p className="mt-1 text-sm text-slate-400">Dominio/contexto: {widget.dominio || "nao informado"}</p>
                          <p className="mt-1 text-sm text-slate-400">WhatsApp: {widget.whatsappCelular || "nao informado"}</p>
                          <p className="mt-1 text-sm text-slate-400">Cor do botao: {widget.corPrimaria}</p>

                          <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-3">
                            <div className="mb-4 rounded-xl border border-white/10 bg-[#07111f] p-3">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Widget do site</p>
                                  <p className="mt-1 text-xs text-slate-400">Snippet atual do chat/widget para embed controlado.</p>
                                </div>
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
                                    onClick={() => toggleSnippetExpanded(widgetSnippetKey)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                                  >
                                    {widgetSnippetExpanded ? <Minimize2 size={13} /> : <Expand size={13} />}
                                    {widgetSnippetExpanded ? "Recolher" : "Expandir"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleCopySnippet(widgetSnippetKey, buildWidgetSnippet(widget))}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/15 hover:text-white"
                                  >
                                    {copiedSnippetKey === widgetSnippetKey ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                                    {copiedSnippetKey === widgetSnippetKey ? "Copiado" : "Copiar widget"}
                                  </button>
                                </div>
                              </div>
                              {widgetSnippetExpanded ? (
                                <div className="w-full overflow-x-auto rounded-lg border border-white/10 bg-[#07111f]">
                                  <pre className="min-h-[170px] w-full whitespace-pre-wrap break-all px-4 py-4 font-mono text-xs leading-6">
                                    {buildWidgetSnippet(widget)
                                      .split("\n")
                                      .map((line, index) => (
                                        <div key={`${widget.slug}-widget-line-${index}`}>{renderSnippetLine(line)}</div>
                                      ))}
                                  </pre>
                                </div>
                              ) : (
                                <div className="rounded-lg border border-dashed border-white/10 bg-slate-950/40 px-4 py-4 text-xs text-slate-400">
                                  Codigo do widget oculto para manter a tela compacta. Clique em "Expandir" para visualizar.
                                </div>
                              )}
                            </div>

                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Snippet JS free</p>
                                <p className="mt-1 text-xs text-slate-400">Cole antes do fechamento de `&lt;/body&gt;` no site do cliente.</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleSnippetExpanded(whatsappSnippetKey)}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                  {whatsappSnippetExpanded ? <Minimize2 size={13} /> : <Expand size={13} />}
                                  {whatsappSnippetExpanded ? "Recolher" : "Expandir"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleCopySnippet(whatsappSnippetKey, buildWhatsappSnippet(widget))}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/15 hover:text-white"
                                >
                                  {copiedSnippetKey === whatsappSnippetKey ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                                  {copiedSnippetKey === whatsappSnippetKey ? "Copiado" : "Copiar JS"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditWidget(widget)}
                                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteWidget(widget)}
                                  disabled={deletingWidgetId === widget.id}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-100 transition-colors hover:bg-rose-500/15 hover:text-white disabled:opacity-60"
                                >
                                  <Trash2 size={13} />
                                  {deletingWidgetId === widget.id ? "Removendo..." : "Remover"}
                                </button>
                              </div>
                            </div>
                            {whatsappSnippetExpanded ? (
                              <div className="w-full overflow-x-auto rounded-lg border border-white/10 bg-[#07111f]">
                                <pre className="min-h-[170px] w-full whitespace-pre-wrap break-all px-4 py-4 font-mono text-xs leading-6">
                                  {buildWhatsappSnippet(widget)
                                    .split("\n")
                                    .map((line, index) => (
                                      <div key={`${widget.slug}-whatsapp-line-${index}`}>{renderSnippetLine(line)}</div>
                                    ))}
                                </pre>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-white/10 bg-slate-950/40 px-4 py-4 text-xs text-slate-400">
                                Codigo JS oculto para manter a tela compacta. Clique em "Expandir" para visualizar.
                              </div>
                            )}
                            {!hasWhatsapp ? (
                              <p className="mt-3 text-xs text-amber-200/80">Preencha um numero de WhatsApp para gerar o link final com o telefone correto.</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">
                  Nenhum canal WhatsApp configurado para este projeto ainda.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      <section className={`${activeTab === "chats" ? "block" : "hidden"}`}>
        <div className="grid gap-6">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Conversas do projeto</h3>
                <p className="mt-1 text-sm text-slate-400">Historico recente dos chats do site e dos sistemas para auditoria, contexto e acompanhamento comercial.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {data.widgets[0] ? (
                  <button
                    type="button"
                    onClick={() => handleEditWidget(data.widgets[0])}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Pencil size={16} />
                    Editar widget do site
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openNewWidgetModal}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white"
                >
                  <Plus size={16} />
                  Criar widget do site
                </button>
              </div>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid gap-4 xl:grid-cols-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-200">Potencial comercial</p>
                  <p className="mt-2 text-2xl font-black text-white">{channelReadyChatsCount}</p>
                  <p className="mt-2 text-xs text-emerald-50/80">Conversas que ja alcançaram sinal de continuidade comercial.</p>
                </div>
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100">Leads identificados</p>
                  <p className="mt-2 text-2xl font-black text-white">{identifiedChatsCount}</p>
                  <p className="mt-2 text-xs text-cyan-50/80">Conversas com nome e contato reconhecidos no contexto.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">WhatsApp</p>
                  <p className="mt-2 text-2xl font-black text-white">{whatsappChatsCount}</p>
                  <p className="mt-2 text-xs text-slate-400">Quantidade de conversas que chegaram pelo canal WhatsApp.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Tokens totais</p>
                  <p className="mt-2 text-2xl font-black text-white">{totalChatTokens}</p>
                  <p className="mt-2 text-xs text-slate-400">Uso acumulado para medir profundidade de atendimento.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/30 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "todos", label: "Todos" },
                    { key: "web", label: "Site" },
                    { key: "whatsapp", label: "WhatsApp" },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => {
                        setChatChannelFilter(filter.key as typeof chatChannelFilter);
                        setChatPage(1);
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] transition-colors ${
                        chatChannelFilter === filter.key ? "bg-cyan-500/15 text-cyan-100" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "prioridade", label: "Prioridade" },
                    { key: "recentes", label: "Mais recentes" },
                    { key: "tokens", label: "Mais profundos" },
                  ].map((sort) => (
                    <button
                      key={sort.key}
                      type="button"
                      onClick={() => {
                        setChatSortMode(sort.key as typeof chatSortMode);
                        setChatPage(1);
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] transition-colors ${
                        chatSortMode === sort.key ? "bg-emerald-500/15 text-emerald-200" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {sort.label}
                    </button>
                  ))}
                </div>
              </div>

              {data.chats.length ? (
                paginatedChats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => void handleOpenChatHistory(chat)}
                    className="block w-full rounded-xl border border-white/10 bg-slate-950/30 p-4 text-left transition-colors hover:border-cyan-500/30 hover:bg-slate-950/50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-cyan-200">
                          <MessageSquare size={14} />
                          <p className="truncate font-semibold text-white">{chat.titulo}</p>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${getChatChannelTone(chat)}`}>
                            {getChatChannelLabel(chat)}
                          </span>
                          {getChatPriorityScore(chat) >= 5 ? (
                            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-200">
                              potencial
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{new Date(chat.updatedAt).toLocaleString("pt-BR")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Score comercial</p>
                        <p className="mt-1 text-lg font-black text-white">{getChatPriorityScore(chat)}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Lead</p>
                        <p className="mt-1 text-sm font-semibold text-white">{getChatLeadName(chat)}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Objetivo</p>
                        <p className="mt-1 text-sm font-semibold text-white">{getChatObjective(chat)}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Tokens</p>
                        <p className="mt-1 text-sm font-semibold text-cyan-100">{chat.totalTokens}</p>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-slate-400">
                      {getChatSummary(chat) ?? "Sem resumo consolidado ainda. Abra a conversa para ver a progressao completa."}
                    </p>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-400">Nenhum chat registrado para este projeto ainda.</div>
              )}
              {sortedChats.length > chatsPerPage ? (
                <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-400">
                    Pagina {currentChatPage} de {chatTotalPages} • {sortedChats.length} conversas filtradas
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setChatPage((current) => Math.max(1, current - 1))}
                      disabled={currentChatPage <= 1}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatPage((current) => Math.min(chatTotalPages, current + 1))}
                      disabled={currentChatPage >= chatTotalPages}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-40"
                    >
                      Proxima
                    </button>
                  </div>
                </div>
              ) : null}
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
            whatsappCelular:
              next.whatsappCelular !== undefined ? formatWhatsAppPhone(next.whatsappCelular) : prev.whatsappCelular,
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
        onClose={() => {
          setConnectorModalOpen(false);
          resetConnectorForm();
        }}
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
              "URL de retorno:",
              "https://infrastudio.vercel.app/api/admin/conectores/mercado-livre/callback",
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
    </main>
  );
}
