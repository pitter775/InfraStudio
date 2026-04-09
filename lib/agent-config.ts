import "server-only";

import { normalizeAgentRuntimeConfig, type AgentRuntimeConfig } from "@/lib/agent-runtime";

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

function sanitizeTechnicalValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeTechnicalValue(item))
      .filter((item) => item !== undefined && item !== null && item !== "") as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, sanitizeTechnicalValue(item)] as const)
      .filter(([, item]) => item !== undefined && item !== null && item !== "");
    return Object.fromEntries(entries) as T;
  }

  return value;
}

function compactAgentSummary(summary: string) {
  const normalized = normalizeAgentText(summary);
  if (!normalized) {
    return "";
  }

  return normalized.replace(/\{[\s\S]*\}$/g, "").trim();
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

export function buildAgentConfigFromSummary(summary: string) {
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

    if (title.includes("preco") || title.includes("valor") || title.includes("orcamento")) return "pricing";
    if (title.includes("qualifica") || title.includes("pergunta") || title.includes("descobrir")) return "qualification";
    if (title.includes("handoff") || title.includes("humano") || title.includes("escal") || title.includes("encaminh")) return "handoff";
    if (title.includes("cta") || title.includes("whatsapp") || title.includes("fechamento")) return "cta";
    if (title.includes("capacidade") || title.includes("servico") || title.includes("solucao") || title.includes("oferta")) return "capabilities";
    return "notes";
  };

  const pushLine = (line: string, preferSection = currentSection) => {
    const cleaned = line.replace(/^-\s*/, "").replace(/^\d+\.\s*/, "").trim();
    if (!cleaned) {
      return;
    }

    if (preferSection === "pricing") return void regrasPrecificacao.push(cleaned);
    if (preferSection === "qualification") return void perguntasQualificacao.push(cleaned);
    if (preferSection === "handoff") return void handoff.push(cleaned);
    if (preferSection === "cta") return void cta.push(cleaned);
    if (preferSection === "capabilities") return void capacidades.push(cleaned);
    if (!currentSection && intro.length < 2) return void intro.push(cleaned);
    observacoes.push(cleaned);
  };

  for (const line of lines) {
    if (!line) continue;
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
      whatsapp: [cta.join(" ").trim(), ...handoff.filter((item) => /whats|zap|telefone|fech|encaminh/i.test(item))].filter(Boolean).slice(0, 5),
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

const GENERIC_COMMERCIAL_RUNTIME_SIGNALS = [
  "automacao",
  "integracoes",
  "sistemas",
  "site",
  "whatsapp",
  "lead",
  "leads",
  "atendimento",
  "negocio",
  "negocios",
  "comercial",
  "vendas",
  "qualificar",
  "qualificacao",
];

function buildSearchTokens(value: string) {
  return normalizeAgentText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function shouldPreferGeneratedRuntime(promptBase: string, current: Record<string, unknown> | null | undefined, generated: Record<string, unknown>) {
  const currentRuntime = normalizeAgentRuntimeConfig(current?.runtime);
  const generatedRuntime = normalizeAgentRuntimeConfig(generated.runtime);
  if (!generatedRuntime) {
    return false;
  }

  if (!currentRuntime) {
    return true;
  }

  const promptText = normalizeAgentText(promptBase).toLowerCase();
  const currentRuntimeText = [currentRuntime.overview.objetivo, currentRuntime.overview.descricao_curta ?? "", ...Object.values(currentRuntime.blocks).flat()].join(" ").toLowerCase();
  const currentSignalCount = GENERIC_COMMERCIAL_RUNTIME_SIGNALS.filter((signal) => currentRuntimeText.includes(signal)).length;
  const promptSignalCount = GENERIC_COMMERCIAL_RUNTIME_SIGNALS.filter((signal) => promptText.includes(signal)).length;
  const sharedMeaningfulToken = buildSearchTokens(promptBase)
    .filter((token) => token.length >= 4)
    .some((token) => currentRuntimeText.includes(token));

  return currentSignalCount >= 2 && promptSignalCount < 2 && !sharedMeaningfulToken;
}

export function buildEffectiveAgentConfig(promptBase: string | null | undefined, current: Record<string, unknown> | null | undefined) {
  const normalizedPrompt = normalizeAgentText(promptBase ?? "");
  if (!normalizedPrompt) {
    return current ?? null;
  }

  const generated = buildAgentConfigFromSummary(normalizedPrompt) as Record<string, unknown>;
  const base = current && typeof current === "object" ? { ...current } : {};
  const next = { ...base, ...generated } as Record<string, unknown>;

  const currentHandoff = base.handoff && typeof base.handoff === "object" ? (base.handoff as Record<string, unknown>) : {};
  const generatedHandoff = generated.handoff && typeof generated.handoff === "object" ? (generated.handoff as Record<string, unknown>) : {};
  next.handoff = { ...currentHandoff, ...generatedHandoff };

  if (!shouldPreferGeneratedRuntime(normalizedPrompt, base, generated)) {
    next.runtime = base.runtime ?? generated.runtime;
  }

  return sanitizeTechnicalValue(next);
}

export function getEffectiveAgentRuntime(promptBase: string | null | undefined, current: Record<string, unknown> | null | undefined): AgentRuntimeConfig | null {
  const effectiveConfig = buildEffectiveAgentConfig(promptBase, current);
  return normalizeAgentRuntimeConfig(effectiveConfig && typeof effectiveConfig === "object" ? effectiveConfig.runtime : null);
}

