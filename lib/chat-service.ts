import { getAgenteById, getAgenteByIdentifier, type AgenteRecord } from "@/lib/agentes";
import { appendChatRequestLog, appendSystemLog } from "@/lib/chat-logs";
import { buildChatUsageTelemetry } from "@/lib/chat-usage-metrics";
import {
  appendOptionalHumanOffer,
  buildHumanHandoffReply,
  classifyHumanEscalationNeed,
  isHumanHandoffIntent,
  type HumanEscalationDecision,
} from "@/lib/chat-handoff-policy";
import { getChatHandoffByChatId, requestHumanHandoff, shouldPauseAssistantForHandoff } from "@/lib/chat-handoffs";
import { enrichLeadContext, generateSalesReply, shouldRefreshSummary, summarizeConversation } from "@/lib/chat-orchestrator";
import { DEFAULT_HOME_WIDGET_SLUG, getChatWidgetByProjetoAgente, getChatWidgetBySlug } from "@/lib/chat-widgets";
import { getChatAttachmentsMetadata, uploadChatAttachmentPayloads } from "@/lib/chat-attachments";
import { appendMessage, createChat, findActiveChatByChannel, findActiveWhatsAppChatByPhone, getChatById, getChatContext, listChatMessages, type ChatChannelKind, updateChatContext, updateChatStats } from "@/lib/chats";
import { registrarUso, verifyProjetoBillingAccess } from "@/lib/billing";
import { estimateOpenAICostUsd } from "@/lib/openai-pricing";
import { getProjetoById, getProjetoByIdentifier } from "@/lib/projetos";
import { appendRuntimeErrorLog } from "@/lib/runtime-error-log";
import { notifyWhatsAppHandoffContacts } from "@/lib/whatsapp-handoff-alerts";
import { getPreferredWhatsAppChannel, getWhatsAppChannelById, updateWhatsAppChannelSession } from "@/lib/whatsapp-channels";

export type ChatRequestBody = {
  chatId?: string;
  message?: string;
  mensagem?: string;
  projeto?: string;
  agente?: string;
  context?: Record<string, unknown> | null;
  widgetSlug?: string;
  canal?: ChatChannelKind;
  identificadorExterno?: string | null;
  identificador?: string | null;
  source?: string | null;
  whatsappChannelId?: string | null;
  attachments?: Array<{
    name?: string | null;
    type?: string | null;
    dataBase64?: string | null;
  }> | null;
};

type ResolvedChatChannel = {
  projeto: Awaited<ReturnType<typeof getProjetoById>> | Awaited<ReturnType<typeof getProjetoByIdentifier>>;
  agente: AgenteRecord | null;
  widget: Awaited<ReturnType<typeof getChatWidgetBySlug>> | Awaited<ReturnType<typeof getChatWidgetByProjetoAgente>>;
  channel: Record<string, unknown>;
  lockedToAgent: boolean;
};

type ChatContextValidationResult = {
  chat: NonNullable<Awaited<ReturnType<typeof getChatById>>>;
  authoritativeAgent: AgenteRecord | null;
};

function getLockedAgentIdFromChatContext(chat: NonNullable<Awaited<ReturnType<typeof getChatById>>>) {
  const context = getChatContext(chat) as Record<string, unknown>;
  const agente = isPlainObject(context.agente) ? context.agente : null;
  const locked = agente?.locked === true;
  const agenteId = typeof agente?.id === "string" && agente.id.trim() ? agente.id.trim() : null;
  return locked && agenteId ? agenteId : null;
}

function sanitizePhone(phone: string | null | undefined) {
  return String(phone || "").replace(/\D/g, "");
}

function normalizeInboundPhoneCandidate(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("@")) {
    return null;
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    return null;
  }

  return digits;
}

function buildWhatsAppLink(phone: string | null | undefined, message: string) {
  const sanitizedPhone = sanitizePhone(phone);
  if (!sanitizedPhone) {
    return null;
  }

  return "https://wa.me/" + sanitizedPhone + "?text=" + encodeURIComponent(message);
}

function getWhatsAppContactNameFromContext(context: Record<string, unknown> | null | undefined) {
  if (!isPlainObject(context?.whatsapp)) {
    return null;
  }

  const value = context.whatsapp.contactName;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getWhatsAppContactPhoneFromContext(context: Record<string, unknown> | null | undefined) {
  if (!isPlainObject(context?.lead) && !isPlainObject(context?.whatsapp)) {
    return null;
  }

  const leadPhone = isPlainObject(context?.lead) ? context.lead.telefone : null;
  const normalizedLeadPhone = normalizeInboundPhoneCandidate(typeof leadPhone === "string" ? leadPhone : null);
  if (normalizedLeadPhone) {
    return normalizedLeadPhone;
  }

  if (!isPlainObject(context?.whatsapp)) {
    return null;
  }

  const remotePhone = context.whatsapp.remotePhone;
  const normalizedRemotePhone = normalizeInboundPhoneCandidate(typeof remotePhone === "string" ? remotePhone : null);
  if (normalizedRemotePhone) {
    return normalizedRemotePhone;
  }

  const rawContact = isPlainObject(context.whatsapp.rawContact) ? context.whatsapp.rawContact : null;
  const rawContactNumber = rawContact?.number;
  const normalizedRawContactNumber = normalizeInboundPhoneCandidate(typeof rawContactNumber === "string" ? rawContactNumber : null);
  if (normalizedRawContactNumber) {
    return normalizedRawContactNumber;
  }

  const senderPhone = context.whatsapp.remetente;
  return normalizeInboundPhoneCandidate(typeof senderPhone === "string" ? senderPhone : null);
}

export function resolveCanonicalWhatsAppExternalIdentifier(input: {
  identificadorExterno?: string | null;
  identificador?: string | null;
  context?: Record<string, unknown> | null;
}) {
  const contextPhone = getWhatsAppContactPhoneFromContext(input.context);
  if (contextPhone) {
    return contextPhone;
  }

  const normalizedExternal = normalizeInboundPhoneCandidate(input.identificadorExterno);
  if (normalizedExternal) {
    return normalizedExternal;
  }

  const normalizedFallback = normalizeInboundPhoneCandidate(input.identificador);
  if (normalizedFallback) {
    return normalizedFallback;
  }

  return sanitizePhone(input.identificadorExterno ?? input.identificador);
}

function getWhatsAppContactAvatarFromContext(context: Record<string, unknown> | null | undefined) {
  if (!isPlainObject(context?.whatsapp)) {
    return null;
  }

  const value = context.whatsapp.profilePicUrl;
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  const rawContact = isPlainObject(context.whatsapp.rawContact) ? context.whatsapp.rawContact : null;
  const fallbackValue = rawContact?.profilePicUrl;
  return typeof fallbackValue === "string" && fallbackValue.trim() ? fallbackValue.trim() : null;
}

function resolveChatContactSnapshot(
  context: Record<string, unknown> | null | undefined,
  fallbackExternalIdentifier?: string | null,
) {
  return {
    contatoNome: getWhatsAppContactNameFromContext(context),
    contatoTelefone: getWhatsAppContactPhoneFromContext(context) ?? normalizeInboundPhoneCandidate(fallbackExternalIdentifier),
    contatoAvatarUrl: getWhatsAppContactAvatarFromContext(context),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeContext(base: Record<string, unknown>, extra?: Record<string, unknown> | null) {
  if (!extra) {
    return base;
  }

  return {
    ...base,
    ...extra,
  };
}

function buildSilentChatResult(chatId?: string | null) {
  return {
    chatId: chatId ?? "",
    reply: "",
    followUpReply: "",
    messageSequence: [],
    assets: [],
    whatsapp: null,
  };
}

function getChatWhatsAppChannelId(
  chat: NonNullable<Awaited<ReturnType<typeof getChatById>>> | null,
  body: ChatRequestBody,
) {
  if (typeof body.whatsappChannelId === "string" && body.whatsappChannelId.trim()) {
    return body.whatsappChannelId.trim();
  }

  const context = getChatContext(chat) as Record<string, unknown>;
  const whatsapp = isPlainObject(context.whatsapp) ? context.whatsapp : null;
  return typeof whatsapp?.channelId === "string" && whatsapp.channelId.trim() ? whatsapp.channelId.trim() : null;
}

function parseAssetPrice(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const numeric = value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRecentMercadoLivreProductsFromAssets(assets: unknown) {
  if (!Array.isArray(assets)) {
    return [];
  }

  return assets
    .filter(
      (asset) =>
        isPlainObject(asset) &&
        typeof asset.id === "string" &&
        (asset.id.startsWith("mercado-livre-") || /^MLB\d+$/i.test(asset.id)),
    )
    .map((asset, index) => ({
      id: typeof asset.id === "string" ? asset.id : null,
      nome: typeof asset.nome === "string" ? asset.nome : null,
      descricao: typeof asset.descricao === "string" ? asset.descricao : null,
      preco: parseAssetPrice(asset.descricao),
      link: typeof asset.targetUrl === "string" ? asset.targetUrl : null,
      imagem: typeof asset.publicUrl === "string" ? asset.publicUrl : null,
      cardIndex: index,
    }))
    .filter((asset) => asset.nome);
}

function isCatalogSearchMessage(message: string) {
  const latestNormalizedMessage = message.toLowerCase();
  const catalogSignals = ["tem ", "produto", "produtos", "catalogo", "catálogo", "loja", "vende", "procuro", "estou procurando"];
  return catalogSignals.some((signal) => latestNormalizedMessage.includes(signal)) || /^\s*e\s+\S+/i.test(message);
}

function isCatalogLoadMoreMessage(message: string) {
  const normalized = String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return false;
  }

  if (["mais", "outras", "outros", "mais opcoes", "outras opcoes", "mais modelos", "outros modelos"].includes(normalized)) {
    return true;
  }

  return [
    /\btem mais\b/,
    /\bquero mais\b/,
    /\bme mostra mais\b/,
    /\bmostra mais\b/,
    /\btraz mais\b/,
    /\bmanda mais\b/,
    /\bver mais\b/,
    /\boutras opcoes\b/,
    /\boutros modelos\b/,
    /\bmais modelos\b/,
    /\bmais opcoes\b/,
  ].some((pattern) => pattern.test(normalized));
}

function splitCatalogReplyForWhatsApp(reply: string, hasAssets: boolean) {
  const normalizedReply = String(reply || "").trim();
  if (!hasAssets || !normalizedReply) {
    return {
      mainReply: normalizedReply,
      followUpReply: "",
    };
  }

  const followUpPatterns = [
    /Me diga se gostou de algum ou se quer que eu traga mais opcoes parecidas\.?/i,
    /Me diga se gostou de algum ou se quer que eu traga mais opcoes nesse estilo\.?/i,
    /Se gostar desse estilo, eu posso te mostrar outras opcoes parecidas tambem\.?/i,
    /Se gostar desse estilo, eu posso te trazer outras opcoes parecidas tambem\.?/i,
    /Se quiser, eu tambem posso buscar outras opcoes parecidas ou seguir com este item por aqui\.?/i,
  ];

  const matchedPattern = followUpPatterns.find((pattern) => pattern.test(normalizedReply));
  if (!matchedPattern) {
    return {
      mainReply: normalizedReply,
      followUpReply: "",
    };
  }

  const followUpReply = normalizedReply.match(matchedPattern)?.[0]?.trim() ?? "";
  const mainReply = normalizedReply.replace(matchedPattern, "").replace(/\n{3,}/g, "\n\n").trim();

  return {
    mainReply: mainReply || normalizedReply,
    followUpReply,
  };
}

function formatWhatsAppOutboundText(reply: string) {
  return String(reply || "")
    .replace(/\r\n/g, "\n")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "*$1*")
    .replace(/^[\-\*]\s+/gm, "• ")
    .replace(/^(\d+)\)\s+/gm, "$1. ")
    .replace(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s]{1,28}):\s*/gm, "*$1:* ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatWhatsAppOutboundTextSafe(reply: string) {
  return String(reply || "")
    .replace(/\r\n/g, "\n")
    .replace(/([.!?])\s+(?=[A-Z0-9*])/g, "$1\n\n")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "*$1*")
    .replace(/^[\-\*]\s+/gm, "â€¢ ")
    .replace(/^(\d+)\)\s+/gm, "$1. ")
    .replace(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s]{1,28}):\s*/gm, (match, label: string) => {
      const normalizedLabel = String(label || "").trim().toLowerCase();
      if (["http", "https", "www"].includes(normalizedLabel)) {
        return match;
      }

      return `*${String(label || "").trim()}:* `;
    })
    .replace(/:\s+(?=(?:\d+\.|\*[A-Z0-9]))/g, ":\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatWhatsAppHumanOutboundText(reply: string) {
  return formatWhatsAppOutboundTextSafe(reply);
}

