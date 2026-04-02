import "server-only";

import { buildOpenAiInput, extractOpenAiOutputText, type OpenAIResponsesPayload } from "@/lib/chat-openai-utils";
import { getProjetoOpenAIConfig } from "@/lib/segredos";
import type { ChatMessageRole } from "@/lib/chats";

type ConversationMessage = {
  role: ChatMessageRole;
  content: string;
};

export function shouldRefreshSummary(messageCount: number) {
  return messageCount > 0 && messageCount % 4 === 0;
}

export async function summarizeConversation(
  history: ConversationMessage[],
  currentSummary: string | null | undefined,
  projectId?: string | null,
) {
  const recent = history.slice(-6);
  const openai = await getProjetoOpenAIConfig(projectId);

  if (!openai.apiKey) {
    const compact = recent
      .map((item) => `${item.role === "assistant" ? "assistente" : "cliente"}:${item.content}`)
      .join(" | ")
      .slice(0, 320);

    return JSON.stringify({
      objetivo: null,
      lead: null,
      restricoes: compact || null,
      proximo_passo: currentSummary ? String(currentSummary).slice(0, 180) : null,
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openai.apiKey}`,
      },
      body: JSON.stringify({
        model: openai.model,
        temperature: 0.2,
        max_output_tokens: 110,
        instructions:
          'Resuma a conversa em portugues usando JSON compacto valido, sem markdown. Use somente as chaves: objetivo, lead, restricoes, proximo_passo. Cada valor deve ser curto. Em lead, use um objeto com nome, telefone e identificado quando existir.',
        input: buildOpenAiInput([
          ...(currentSummary ? [{ role: "system" as const, content: `Resumo anterior: ${currentSummary}` }] : []),
          ...recent,
        ]),
      }),
    });

    const payload = (await response.json()) as OpenAIResponsesPayload;
    return extractOpenAiOutputText(payload) || currentSummary || null;
  } catch (error) {
    console.error("[chat] failed to summarize conversation", error);
    return currentSummary ?? null;
  }
}
