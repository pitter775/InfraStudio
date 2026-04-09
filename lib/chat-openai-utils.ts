import "server-only";

import type { ChatMessageRole } from "@/lib/chats";

type ConversationMessage = {
  role: ChatMessageRole;
  content: string;
};

export function buildOpenAiInput(messages: ConversationMessage[]) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : message.role === "system" ? "system" : "user",
    content: [
      {
        type: message.role === "assistant" ? "output_text" : "input_text",
        text: message.content,
      },
    ],
  }));
}

export type OpenAIResponsesPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
  model?: string;
};

export function extractOpenAiOutputText(payload: OpenAIResponsesPayload) {
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