function stripAssistantMetaArtifacts(reply: string) {
  let sanitized = String(reply || "");

  const forbiddenPatterns = [
    /Seu atendimento acontece exclusivamente via WhatsApp[^\n]*?/gi,
    /Seu atendimento ocorre exclusivamente via WhatsApp[^\n]*?/gi,
    /de forma natural,\s*simp[aá]t(?:i|í)ca e acolhedora[^\n]*?/gi,
    /de forma natural,\s*simpat(?:i|í)ca e acolhedora[^\n]*?/gi,
    /de forma natural[^\n]*?acolhedora[^\n]*?/gi,
    /como se fosse uma pessoa real atendendo[^\n]*?/gi,
    /voce esta falando com (uma )?ia[^\n]*?/gi,
    /minha funcao aqui e te atender[^\n]*?/gi,
  ];

  for (const pattern of forbiddenPatterns) {
    sanitized = sanitized.replace(pattern, "");
  }

  return sanitized
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ", ")
    .replace(/,\s*\./g, ".")
    .replace(/\.\s*,/g, ".")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/([.!?])\s+(?=[A-Z0-9*])/g, "$1\n\n")
    .replace(/^([A-Za-z0-9][A-Za-z0-9\s]{1,28}):\s*/gm, "$1:\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripAssistantMetaReply(reply: string, channelKind: ChatChannelKind) {
  const sanitized = stripAssistantMetaArtifacts(reply);
  return channelKind === "whatsapp" ? formatWhatsAppOutboundTextSafe(sanitized) : sanitized;
}

export function sanitizeWhatsAppCustomerFacingReply(reply: string) {
  let sanitized = stripAssistantMetaArtifacts(reply);

  const promisePatterns = [
    /\b(?:deixa|deixe)\s+eu\s+(?:ver|verificar|consultar|olhar)\b[^.!?\n]*[.!?]?/gi,
    /\b(?:eu\s+)?vou\s+(?:ver|verificar|consultar|olhar)\b[^.!?\n]*[.!?]?/gi,
    /\b(?:eu\s+)?ja\s+(?:vejo|verifico|consulto|olho)\b[^.!?\n]*[.!?]?/gi,
    /\b(?:posso|consigo)\s+(?:ver|verificar|consultar|olhar)\s+(?:o\s+)?status\b[^.!?\n]*[.!?]?/gi,
  ];

  for (const pattern of promisePatterns) {
    sanitized = sanitized.replace(pattern, " ");
  }

  return preserveStructuredWhitespace(sanitized)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildWhatsAppMessageSequence(
  reply: string,
  assets: unknown,
  followUpReply?: string | null,
) {
  const messages: string[] = [];
  const intro = formatWhatsAppOutboundTextSafe(reply);
  if (intro) {
    messages.push(intro);
  }

  const assetMessages = Array.isArray(assets)
    ? assets
        .slice(0, 3)
        .map((asset, index) => {
          if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
            return "";
          }

          const nome = "nome" in asset ? String((asset as { nome?: string | null }).nome || "").trim() : "";
          const targetUrl = "targetUrl" in asset ? String((asset as { targetUrl?: string | null }).targetUrl || "").trim() : "";
          const whatsappText = "whatsappText" in asset ? String((asset as { whatsappText?: string | null }).whatsappText || "").trim() : "";
          const descricao = "descricao" in asset ? String((asset as { descricao?: string | null }).descricao || "").trim() : "";
          const supportText = whatsappText || descricao;

          if (!targetUrl && !supportText) {
            return "";
          }

          const parts = [formatWhatsAppOutboundTextSafe(`*${index + 1}. ${nome || "Produto"}*`)];
          if (supportText) {
            parts.push(formatWhatsAppOutboundTextSafe(supportText));
          }
          if (targetUrl) {
            parts.push(targetUrl);
          }

          return parts.join("\n").trim();
        })
        .filter(Boolean)
    : [];

  return [...messages, ...assetMessages];
}

function buildBillingBlockedResult(chatId: string, message: string) {
  return {
    chatId,
    reply: message,
    followUpReply: "",
    messageSequence: [],
    assets: [],
    whatsapp: null,
  };
}

