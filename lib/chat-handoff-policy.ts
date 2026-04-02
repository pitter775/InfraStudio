import "server-only";

import type { ChatChannelKind } from "@/lib/chats";
import { getProjetoOpenAIConfig } from "@/lib/segredos";

export type HumanEscalationDecision = {
  decision: "none" | "offer" | "required";
  confidence: number;
  reason: string;
  usedLlm: boolean;
};

export function isHumanHandoffIntent(message: string) {
  const normalized = message.toLowerCase();
  return [
    /\bfalar com (um )?(humano|atendente|vendedor|pessoa)\b/,
    /\bquero falar com (um )?(humano|atendente|vendedor|pessoa)\b/,
    /\bme passa (um )?(humano|atendente|vendedor)\b/,
    /\bchama (um )?(humano|atendente|vendedor)\b/,
    /\bprefiro falar com (uma )?pessoa\b/,
    /\btem algu[eé]m ai\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function buildHumanHandoffReply(channelKind: ChatChannelKind) {
  return channelKind === "whatsapp"
    ? "Perfeito. Ja acionei um atendente humano para continuar por aqui. Assim que alguem assumir, seguimos neste mesmo WhatsApp."
    : "Perfeito. Ja acionei um atendente humano para continuar por aqui assim que possivel.";
}

function buildHumanOfferReply(channelKind: ChatChannelKind) {
  return channelKind === "whatsapp"
    ? "Se preferir, eu tambem posso te encaminhar para um atendente humano por aqui."
    : "Se preferir, eu tambem posso te encaminhar para um atendente humano.";
}

export function appendOptionalHumanOffer(reply: string, channelKind: ChatChannelKind) {
  const normalized = String(reply || "").trim();
  if (!normalized) {
    return buildHumanOfferReply(channelKind);
  }

  if (/\b(humano|atendente|vendedor|pessoa)\b/i.test(normalized)) {
    return normalized;
  }

  return `${normalized}\n\n${buildHumanOfferReply(channelKind)}`.trim();
}

function extractResponsesOutputText(payload: {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === "output_text" || typeof content.text === "string")
      .map((content) => content.text?.trim() ?? "")
      .filter(Boolean) ?? [];

  return parts.join("\n").trim();
}

function countRecentAssistantRecoveries(
  history: Array<{ role?: string | null; metadata?: Record<string, unknown> | null | undefined }>,
) {
  return history
    .slice(-6)
    .filter(
      (item) =>
        item.role === "assistant" &&
        item.metadata &&
        typeof item.metadata === "object" &&
        item.metadata.provider === "agent_scoped_recovery",
    ).length;
}

export async function classifyHumanEscalationNeed(input: {
  projetoId?: string | null;
  channelKind: ChatChannelKind;
  message: string;
  aiReply: string;
  aiMetadata?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
  history: Array<{ role?: string | null; conteudo?: string | null; metadata?: Record<string, unknown> | null | undefined }>;
}) {
  const metadata = input.aiMetadata;
  const provider = typeof metadata?.provider === "string" ? metadata.provider : null;
  const handoffSuggested = metadata?.handoffSuggested === true;
  const recoveryCount = countRecentAssistantRecoveries(input.history);

  if (input.channelKind !== "whatsapp") {
    return {
      decision: "none",
      confidence: 1,
      reason: "Escalada automatica so acontece no canal WhatsApp.",
      usedLlm: false,
    } satisfies HumanEscalationDecision;
  }

  if (!provider && !handoffSuggested) {
    return {
      decision: "none",
      confidence: 0.95,
      reason: "Sem sinal de dificuldade relevante para escalada.",
      usedLlm: false,
    } satisfies HumanEscalationDecision;
  }

  const openai = await getProjetoOpenAIConfig(input.projetoId ?? null);
  if (!openai.apiKey) {
    if (recoveryCount >= 2) {
      return {
        decision: "offer",
        confidence: 0.7,
        reason: "Houve recuperacoes repetidas sem OpenAI disponivel para classificar melhor.",
        usedLlm: false,
      } satisfies HumanEscalationDecision;
    }

    return {
      decision: "none",
      confidence: 0.7,
      reason: "Falha isolada sem classificador disponivel; melhor nao escalar automaticamente.",
      usedLlm: false,
    } satisfies HumanEscalationDecision;
  }

  const recentTurns = input.history
    .slice(-6)
    .map((item) => `${item.role === "assistant" ? "assistente" : "cliente"}: ${String(item.conteudo ?? "").slice(0, 280)}`)
    .join("\n");

  const summary =
    input.context &&
    typeof input.context === "object" &&
    input.context.memoria &&
    typeof input.context.memoria === "object" &&
    typeof (input.context.memoria as { resumo?: string | null }).resumo === "string"
      ? (input.context.memoria as { resumo?: string | null }).resumo
      : "";

  const prompt = [
    "Classifique se a conversa deve escalar para humano agora.",
    'Responda apenas JSON valido com: {"decision":"none|offer|required","confidence":0..1,"reason":"..."}',
    "Regras:",
    "- required: somente se o cliente pediu humano explicitamente, ou se ha risco/sensibilidade real, ou se a IA falhou repetidamente sem conseguir destravar.",
    "- offer: quando ajuda oferecer humano como opcao, mas sem acionar automaticamente.",
    "- none: para ambiguidade, typo, falta de detalhe, busca sem resultado, duvida comum, ou falha isolada.",
    "- Uma recuperacao isolada do agente quase nunca deve virar required.",
    "",
    `Canal: ${input.channelKind}`,
    `Mensagem atual do cliente: ${input.message}`,
    `Resposta atual da IA: ${input.aiReply}`,
    `Provider atual: ${provider ?? "unknown"}`,
    `handoffSuggested: ${handoffSuggested ? "true" : "false"}`,
    `recoveries recentes: ${recoveryCount}`,
    summary ? `Resumo atual: ${summary}` : "",
    "Historico recente:",
    recentTurns,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openai.apiKey}`,
      },
      body: JSON.stringify({
        model: openai.model,
        temperature: 0,
        max_output_tokens: 120,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      }),
    });

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const outputText = extractResponsesOutputText(payload);
    if (!response.ok || !outputText) {
      return {
        decision: recoveryCount >= 2 ? "offer" : "none",
        confidence: 0.55,
        reason: "Classificador nao respondeu; fallback conservador aplicado.",
        usedLlm: false,
      } satisfies HumanEscalationDecision;
    }

    const compactJson = outputText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(compactJson) as {
      decision?: "none" | "offer" | "required";
      confidence?: number;
      reason?: string;
    };

    if (parsed.decision !== "none" && parsed.decision !== "offer" && parsed.decision !== "required") {
      throw new Error("invalid handoff decision");
    }

    return {
      decision: parsed.decision,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      reason: typeof parsed.reason === "string" ? parsed.reason : "Classificacao sem motivo detalhado.",
      usedLlm: true,
    } satisfies HumanEscalationDecision;
  } catch {
    return {
      decision: recoveryCount >= 2 ? "offer" : "none",
      confidence: 0.55,
      reason: "Falha ao classificar escalada; fallback conservador aplicado.",
      usedLlm: false,
    } satisfies HumanEscalationDecision;
  }
}
