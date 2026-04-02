import "server-only";

import type { ConversationContext } from "@/lib/chat-context";
import type { ConversationDomainSupportState } from "@/lib/chat-domain-stage";
import { buildOpenAiInput } from "@/lib/chat-openai-utils";
import type { ChatMessageRole } from "@/lib/chats";

type ConversationMessage = {
  role: ChatMessageRole;
  content: string;
};

export function buildOpenAiStageRequestPayload(input: {
  model: string;
  context?: ConversationContext;
  history: ConversationMessage[];
  domainSupportState: ConversationDomainSupportState;
  systemPrompt: string;
  channelReplyInstruction: string;
  runtimePrompt: string;
  legacyAgentPrompt: string;
  structuredReplyInstruction: string;
  analyticalReplyInstruction: string;
  agentAssetInstruction: string;
  focusedApiContextInstructions: string;
  mercadoLivrePromptContext: string;
  mercadoLivreDetailPromptContext: string;
}) {
  const hasSummary = Boolean(input.context?.memoria?.resumo);
  const recentMessageWindow = hasSummary ? Math.min(input.domainSupportState.recentMessageWindow, 2) : input.domainSupportState.recentMessageWindow;
  const recentMessages = input.history.slice(-recentMessageWindow);
  const latestUserTurn = [...input.history].reverse().find((item) => item.role === "user");
  const summary = input.context?.memoria?.resumo ? `Resumo estruturado atual do chat (JSON compacto): ${input.context.memoria.resumo}` : "";
  const lead = input.context?.lead?.identificado
    ? `Lead identificado: nome=${input.context.lead?.nome ?? ""}; telefone=${input.context.lead?.telefone ?? ""}.`
    : "Lead ainda nao identificado.";
  const qualification = [
    input.context?.qualificacao?.segmento ? `Segmento: ${input.context.qualificacao.segmento}.` : "",
    input.context?.qualificacao?.objetivo ? `Objetivo: ${input.context.qualificacao.objetivo}.` : "",
    input.context?.qualificacao?.dor_principal ? `Dor principal: ${input.context.qualificacao.dor_principal}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const requestPayload = {
    model: input.model,
    temperature: 0.5,
    max_output_tokens: input.domainSupportState.maxOutputTokens,
    instructions: [
      input.systemPrompt,
      input.domainSupportState.instruction,
      input.channelReplyInstruction,
      input.runtimePrompt,
      input.legacyAgentPrompt,
      input.structuredReplyInstruction,
      input.analyticalReplyInstruction,
      input.agentAssetInstruction,
      input.focusedApiContextInstructions,
      input.mercadoLivrePromptContext,
      input.mercadoLivreDetailPromptContext,
      summary,
      lead,
      qualification,
    ]
      .filter(Boolean)
      .join("\n\n"),
    input: buildOpenAiInput(latestUserTurn ? [...recentMessages.filter((item) => item !== latestUserTurn), latestUserTurn] : recentMessages),
  };

  return {
    hasSummary,
    recentMessageWindow,
    requestPayload,
  };
}
