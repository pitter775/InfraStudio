import "server-only";

export type ChatChannelContext = {
  channel?: {
    kind?: string | null;
  };
  ui?: {
    structured_response?: boolean;
    allow_icons?: boolean;
  };
};

export type ChatChannelPolicy = {
  kind: "home" | "external_widget" | "admin_agent_test" | "whatsapp" | "unknown";
  preferStructuredReplies: boolean;
  allowCatalogPricing: boolean;
  allowLeadGate: boolean;
};

export function getChatChannelPolicy(context?: ChatChannelContext): ChatChannelPolicy {
  const kind = context?.channel?.kind;

  if (kind === "home_chat_widget") {
    return {
      kind: "home",
      preferStructuredReplies: context?.ui?.structured_response !== false,
      allowCatalogPricing: true,
      allowLeadGate: true,
    };
  }

  if (kind === "external_widget" || kind === "chat_js_widget") {
    return {
      kind: "external_widget",
      preferStructuredReplies: context?.ui?.structured_response !== false,
      allowCatalogPricing: false,
      allowLeadGate: true,
    };
  }

  if (kind === "admin_agent_test") {
    return {
      kind: "admin_agent_test",
      preferStructuredReplies: context?.ui?.structured_response !== false,
      allowCatalogPricing: false,
      allowLeadGate: false,
    };
  }

  if (kind === "whatsapp") {
    return {
      kind: "whatsapp",
      preferStructuredReplies: false,
      allowCatalogPricing: false,
      allowLeadGate: false,
    };
  }

  return {
    kind: "unknown",
    preferStructuredReplies: context?.ui?.structured_response !== false,
    allowCatalogPricing: false,
    allowLeadGate: true,
  };
}