async function appendChatFailureLog(input: {
  projetoId?: string | null;
  agenteId?: string | null;
  chatId?: string | null;
  origem: string;
  descricao: string;
  payload?: Record<string, unknown> | null;
}) {
  await appendSystemLog({
    projetoId: input.projetoId ?? null,
    tipo: "chat_failure",
    origem: input.origem,
    descricao: input.descricao,
    payload: {
      chatId: input.chatId ?? null,
      agenteId: input.agenteId ?? null,
      ...(input.payload ?? {}),
    },
  });
}

function normalizeChannelKind(body: ChatRequestBody) {
  if (typeof body.canal === "string" && body.canal.trim()) {
    return body.canal.trim();
  }

  return isPlainObject(body.context) && isPlainObject(body.context.channel) && typeof body.context.channel.kind === "string"
    ? body.context.channel.kind.trim()
    : "web";
}

function getAdminTestAgentId(body: ChatRequestBody) {
  return isPlainObject(body.context) &&
    isPlainObject(body.context.admin) &&
    typeof body.context.admin.agenteId === "string" &&
    body.context.admin.agenteId.trim()
    ? body.context.admin.agenteId.trim()
    : null;
}

function getAdminTestProjectId(body: ChatRequestBody) {
  return isPlainObject(body.context) &&
    isPlainObject(body.context.admin) &&
    typeof body.context.admin.projetoId === "string" &&
    body.context.admin.projetoId.trim()
    ? body.context.admin.projetoId.trim()
    : null;
}

function formatContinuationSummary(rawSummary?: string | null) {
  const summaryText = String(rawSummary || "").trim();
  if (!summaryText) {
    return null;
  }

  try {
    const parsed = JSON.parse(summaryText) as Record<string, unknown>;
    const snippets: string[] = [];
    const objetivo = typeof parsed.objetivo === "string" ? parsed.objetivo.trim() : "";
    const proximoPasso = typeof parsed.proximo_passo === "string" ? parsed.proximo_passo.trim() : "";
    const restricoes = typeof parsed.restricoes === "string" ? parsed.restricoes.trim() : "";
    const dorPrincipal = typeof parsed.dor_principal === "string" ? parsed.dor_principal.trim() : "";

    if (objetivo) snippets.push(`objetivo: ${objetivo}`);
    if (dorPrincipal) snippets.push(`dor: ${dorPrincipal}`);
    if (restricoes) snippets.push(`pontos de atencao: ${restricoes}`);
    if (proximoPasso) snippets.push(`proximo passo: ${proximoPasso}`);

    const compact = snippets.join(" | ").trim();
    if (compact) {
      return compact.slice(0, 280);
    }
  } catch {
    // fallback para texto livre
  }

  return summaryText.replace(/\s+/g, " ").trim().slice(0, 280);
}

