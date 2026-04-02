import type { ConversationDomainStage, HeuristicIntentStage, OrchestratorRouteStage } from "@/lib/chat-intent-classifier";

export type ChatUsageTelemetry = {
  channelKind: string;
  provider: string;
  model: string;
  routeStage: OrchestratorRouteStage | string | null;
  heuristicStage: HeuristicIntentStage | string | null;
  domainStage: ConversationDomainStage | string | null;
  billingOrigin: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

function sanitizeOriginPart(value: unknown, fallback: string) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallback;
}

export function buildChatUsageOrigin(input: {
  channelKind?: string | null;
  provider?: string | null;
  routeStage?: OrchestratorRouteStage | string | null;
  domainStage?: ConversationDomainStage | string | null;
}) {
  const channelKind = sanitizeOriginPart(input.channelKind, "unknown_channel");
  const provider = sanitizeOriginPart(input.provider, "unknown_provider");
  const routeStage = sanitizeOriginPart(input.routeStage, "unknown_route");
  const domainStage = sanitizeOriginPart(input.domainStage, "unknown_domain");
  return `chat:${channelKind}:${provider}:${routeStage}:${domainStage}`;
}

export function buildChatUsageTelemetry(input: {
  channelKind?: string | null;
  provider?: string | null;
  model?: string | null;
  routeStage?: OrchestratorRouteStage | string | null;
  heuristicStage?: HeuristicIntentStage | string | null;
  domainStage?: ConversationDomainStage | string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
}): ChatUsageTelemetry {
  const inputTokens = Math.max(0, Number(input.inputTokens ?? 0));
  const outputTokens = Math.max(0, Number(input.outputTokens ?? 0));
  const estimatedCostUsd = Math.max(0, Number(input.estimatedCostUsd ?? 0));

  return {
    channelKind: sanitizeOriginPart(input.channelKind, "unknown_channel"),
    provider: sanitizeOriginPart(input.provider, "unknown_provider"),
    model: String(input.model ?? "").trim() || "unknown_model",
    routeStage: input.routeStage ?? null,
    heuristicStage: input.heuristicStage ?? null,
    domainStage: input.domainStage ?? null,
    billingOrigin: buildChatUsageOrigin(input),
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostUsd,
  };
}

export function readChatUsageTelemetry(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const usageTelemetry =
    "usageTelemetry" in metadata && metadata.usageTelemetry && typeof metadata.usageTelemetry === "object" && !Array.isArray(metadata.usageTelemetry)
      ? (metadata.usageTelemetry as Record<string, unknown>)
      : null;

  if (!usageTelemetry) {
    return null;
  }

  return {
    channelKind: typeof usageTelemetry.channelKind === "string" ? usageTelemetry.channelKind : null,
    provider: typeof usageTelemetry.provider === "string" ? usageTelemetry.provider : null,
    model: typeof usageTelemetry.model === "string" ? usageTelemetry.model : null,
    routeStage: typeof usageTelemetry.routeStage === "string" ? usageTelemetry.routeStage : null,
    heuristicStage: typeof usageTelemetry.heuristicStage === "string" ? usageTelemetry.heuristicStage : null,
    domainStage: typeof usageTelemetry.domainStage === "string" ? usageTelemetry.domainStage : null,
    billingOrigin: typeof usageTelemetry.billingOrigin === "string" ? usageTelemetry.billingOrigin : null,
    inputTokens: Number(usageTelemetry.inputTokens ?? 0) || 0,
    outputTokens: Number(usageTelemetry.outputTokens ?? 0) || 0,
    totalTokens: Number(usageTelemetry.totalTokens ?? 0) || 0,
    estimatedCostUsd: Number(usageTelemetry.estimatedCostUsd ?? 0) || 0,
  };
}

export function describeChatUsageOrigin(origin: string | null | undefined) {
  const normalized = String(origin ?? "").trim();
  if (!normalized) {
    return "sem classificacao";
  }

  const parts = normalized.split(":").filter(Boolean);
  if (parts.length < 5 || parts[0] !== "chat") {
    return normalized;
  }

  return `${parts[1]} / ${parts[2]} / ${parts[3]} / ${parts[4]}`;
}