export function buildContinuationMessage(input: {
  projetoNome?: string | null;
  agenteNome?: string | null;
  resumo?: string | null;
  produtoAtual?: string | null;
  ultimaMensagem: string;
}) {
  const resumoLimpo = formatContinuationSummary(input.resumo);
  const produtoAtual = String(input.produtoAtual || "").trim();
  const ultimaMensagem = String(input.ultimaMensagem || "").replace(/\s+/g, " ").trim().slice(0, 220);

  return [
    `Ola! Vim do chat do site${input.projetoNome ? ` do projeto ${input.projetoNome}` : ""}.`,
    input.agenteNome ? `Agente de referencia: ${input.agenteNome}.` : "",
    produtoAtual ? `Produto em foco: ${produtoAtual}.` : "",
    resumoLimpo ? `Resumo para continuidade: ${resumoLimpo}` : "",
    ultimaMensagem ? `Ultima mensagem do cliente: ${ultimaMensagem}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function preserveStructuredWhitespace(value: string) {
  return String(value || "")
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n");
}

async function validateChatAgainstResolvedChannel(input: {
  chat: NonNullable<Awaited<ReturnType<typeof getChatById>>>;
  resolved: ResolvedChatChannel;
  channelKind: ChatChannelKind;
  effectiveBody: ChatRequestBody;
  normalizedExternalIdentifier: string | null;
  lockedWhatsAppAgent: AgenteRecord | null;
}): Promise<ChatContextValidationResult | null> {
  const { chat, resolved, channelKind, effectiveBody, normalizedExternalIdentifier, lockedWhatsAppAgent } = input;

  if (!resolved.projeto || chat.projetoId !== resolved.projeto.id || chat.canal !== channelKind) {
    await appendRuntimeErrorLog({
      source: "chat_service.chat_id_guardrail",
      message: "ChatId recebido fora do contexto autorizado.",
      projetoId: resolved.projeto?.id ?? chat.projetoId,
      agenteId: chat.agenteId,
      payload: {
        chatId: chat.id,
        chatProjetoId: chat.projetoId,
        resolvedProjetoId: resolved.projeto?.id ?? null,
        chatCanal: chat.canal,
        requestedCanal: channelKind,
      },
    });
    return null;
  }

  const lockedAgentIdFromContext = getLockedAgentIdFromChatContext(chat);
  const expectedAgentId = lockedAgentIdFromContext ?? chat.agenteId ?? resolved.agente?.id ?? null;

  if (expectedAgentId && chat.agenteId !== expectedAgentId) {
    await appendRuntimeErrorLog({
      source: "chat_service.chat_id_guardrail",
      message: "ChatId recebido com agente divergente do canal travado.",
      projetoId: resolved.projeto.id,
      agenteId: chat.agenteId,
      payload: {
        chatId: chat.id,
        expectedAgentId,
        effectiveAgentId: effectiveBody.agente ?? null,
      },
    });
    return null;
  }

  if (normalizedExternalIdentifier && chat.identificadorExterno && chat.identificadorExterno !== normalizedExternalIdentifier) {
    await appendRuntimeErrorLog({
      source: "chat_service.chat_id_guardrail",
      message: "ChatId recebido com identificador externo divergente.",
      projetoId: resolved.projeto.id,
      agenteId: chat.agenteId,
      payload: {
        chatId: chat.id,
        chatExternalId: chat.identificadorExterno,
        requestedExternalId: normalizedExternalIdentifier,
      },
    });
    return null;
  }

  const authoritativeAgent =
    (expectedAgentId ? await getAgenteById(expectedAgentId) : null) ??
    lockedWhatsAppAgent ??
    (chat.agenteId ? await getAgenteById(chat.agenteId) : null);

  if (resolved.lockedToAgent || lockedAgentIdFromContext) {
    if (!authoritativeAgent || !authoritativeAgent.ativo || authoritativeAgent.projetoId !== chat.projetoId) {
      await appendRuntimeErrorLog({
        source: "chat_service.chat_guardrail",
        message: "Chat bloqueado por agente invalido, inativo ou fora do projeto.",
        projetoId: chat.projetoId,
        agenteId: expectedAgentId ?? chat.agenteId,
        payload: {
          chatId: chat.id,
          channelKind,
          agentProjetoId: authoritativeAgent?.projetoId ?? null,
          agentAtivo: authoritativeAgent?.ativo ?? null,
        },
      });
      return null;
    }
  }

  return {
    chat,
    authoritativeAgent,
  };
}

async function resolveChatChannel(body: ChatRequestBody): Promise<ResolvedChatChannel> {
  const channelKind = normalizeChannelKind(body);
  const adminTestAgentId = channelKind === "admin_agent_test" ? getAdminTestAgentId(body) : null;
  const adminTestProjectId = channelKind === "admin_agent_test" ? getAdminTestProjectId(body) : null;
  const projetoIdentifier = adminTestProjectId ?? (body.projeto?.trim() || null);
  const agenteIdentifier = adminTestAgentId ?? (body.agente?.trim() || null);

  if (projetoIdentifier) {
    const projeto = await getProjetoByIdentifier(projetoIdentifier);
    let agente = agenteIdentifier ? await getAgenteByIdentifier(agenteIdentifier, projeto?.id ?? null) : null;

    if (agente && (!agente.ativo || agente.projetoId !== projeto?.id)) {
      agente = null;
    }

    const widget = projeto ? await getChatWidgetByProjetoAgente({ projetoId: projeto.id, agenteId: agente?.id ?? null }) : null;

    return {
      projeto,
      agente,
      widget,
      lockedToAgent: true,
      channel: {
        kind: channelKind,
        projeto: projetoIdentifier,
        agente: agenteIdentifier,
        identificador_externo: body.identificadorExterno?.trim() || null,
      },
    };
  }

  const widgetSlug = body.widgetSlug?.trim() || DEFAULT_HOME_WIDGET_SLUG;
  const widget = await getChatWidgetBySlug(widgetSlug);

  if (!widget?.projetoId) {
    return {
      projeto: null,
      agente: null,
      widget: null,
      lockedToAgent: true,
      channel: {
        kind: channelKind,
        widgetSlug,
        identificador_externo: body.identificadorExterno?.trim() || null,
      },
    };
  }

  const projeto = await getProjetoById(widget.projetoId);
  const widgetAgent = widget?.agenteId && projeto ? await getAgenteById(widget.agenteId) : null;
  const agente = widgetAgent && widgetAgent.ativo && widgetAgent.projetoId === projeto?.id ? widgetAgent : null;

  return {
    projeto,
    agente,
    widget,
    lockedToAgent: true,
    channel: {
      kind: channelKind,
      widgetSlug,
      identificador_externo: body.identificadorExterno?.trim() || null,
    },
  };
}

export async function processIncomingChatMessage(body: ChatRequestBody) {
  const message = (body.message ?? body.mensagem)?.trim() || "";
  const inboundAttachments = Array.isArray(body.attachments)
    ? body.attachments
        .map((attachment) => ({
          name: attachment.name?.trim() || "arquivo",
          type: attachment.type?.trim() || "application/octet-stream",
          dataBase64: attachment.dataBase64?.trim() || "",
        }))
        .filter((attachment) => attachment.dataBase64)
        .slice(0, 5)
    : [];
  if (!message && !inboundAttachments.length) {
    throw new Error("Mensagem obrigatoria.");
  }

  const channelKind = normalizeChannelKind(body);
  let effectiveBody = body;
  let lockedWhatsAppAgent: AgenteRecord | null = null;

  if (channelKind === "admin_agent_test") {
    const adminTestAgentId = getAdminTestAgentId(body);
    const adminTestProjectId = getAdminTestProjectId(body);
    if (adminTestAgentId || adminTestProjectId) {
      effectiveBody = {
        ...body,
        agente: adminTestAgentId ?? body.agente,
        projeto: adminTestProjectId ?? body.projeto,
      };
    }
  }

  if (channelKind === "whatsapp" && body.whatsappChannelId) {
    const officialChannel = await getWhatsAppChannelById(body.whatsappChannelId);

    if (!officialChannel || !officialChannel.projetoId) {
      await appendRuntimeErrorLog({
        source: "chat_service.whatsapp_guardrail",
        message: "Canal WhatsApp nao encontrado ou sem projeto.",
        payload: { whatsappChannelId: body.whatsappChannelId },
      });
      await appendChatFailureLog({
        origem: "chat_service.whatsapp_guardrail",
        descricao: "Canal WhatsApp nao encontrado ou sem projeto.",
        payload: { whatsappChannelId: body.whatsappChannelId },
      });
      return buildSilentChatResult(body.chatId);
    }

    if (officialChannel.status !== "ativo") {
      await appendRuntimeErrorLog({
        source: "chat_service.whatsapp_guardrail",
        message: "Canal WhatsApp inativo bloqueado.",
        projetoId: officialChannel.projetoId,
        agenteId: officialChannel.agenteId,
        payload: { whatsappChannelId: officialChannel.id, status: officialChannel.status },
      });
      await appendChatFailureLog({
        projetoId: officialChannel.projetoId,
        agenteId: officialChannel.agenteId,
        origem: "chat_service.whatsapp_guardrail",
        descricao: "Canal WhatsApp inativo bloqueado.",
        payload: { whatsappChannelId: officialChannel.id, status: officialChannel.status },
      });
      return buildSilentChatResult(body.chatId);
    }

    if (!officialChannel.agenteId) {
      await appendRuntimeErrorLog({
        source: "chat_service.whatsapp_guardrail",
        message: "Canal WhatsApp sem agente vinculado.",
        projetoId: officialChannel.projetoId,
        payload: { whatsappChannelId: officialChannel.id },
      });
      await appendChatFailureLog({
        projetoId: officialChannel.projetoId,
        origem: "chat_service.whatsapp_guardrail",
        descricao: "Canal WhatsApp sem agente vinculado.",
        payload: { whatsappChannelId: officialChannel.id },
      });
      return buildSilentChatResult(body.chatId);
    }

    const officialAgent = await getAgenteById(officialChannel.agenteId);

    if (!officialAgent || !officialAgent.ativo || officialAgent.projetoId !== officialChannel.projetoId) {
      await appendRuntimeErrorLog({
        source: "chat_service.whatsapp_guardrail",
        message: "Agente do canal WhatsApp invalido, inativo ou fora do projeto.",
        projetoId: officialChannel.projetoId,
        agenteId: officialChannel.agenteId,
        payload: { whatsappChannelId: officialChannel.id, agenteProjetoId: officialAgent?.projetoId ?? null, agenteAtivo: officialAgent?.ativo ?? null },
      });
      await appendChatFailureLog({
        projetoId: officialChannel.projetoId,
        agenteId: officialChannel.agenteId,
        origem: "chat_service.whatsapp_guardrail",
        descricao: "Agente do canal WhatsApp invalido, inativo ou fora do projeto.",
        payload: {
          whatsappChannelId: officialChannel.id,
          agenteProjetoId: officialAgent?.projetoId ?? null,
          agenteAtivo: officialAgent?.ativo ?? null,
        },
      });
      return buildSilentChatResult(body.chatId);
    }

    lockedWhatsAppAgent = officialAgent;

    effectiveBody = {
      ...body,
      projeto: officialChannel.projetoId,
      agente: officialAgent.id,
      context: mergeContext(
        isPlainObject(body.context) ? body.context : {},
        {
          whatsapp: {
            ...(isPlainObject(body.context?.whatsapp) ? body.context.whatsapp : {}),
            channelId: officialChannel.id,
            numeroCanal: officialChannel.numero,
          },
        },
      ),
    };
  }

  const normalizedExternalIdentifier =
    channelKind === "whatsapp"
      ? resolveCanonicalWhatsAppExternalIdentifier({
          identificadorExterno: effectiveBody.identificadorExterno,
          identificador: effectiveBody.identificador,
          context: isPlainObject(effectiveBody.context) ? effectiveBody.context : null,
        })
      : effectiveBody.identificadorExterno?.trim() || effectiveBody.identificador?.trim() || null;
  const resolved = await resolveChatChannel({
    ...effectiveBody,
    canal: channelKind,
    identificadorExterno: normalizedExternalIdentifier,
  });

  if (!resolved.projeto) {
    throw new Error("Projeto ou widget do chat nao encontrado. Revise o embed configurado para este site.");
  }

  if (resolved.lockedToAgent && !resolved.agente) {
    await appendRuntimeErrorLog({
      source: "chat_service.channel_resolution",
      message: "Canal travado a agente invalido ou inativo.",
      projetoId: resolved.projeto.id,
      payload: {
        projeto: effectiveBody.projeto ?? null,
        agente: effectiveBody.agente ?? null,
        widgetSlug: effectiveBody.widgetSlug ?? null,
        channelKind,
      },
    });
    await appendChatFailureLog({
      projetoId: resolved.projeto.id,
      origem: "chat_service.channel_resolution",
      descricao: "Canal travado a agente invalido ou inativo.",
      payload: {
        projeto: effectiveBody.projeto ?? null,
        agente: effectiveBody.agente ?? null,
        widgetSlug: effectiveBody.widgetSlug ?? null,
        channelKind,
      },
    });
    return buildSilentChatResult(effectiveBody.chatId);
  }

  let authoritativeAgent = lockedWhatsAppAgent ?? resolved.agente ?? null;
  let chat = effectiveBody.chatId ? await getChatById(effectiveBody.chatId) : null;

  if (chat) {
    const validatedChat = await validateChatAgainstResolvedChannel({
      chat,
      resolved,
      channelKind,
      effectiveBody,
      normalizedExternalIdentifier,
      lockedWhatsAppAgent,
    });

    if (!validatedChat) {
      chat = null;
    } else {
      chat = validatedChat.chat;
      authoritativeAgent = validatedChat.authoritativeAgent ?? authoritativeAgent;
    }
  }

    if (!chat) {
      const extraContext = isPlainObject(effectiveBody.context) ? effectiveBody.context : null;
      if (normalizedExternalIdentifier) {
        const preferredAgentId = resolved.agente?.id ?? null;
        chat = await findActiveChatByChannel({
          projetoId: resolved.projeto.id,
        agenteId: preferredAgentId,
        canal: channelKind,
        identificadorExterno: normalizedExternalIdentifier,
          channelScopeId: channelKind === "whatsapp" ? body.whatsappChannelId ?? null : null,
        });

        if (!chat && channelKind === "whatsapp") {
          const fallbackPhone =
            getWhatsAppContactPhoneFromContext(extraContext) ??
            getWhatsAppContactPhoneFromContext(effectiveBody.context && typeof effectiveBody.context === "object" ? effectiveBody.context : null) ??
            normalizedExternalIdentifier;

          if (fallbackPhone) {
            chat = await findActiveWhatsAppChatByPhone({
              projetoId: resolved.projeto.id,
              agenteId: preferredAgentId,
              phone: fallbackPhone,
              channelScopeId: body.whatsappChannelId ?? null,
            });
          }
        }
      }

      if (!chat) {
        const source = effectiveBody.source?.trim() || (channelKind === "whatsapp" ? "whatsapp_bridge" : "site_widget");
        const baseContext = {
        source,
        canal: channelKind,
        objetivo: channelKind === "whatsapp" ? "atendimento_whatsapp" : "captacao_comercial",
        widget: resolved.widget
          ? {
              slug: resolved.widget.slug,
              nome: resolved.widget.nome,
              whatsapp_celular: resolved.widget.whatsappCelular || null,
            }
          : null,
        projeto: {
          id: resolved.projeto?.id ?? null,
          slug: resolved.projeto?.slug ?? effectiveBody.projeto?.trim() ?? null,
          nome: resolved.projeto?.nome ?? null,
        },
        agente: {
          id: resolved.agente?.id ?? null,
          slug: resolved.agente?.slug ?? effectiveBody.agente?.trim() ?? null,
          nome: resolved.agente?.nome ?? null,
          locked: resolved.lockedToAgent,
        },
        sdk: {
          version: "1",
          channel: channelKind === "whatsapp" ? "whatsapp-bridge" : "chat.js",
        },
        channel: {
          ...resolved.channel,
          external_id: normalizedExternalIdentifier,
        },
      };

      const initialContext = mergeContext(baseContext, extraContext);
      const contactSnapshot = resolveChatContactSnapshot(initialContext, normalizedExternalIdentifier);
      const previewText = message || "Midia recebida";
      const fallbackChatTitle =
        contactSnapshot.contatoNome ?? (previewText.length > 60 ? `${previewText.slice(0, 57)}...` : previewText);
      chat = await createChat({
        titulo: fallbackChatTitle,
        projetoId: resolved.projeto?.id ?? null,
        agenteId: resolved.agente?.id ?? null,
        canal: channelKind,
        identificadorExterno: normalizedExternalIdentifier,
        contexto: initialContext,
        contatoNome: contactSnapshot.contatoNome,
        contatoTelefone: contactSnapshot.contatoTelefone,
        contatoAvatarUrl: contactSnapshot.contatoAvatarUrl,
      });
    }
  }

  if (!chat) {
    throw new Error("Nao foi possivel iniciar a conversa no banco. Verifique permissoes nas tabelas `chats` e `mensagens`.");
  }

  const chatContext = getChatContext(chat) as Record<string, unknown>;
  const lockedAgentFromContext =
    isPlainObject(chatContext.agente) && chatContext.agente.locked === true ? true : false;
  const lockedAgentIdFromContext = getLockedAgentIdFromChatContext(chat);

  if (channelKind === "whatsapp" || lockedAgentFromContext) {
    const currentAgentId = lockedAgentIdFromContext ?? chat.agenteId ?? effectiveBody.agente ?? null;
    const currentAgent = authoritativeAgent ?? (currentAgentId ? await getAgenteById(currentAgentId) : null);

    if (!currentAgent || !currentAgent.ativo || currentAgent.projetoId !== chat.projetoId) {
      await appendRuntimeErrorLog({
        source: "chat_service.chat_guardrail",
        message: "Chat bloqueado por agente invalido, inativo ou fora do projeto.",
        projetoId: chat.projetoId,
        agenteId: currentAgentId,
        payload: {
          chatId: chat.id,
          channelKind,
          lockedAgentFromContext,
          agentProjetoId: currentAgent?.projetoId ?? null,
          agentAtivo: currentAgent?.ativo ?? null,
        },
      });
      await appendChatFailureLog({
        projetoId: chat.projetoId,
        agenteId: currentAgentId,
        chatId: chat.id,
        origem: "chat_service.chat_guardrail",
        descricao: "Chat bloqueado por agente invalido, inativo ou fora do projeto.",
        payload: {
          channelKind,
          lockedAgentFromContext,
          agentProjetoId: currentAgent?.projetoId ?? null,
          agentAtivo: currentAgent?.ativo ?? null,
        },
      });
      return buildSilentChatResult(chat.id);
    }

    authoritativeAgent = currentAgent;
  }

  const uploadedInboundAttachments =
    inboundAttachments.length && chat.id
      ? await uploadChatAttachmentPayloads({
          projetoId: chat.projetoId,
          chatId: chat.id,
          attachments: inboundAttachments,
        })
      : [];

  const userMessage = await appendMessage({
    chatId: chat.id,
    role: "user",
    conteudo: message || "Midia recebida pelo WhatsApp.",
    canal: channelKind,
    identificadorExterno: normalizedExternalIdentifier,
    metadata: {
      source: effectiveBody.source?.trim() || (channelKind === "whatsapp" ? "whatsapp_bridge" : "site_widget"),
      ...(uploadedInboundAttachments.length ? { attachments: getChatAttachmentsMetadata(uploadedInboundAttachments) } : {}),
    },
  });

  if (!userMessage) {
    throw new Error("Nao foi possivel gravar a mensagem do cliente. Verifique permissoes na tabela `mensagens`.");
  }

  if (channelKind === "whatsapp") {
    const inboundWhatsappContext =
      effectiveBody.context && isPlainObject(effectiveBody.context.whatsapp)
        ? (effectiveBody.context.whatsapp as {
            [key: string]: unknown;
            channelId?: string | null;
            remoteJid?: string | null;
            remotePhone?: string | null;
            remetente?: string | null;
            contactName?: string | null;
            profilePicUrl?: string | null;
          })
        : null;
    const inboundLeadContext =
      effectiveBody.context && isPlainObject(effectiveBody.context.lead)
        ? (effectiveBody.context.lead as Record<string, unknown>)
        : null;
    const inboundContactSnapshot = resolveChatContactSnapshot(
      effectiveBody.context && typeof effectiveBody.context === "object" ? effectiveBody.context : null,
      normalizedExternalIdentifier,
    );

    await appendSystemLog({
      projetoId: chat.projetoId,
      tipo: "chat_whatsapp_contact_snapshot",
      origem: "chat_service.whatsapp",
      descricao: "Snapshot de contato recebido do WhatsApp.",
      payload: {
        chatId: chat.id,
        channelId: inboundWhatsappContext?.channelId ?? body.whatsappChannelId ?? null,
        remoteJid: inboundWhatsappContext?.remoteJid ?? null,
        remotePhone: inboundWhatsappContext?.remotePhone ?? null,
        remetente: inboundWhatsappContext?.remetente ?? null,
        contactName: inboundWhatsappContext?.contactName ?? null,
        profilePicUrl: inboundWhatsappContext?.profilePicUrl ?? null,
        profilePicUrlPresent: Boolean(inboundWhatsappContext?.profilePicUrl),
        rawContact: isPlainObject(inboundWhatsappContext?.rawContact)
          ? inboundWhatsappContext.rawContact
          : null,
        rawWhatsappContext: inboundWhatsappContext,
        rawLeadContext: inboundLeadContext,
        resolvedSnapshot: inboundContactSnapshot,
        storedChatSnapshot: {
          contatoNome: chat.contatoNome ?? null,
          contatoTelefone: chat.contatoTelefone ?? null,
          contatoAvatarUrl: chat.contatoAvatarUrl ?? null,
        },
        normalizedExternalIdentifier,
      },
      skipErrorGate: true,
    });
  }

  const currentHandoff = await getChatHandoffByChatId(chat.id);
  if (shouldPauseAssistantForHandoff(currentHandoff)) {
    await appendSystemLog({
      projetoId: chat.projetoId,
      tipo: "chat_handoff_paused",
      origem: "chat_service.handoff",
      descricao: "Mensagem recebida com atendimento humano ativo; IA permaneceu em silencio.",
      payload: {
        chatId: chat.id,
        handoffStatus: currentHandoff?.status ?? null,
        channelKind,
      },
    });

    if (channelKind === "whatsapp" && body.whatsappChannelId) {
      await updateWhatsAppChannelSession(body.whatsappChannelId, {
        connectionStatus: "online",
        lastInboundAt: new Date().toISOString(),
      });
    }

    return buildSilentChatResult(chat.id);
  }

  const history = await listChatMessages(chat.id);
  const billingAccess = chat.projetoId ? await verifyProjetoBillingAccess(chat.projetoId) : null;
  if (billingAccess && !billingAccess.allowed) {
    await appendChatFailureLog({
      projetoId: chat.projetoId,
      agenteId: authoritativeAgent?.id ?? chat.agenteId,
      chatId: chat.id,
      origem: "chat_service.billing_guardrail",
      descricao: billingAccess.message ?? "Projeto bloqueado por limite de uso.",
      payload: {
        code: billingAccess.code,
      },
    });

    return buildBillingBlockedResult(
      chat.id,
      billingAccess.message ?? "O limite mensal deste projeto foi atingido. Fale com o administrador para liberar novo ciclo ou ajustar o plano.",
    );
  }

  const currentContext = chatContext;
  const extraContext = isPlainObject(effectiveBody.context) ? effectiveBody.context : null;
  const mergedCurrentContext = mergeContext(currentContext, extraContext);
  const enrichedContext = enrichLeadContext(
    mergedCurrentContext,
    history.map((item) => ({ role: item.role, content: item.conteudo })),
    message,
  );
  const enrichedContextRecord = enrichedContext as Record<string, unknown>;
  const nextContext = {
    ...mergedCurrentContext,
    ...enrichedContext,
    canal: channelKind,
    channel: isPlainObject(enrichedContextRecord.channel)
      ? {
          ...(isPlainObject(mergedCurrentContext.channel) ? mergedCurrentContext.channel : {}),
          ...enrichedContextRecord.channel,
          kind: channelKind,
          external_id: normalizedExternalIdentifier,
        }
      : {
          ...(isPlainObject(mergedCurrentContext.channel) ? mergedCurrentContext.channel : {}),
          kind: channelKind,
          external_id: normalizedExternalIdentifier,
        },
    ui: {
      ...(isPlainObject(mergedCurrentContext.ui) ? mergedCurrentContext.ui : {}),
      ...(isPlainObject(enrichedContextRecord.ui) ? enrichedContextRecord.ui : {}),
      ...(channelKind === "whatsapp"
        ? {
            structured_response: false,
            allow_icons: true,
          }
        : {}),
    },
    sdk: isPlainObject(enrichedContextRecord.sdk)
      ? { ...(isPlainObject(mergedCurrentContext.sdk) ? mergedCurrentContext.sdk : {}), ...enrichedContextRecord.sdk }
      : mergedCurrentContext.sdk,
    widget: isPlainObject(enrichedContextRecord.widget)
      ? { ...(isPlainObject(mergedCurrentContext.widget) ? mergedCurrentContext.widget : {}), ...enrichedContextRecord.widget }
      : mergedCurrentContext.widget,
    catalogo: isPlainObject(mergedCurrentContext.catalogo) ? { ...mergedCurrentContext.catalogo } : {},
  };

  if (!nextContext.lead?.telefone && history.length >= 2 && history.length < 6) {
    nextContext.qualificacao = {
      ...nextContext.qualificacao,
      pronto_para_whatsapp: false,
    };
  }

  const requestedCatalogSearch = isCatalogSearchMessage(message);
  if (requestedCatalogSearch) {
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      ultimaBusca: message.trim(),
      produtoAtual: null,
      ultimosProdutos: [],
      snapshotId: null,
      snapshotCreatedAt: null,
      snapshotTurnId: null,
    };
  }

  const ai = await generateSalesReply(
    history.map((item) => ({
      role: item.role,
      content: item.conteudo,
    })),
    nextContext as Parameters<typeof generateSalesReply>[1],
  );

  const explicitHumanHandoffRequested = isHumanHandoffIntent(message);
  const aiHumanEscalationDecision = explicitHumanHandoffRequested
    ? ({
        decision: "required",
        confidence: 1,
        reason: "Cliente pediu atendimento humano explicitamente.",
        usedLlm: false,
      } satisfies HumanEscalationDecision)
    : await classifyHumanEscalationNeed({
        projetoId: chat.projetoId,
        channelKind,
        message,
        aiReply: String(ai.reply ?? ""),
        aiMetadata: ai.metadata,
        context: nextContext as Record<string, unknown>,
        history,
      });

  await appendSystemLog({
    projetoId: chat.projetoId,
    tipo: "chat_handoff_decision",
    origem: "chat_service.handoff",
    descricao: "Decisao de escalada humana avaliada.",
    payload: {
      chatId: chat.id,
      channelKind,
      explicitHumanHandoffRequested,
      decision: aiHumanEscalationDecision.decision,
      confidence: aiHumanEscalationDecision.confidence,
      reason: aiHumanEscalationDecision.reason,
      usedLlm: aiHumanEscalationDecision.usedLlm,
      provider: typeof ai.metadata?.provider === "string" ? ai.metadata.provider : null,
      model: typeof ai.metadata?.model === "string" ? ai.metadata.model : null,
    },
    skipErrorGate: true,
  });

  if (
    aiHumanEscalationDecision.decision === "offer" &&
    !explicitHumanHandoffRequested &&
    String(ai.reply ?? "").trim()
  ) {
    ai.reply = appendOptionalHumanOffer(ai.reply, channelKind);
  }

  const handoffRequested =
    channelKind === "whatsapp" &&
    Boolean(chat.projetoId) &&
    Boolean(getChatWhatsAppChannelId(chat, body)) &&
    aiHumanEscalationDecision.decision === "required";

  if (handoffRequested && chat.projetoId) {
    const canalWhatsappId = getChatWhatsAppChannelId(chat, body);
    const acknowledgement = buildHumanHandoffReply(channelKind);
    const alertResult = canalWhatsappId
        ? await notifyWhatsAppHandoffContacts({
            projetoId: chat.projetoId,
            projetoNome: nextContext.projeto?.nome ? String(nextContext.projeto.nome) : null,
            canalWhatsappId,
            chatId: chat.id,
            chatTitle:
              typeof nextContext.lead?.nome === "string" && nextContext.lead.nome.trim()
                ? nextContext.lead.nome.trim()
                : chat.titulo,
            latestUserMessage: message,
            motivo: explicitHumanHandoffRequested
              ? "Cliente pediu atendimento humano."
              : aiHumanEscalationDecision.reason,
          })
      : { ok: false, sent: 0, link: null, failures: [] as Array<{ numero: string; error: string }> };

    await requestHumanHandoff({
      chatId: chat.id,
      projetoId: chat.projetoId,
      canalWhatsappId: canalWhatsappId ?? null,
      requestedBy: "agent",
      motivo: explicitHumanHandoffRequested
        ? "Cliente pediu atendimento humano."
        : aiHumanEscalationDecision.reason,
      metadata: {
        trigger: explicitHumanHandoffRequested ? "message_intent" : "classified_required",
        escalationDecision: aiHumanEscalationDecision.decision,
        escalationConfidence: aiHumanEscalationDecision.confidence,
        escalationUsedLlm: aiHumanEscalationDecision.usedLlm,
        escalationReason: aiHumanEscalationDecision.reason,
        alertSent: alertResult.sent,
        alertLink: alertResult.link ?? null,
        failures: "failures" in alertResult ? alertResult.failures : [],
      },
      alertMessage: alertResult.link ?? null,
    });

    ai.reply = acknowledgement;
    ai.assets = [];
    (nextContext as Record<string, unknown>).handoff = {
      status: "pending_human",
      requestedAt: new Date().toISOString(),
      alertLink: alertResult.link ?? null,
      alertCount: alertResult.sent ?? 0,
    };
  }

  if (!String(ai.reply ?? "").trim()) {
    await appendChatFailureLog({
      projetoId: chat.projetoId,
      agenteId: authoritativeAgent?.id ?? chat.agenteId,
      chatId: chat.id,
      origem: "chat_service.reply_guardrail",
      descricao: "Resposta bloqueada ou vazia no fluxo do agente.",
      payload: {
        channelKind,
        provider: typeof ai.metadata?.provider === "string" ? ai.metadata.provider : null,
        model: typeof ai.metadata?.model === "string" ? ai.metadata.model : null,
      },
    });
  }

  if (typeof ai.metadata?.provider === "string" && ai.metadata.provider === "agent_scoped_recovery") {
    await appendChatFailureLog({
      projetoId: chat.projetoId,
      agenteId: authoritativeAgent?.id ?? chat.agenteId,
      chatId: chat.id,
      origem: "chat_service.agent_scoped_recovery",
      descricao: "IA principal falhou e a conversa seguiu com recuperacao contextual do agente.",
      payload: {
        channelKind,
        provider: ai.metadata.provider,
        model: typeof ai.metadata?.model === "string" ? ai.metadata.model : null,
      },
    });
    await appendSystemLog({
      projetoId: chat.projetoId,
      tipo: "chat_recovery",
      origem: "chat_service.agent_scoped_recovery",
      descricao: "Recuperacao contextual aplicada no agente travado.",
      payload: {
        chatId: chat.id,
        agenteId: authoritativeAgent?.id ?? chat.agenteId ?? null,
        channelKind,
        provider: ai.metadata.provider,
        model: typeof ai.metadata?.model === "string" ? ai.metadata.model : null,
      },
    });
  }

  const aiResolvedAgentId = typeof ai.metadata?.agenteId === "string" ? ai.metadata.agenteId : null;
  const aiResolvedAgentName = typeof ai.metadata?.agenteNome === "string" ? ai.metadata.agenteNome : null;
  const lockedAgent = authoritativeAgent ?? (chat.agenteId ? await getAgenteById(chat.agenteId) : null);

  if (resolved.lockedToAgent && aiResolvedAgentId && lockedAgent && aiResolvedAgentId !== lockedAgent.id) {
    await appendRuntimeErrorLog({
      source: "chat_service.agent_drift_guardrail",
      message: "Resposta tentou sobrescrever o agente travado do chat.",
      projetoId: chat.projetoId,
      agenteId: lockedAgent.id,
      payload: {
        chatId: chat.id,
        lockedAgentId: lockedAgent.id,
        aiResolvedAgentId,
        aiResolvedAgentName,
        channelKind,
      },
    });
    await appendChatFailureLog({
      projetoId: chat.projetoId,
      agenteId: lockedAgent.id,
      chatId: chat.id,
      origem: "chat_service.agent_drift_guardrail",
      descricao: "Resposta tentou sobrescrever o agente travado do chat.",
      payload: {
        lockedAgentId: lockedAgent.id,
        aiResolvedAgentId,
        aiResolvedAgentName,
        channelKind,
      },
    });
  }

  nextContext.agente = {
    id: lockedAgent?.id ?? lockedAgentIdFromContext ?? chat.agenteId ?? null,
    nome: lockedAgent?.nome ?? aiResolvedAgentName ?? null,
    locked: resolved.lockedToAgent || channelKind === "whatsapp" || lockedAgentFromContext,
  };

  const latestNormalizedMessage = message.toLowerCase();
  const catalogSignals = ["tem ", "produto", "produtos", "catalogo", "catálogo", "loja", "vende", "procuro", "estou procurando"];
  const catalogSearchRequested =
    !isCatalogLoadMoreMessage(message) &&
    (catalogSignals.some((signal) => latestNormalizedMessage.includes(signal)) || /^\s*e\s+\S+/i.test(message));
  if (catalogSearchRequested) {
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      ultimaBusca: message.trim(),
    };
  }

  const recentMercadoLivreProducts = extractRecentMercadoLivreProductsFromAssets(ai.assets);
  if (recentMercadoLivreProducts.length) {
    const snapshotCreatedAt = new Date().toISOString();
    const snapshotTurnId = Number(nextContext.memoria?.mensagem_count ?? history.length + 1);
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      ultimosProdutos: recentMercadoLivreProducts,
      snapshotId: `${chat.id}:${snapshotTurnId}:${snapshotCreatedAt}`,
      snapshotCreatedAt,
      snapshotTurnId,
    };
  }

  const metadataCatalogProduct =
    isPlainObject(ai.metadata) && "catalogoProdutoAtual" in ai.metadata ? ai.metadata.catalogoProdutoAtual : null;

  if (isPlainObject(metadataCatalogProduct)) {
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      produtoAtual: metadataCatalogProduct,
    };
  }

  const estimatedCostUsd =
    ai.metadata?.provider === "openai"
      ? estimateOpenAICostUsd(ai.usage.inputTokens, ai.usage.outputTokens, typeof ai.metadata?.model === "string" ? ai.metadata.model : null)
      : 0;
  const usageTelemetry = buildChatUsageTelemetry({
    channelKind,
    provider: typeof ai.metadata?.provider === "string" ? ai.metadata.provider : null,
    model: typeof ai.metadata?.model === "string" ? ai.metadata.model : null,
    routeStage: typeof ai.metadata?.routeStage === "string" ? ai.metadata.routeStage : null,
    heuristicStage: typeof ai.metadata?.heuristicStage === "string" ? ai.metadata.heuristicStage : null,
    domainStage:
      typeof ai.metadata?.domainStage === "string"
        ? ai.metadata.domainStage
        : typeof ai.metadata?.debugRequest?.domainStage === "string"
          ? ai.metadata.debugRequest.domainStage
          : null,
    inputTokens: ai.usage.inputTokens,
    outputTokens: ai.usage.outputTokens,
    estimatedCostUsd,
  });

  const leadNameForTitle =
    typeof nextContext.lead?.nome === "string" && nextContext.lead.nome.trim() ? nextContext.lead.nome.trim() : null;
  const whatsappContactNameForTitle = getWhatsAppContactNameFromContext(nextContext);
  const contactSnapshot = resolveChatContactSnapshot(nextContext, normalizedExternalIdentifier);

  const splitReply = channelKind === "whatsapp" ? null : splitCatalogReplyForWhatsApp(ai.reply, Array.isArray(ai.assets) && ai.assets.length > 0);
  const primaryReplyRaw = splitReply?.mainReply || ai.reply;
  const followUpReplyRaw = channelKind === "whatsapp" ? "" : splitReply?.followUpReply || "";
  const primaryReplyBase = stripAssistantMetaReply(primaryReplyRaw, channelKind);
  const followUpReplyBase = stripAssistantMetaReply(followUpReplyRaw, channelKind);
  const primaryReply =
    channelKind === "whatsapp" ? sanitizeWhatsAppCustomerFacingReply(primaryReplyBase) : primaryReplyBase;
  const followUpReply =
    channelKind === "whatsapp" ? sanitizeWhatsAppCustomerFacingReply(followUpReplyBase) : followUpReplyBase;
  const whatsappEmbeddedSequence =
    channelKind === "whatsapp" ? buildWhatsAppMessageSequence(primaryReply, ai.assets ?? [], null) : [];
  const whatsappEmbeddedMessage = whatsappEmbeddedSequence[0] ?? "";

  if (channelKind === "whatsapp" && Array.isArray(ai.assets) && ai.assets.length > 0) {
    const embeddableAssets = ai.assets.filter(
      (asset) =>
        asset &&
        typeof asset === "object" &&
        !Array.isArray(asset) &&
        (typeof (asset as { targetUrl?: string | null }).targetUrl === "string" ||
          typeof (asset as { descricao?: string | null }).descricao === "string" ||
          typeof (asset as { whatsappText?: string | null }).whatsappText === "string"),
    );

    await appendSystemLog({
      projetoId: chat.projetoId,
      tipo: embeddableAssets.length ? "whatsapp_catalog_delivery" : "whatsapp_catalog_delivery_warn",
      origem: "chat_service.whatsapp_delivery",
      descricao: embeddableAssets.length
        ? "Mensagem de WhatsApp consolidada com lista de produtos em uma unica resposta."
        : "WhatsApp recebeu assets, mas nenhum asset tinha dados suficientes para montar a lista na mensagem unica.",
      payload: {
        chatId: chat.id,
        assetCount: ai.assets.length,
        embeddableAssetCount: embeddableAssets.length,
        embeddedMessageLength: whatsappEmbeddedMessage.length,
        assetIds: ai.assets
          .map((asset) =>
            asset && typeof asset === "object" && !Array.isArray(asset) && typeof (asset as { id?: string | null }).id === "string"
              ? (asset as { id?: string | null }).id
              : null,
          )
          .filter(Boolean),
      },
      skipErrorGate: true,
    });
  }

  const assistantMessage = await appendMessage({
    chatId: chat.id,
    role: "assistant",
    conteudo: channelKind === "whatsapp" ? whatsappEmbeddedMessage || primaryReply : primaryReply,
    canal: channelKind,
    identificadorExterno: normalizedExternalIdentifier,
    tokensInput: ai.usage.inputTokens,
    tokensOutput: ai.usage.outputTokens,
    custo: estimatedCostUsd,
    metadata: {
      ...ai.metadata,
      usageTelemetry,
      assets: ai.assets ?? [],
    },
  });

  if (!assistantMessage) {
    throw new Error("O modelo respondeu, mas nao foi possivel salvar a resposta no banco.");
  }

  if (followUpReply && channelKind !== "whatsapp") {
    await appendMessage({
      chatId: chat.id,
      role: "assistant",
      conteudo: followUpReply,
      canal: channelKind,
      identificadorExterno: normalizedExternalIdentifier,
      metadata: {
        followUpReply: true,
      },
    });
  }

  const messageCount = Number(nextContext.memoria?.mensagem_count ?? 0);
  if (shouldRefreshSummary(messageCount)) {
    nextContext.memoria = {
      ...nextContext.memoria,
      resumo: await summarizeConversation(
        history.map((item) => ({
          role: item.role,
          content: item.conteudo,
        })),
        typeof nextContext.memoria?.resumo === "string" ? nextContext.memoria.resumo : null,
        nextContext.projeto?.id ?? null,
      ),
      ultimo_resumo_at: new Date().toISOString(),
    };
  }

  if (nextContext.lead?.identificado) {
    nextContext.qualificacao = {
      ...nextContext.qualificacao,
      pronto_para_whatsapp: true,
    };
  }

  await updateChatContext(chat.id, nextContext);
  await updateChatStats({
    chatId: chat.id,
    totalTokensToAdd: ai.usage.inputTokens + ai.usage.outputTokens,
    totalCustoToAdd: estimatedCostUsd,
    titulo: leadNameForTitle ?? whatsappContactNameForTitle ?? chat.titulo,
    contexto: nextContext,
    identificadorExterno: normalizedExternalIdentifier,
    contatoNome: contactSnapshot.contatoNome,
    contatoTelefone: contactSnapshot.contatoTelefone,
    contatoAvatarUrl: contactSnapshot.contatoAvatarUrl,
  });

  if (chat.projetoId) {
    await registrarUso(
      chat.projetoId,
      ai.usage.inputTokens + ai.usage.outputTokens,
      estimatedCostUsd,
      {
        tokensInput: ai.usage.inputTokens,
        tokensOutput: ai.usage.outputTokens,
        usuarioId: chat.usuarioId,
        origem: usageTelemetry.billingOrigin,
        referenciaId: assistantMessage.id,
      },
    );
  }

  await appendChatRequestLog({
    projetoId: nextContext.projeto?.id ?? null,
    descricao: `Chat ${chat.id} | ${ai.metadata?.provider ?? "unknown"} | ${ai.metadata?.model ?? "unknown"}`,
    payload: {
      chatId: chat.id,
      title: chat.titulo,
      provider: ai.metadata?.provider ?? null,
      model: ai.metadata?.model ?? null,
      channel: nextContext.channel ?? null,
      lead: nextContext.lead ?? null,
      summary: nextContext.memoria?.resumo ?? null,
      messageCount: nextContext.memoria?.mensagem_count ?? history.length,
      latestUserMessage: message,
      tokens: {
        input: ai.usage.inputTokens,
        output: ai.usage.outputTokens,
        total: ai.usage.inputTokens + ai.usage.outputTokens,
      },
      usageTelemetry,
      estimatedCostUsd,
      requestDebug:
        ai.metadata && typeof ai.metadata === "object" && "debugRequest" in ai.metadata
          ? (ai.metadata.debugRequest as Record<string, unknown>)
          : null,
      replyPreview: String(primaryReply ?? "").slice(0, 500),
    },
  });

  let whatsapp: {
    url: string | null;
    label: string;
    phone: string;
  } | null = null;

  if (channelKind !== "whatsapp" && nextContext.projeto?.id) {
    const preferredChannel = await getPreferredWhatsAppChannel({
      projetoId: String(nextContext.projeto.id),
      agenteId: nextContext.agente?.id ? String(nextContext.agente.id) : null,
    });
    const widgetContext = isPlainObject((nextContext as Record<string, unknown>).widget)
      ? ((nextContext as Record<string, unknown>).widget as Record<string, unknown>)
      : null;
    const fallbackWidgetPhone =
      typeof widgetContext?.whatsapp_celular === "string" && widgetContext.whatsapp_celular.trim()
        ? widgetContext.whatsapp_celular.trim()
        : null;
    const agentAtual = nextContext.agente?.id ? await getAgenteById(String(nextContext.agente.id)) : null;
    const configuredWhatsappCta =
      agentAtual?.configuracoes &&
      typeof agentAtual.configuracoes.cta_whatsapp === "string" &&
      agentAtual.configuracoes.cta_whatsapp.trim()
        ? agentAtual.configuracoes.cta_whatsapp.trim()
        : null;
    const hasWhatsappHandoff =
      Boolean(agentAtual?.configuracoes) &&
      typeof agentAtual?.configuracoes?.handoff === "object" &&
      agentAtual.configuracoes.handoff !== null;
    const whatsappPhone = preferredChannel?.numero || fallbackWidgetPhone;
    const hasWhatsappBias = Boolean(whatsappPhone) || Boolean(configuredWhatsappCta) || hasWhatsappHandoff;
    const isFocusedMercadoLivreConversation =
      ai.metadata?.model === "mercado_livre_product_sales" &&
      Boolean(ai.metadata && "catalogoProdutoAtual" in ai.metadata && ai.metadata.catalogoProdutoAtual);
    const contextCatalogProductName =
      nextContext.catalogo?.produtoAtual &&
      typeof nextContext.catalogo.produtoAtual === "object" &&
      "nome" in nextContext.catalogo.produtoAtual &&
      typeof nextContext.catalogo.produtoAtual.nome === "string"
        ? nextContext.catalogo.produtoAtual.nome
        : null;
    const metadataCatalogProductName =
      ai.metadata &&
      "catalogoProdutoAtual" in ai.metadata &&
      ai.metadata.catalogoProdutoAtual &&
      typeof ai.metadata.catalogoProdutoAtual === "object" &&
      "nome" in ai.metadata.catalogoProdutoAtual &&
      typeof ai.metadata.catalogoProdutoAtual.nome === "string"
        ? ai.metadata.catalogoProdutoAtual.nome
        : null;
    const shouldOfferCommercialCta =
      /whats\s?app/i.test(ai.reply) ||
      /estimativa|orcamento|orÃ§amento|proximo passo|pr[oÃ³]ximo passo|encaixe inicial|fecharmos/i.test(ai.reply);
    const shouldPreferWhatsappButton =
      hasWhatsappBias &&
      !isFocusedMercadoLivreConversation &&
      (Boolean(nextContext.qualificacao?.pronto_para_whatsapp) ||
        shouldOfferCommercialCta ||
        Number(nextContext.memoria?.mensagem_count ?? 0) >= 2);

    if (whatsappPhone && shouldPreferWhatsappButton) {
      whatsapp = {
        url: buildWhatsAppLink(
          whatsappPhone,
          buildContinuationMessage({
            projetoNome: nextContext.projeto?.nome ? String(nextContext.projeto.nome) : null,
            agenteNome: nextContext.agente?.nome ? String(nextContext.agente.nome) : null,
            resumo: typeof nextContext.memoria?.resumo === "string" ? nextContext.memoria.resumo : null,
            produtoAtual:
              metadataCatalogProductName
                ? String(metadataCatalogProductName)
                : contextCatalogProductName
                ? String(contextCatalogProductName)
                : null,
            ultimaMensagem: message,
          }),
        ),
        label: "Continuar no WhatsApp",
        phone: whatsappPhone,
      };
    }
  }

  if (channelKind === "whatsapp" && body.whatsappChannelId) {
    await updateWhatsAppChannelSession(body.whatsappChannelId, {
      connectionStatus: "online",
      lastInboundAt: new Date().toISOString(),
      lastOutboundAt: new Date().toISOString(),
    });
  }

  return {
    chatId: chat.id,
    reply: assistantMessage.conteudo ?? (channelKind === "whatsapp" ? whatsappEmbeddedMessage || primaryReply : primaryReply),
    followUpReply: channelKind === "whatsapp" ? "" : followUpReply,
    messageSequence: channelKind === "whatsapp" ? whatsappEmbeddedSequence : [],
    assets: channelKind === "whatsapp" ? [] : ai.assets ?? [],
    whatsapp,
  };
}

