import "server-only";

import type { CatalogProductReference, ConversationContext } from "@/lib/chat-context";
import { extractName as extractNameFromModule, extractPhone as extractPhoneFromModule } from "@/lib/chat-contact-utils";
import type { ChatMessageRole } from "@/lib/chats";

type ConversationMessage = {
  role: ChatMessageRole;
  content: string;
};

type LeadContextShape = {
  origem?: string;
  agente?: { id?: string | null; nome?: string | null; locked?: boolean };
  lead?: { nome?: string | null; telefone?: string | null; email?: string | null; identificado?: boolean };
  memoria?: { resumo?: string | null; mensagem_count?: number; ultimo_resumo_at?: string | null };
  qualificacao?: {
    segmento?: string | null;
    dor_principal?: string | null;
    objetivo?: string | null;
    pronto_para_whatsapp?: boolean;
  };
  catalogo?: {
    ultimaBusca?: string | null;
    produtoAtual?: CatalogProductReference | null;
    ultimosProdutos?: Array<{
      id?: string | null;
      nome?: string | null;
      descricao?: string | null;
      preco?: number | null;
      link?: string | null;
      imagem?: string | null;
      cardIndex?: number | null;
    }>;
    snapshotId?: string | null;
    snapshotCreatedAt?: string | null;
    snapshotTurnId?: number | null;
  };
};

const NON_PERSON_LEAD_REPLY_PATTERNS = [
  /\bautomac(?:ao|a)o\b/,
  /\bimoveis?\b/,
  /\bleil(?:ao|oes)\b/,
  /\bwhatsapp\b/,
  /\bcrm\b/,
  /\berp\b/,
  /\bintegrac(?:ao|a)o\b/,
  /\bsite\b/,
  /\bchat\b/,
  /\bia\b/,
  /\bproduto\b/,
  /\bprodutos\b/,
  /\batendimento\b/,
  /\bvendas?\b/,
  /\bagenda\b/,
  /\bmarketing\b/,
  /\bfinanceir[oa]\b/,
];

export function didAssistantRecentlyAskForLeadName(history: ConversationMessage[], normalizeText: (value: string) => string) {
  const previousAssistantMessage = [...history].reverse().find((item) => item.role === "assistant")?.content ?? "";
  const normalized = normalizeText(previousAssistantMessage);

  return (
    normalized.includes("como posso te chamar") ||
    normalized.includes("qual e o seu nome") ||
    normalized.includes("qual e seu nome") ||
    normalized.includes("me diga seu nome") ||
    normalized.includes("qual seu nome") ||
    normalized.includes("primeiro nome") ||
    (normalized.includes("nome") && /\b(qual|diga|informe|passa)\b/.test(normalized))
  );
}

export function isLikelyLeadNameReply(
  message: string,
  history: ConversationMessage[],
  deps: {
    normalizeText: (value: string) => string;
    extractName: (message: string) => string | null;
  },
) {
  if (!didAssistantRecentlyAskForLeadName(history, deps.normalizeText)) {
    return false;
  }

  const extractedName = deps.extractName(message);
  if (!extractedName) {
    return false;
  }

  const normalized = deps.normalizeText(message);
  if (/\b(produto|produtos|modelo|marca|cor|tamanho|sku|loja|mercado livre|ml|catalogo)\b/.test(normalized)) {
    return false;
  }

  if (NON_PERSON_LEAD_REPLY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 3;
}

export function buildLeadNameAcknowledgementReply(
  name: string,
  hasMercadoLivreConnector: boolean,
  context: ConversationContext | undefined,
  isWhatsAppChannel: (context?: ConversationContext) => boolean,
) {
  const safeName = name.trim();
  if (hasMercadoLivreConnector) {
    return isWhatsAppChannel(context)
      ? `Prazer, ${safeName}.\n\nMe diga agora qual produto, modelo, marca, cor ou SKU voce quer buscar na loja.`
      : `Prazer, **${safeName}**.\n\nMe diga agora qual produto, modelo, marca, cor ou SKU voce quer buscar na loja.`;
  }

  return isWhatsAppChannel(context)
    ? `Prazer, ${safeName}.\n\nPode me dizer o que voce quer validar?`
    : `Prazer, **${safeName}**.\n\nPode me dizer o que voce quer validar?`;
}

export function extractPhone(message: string) {
  return extractPhoneFromModule(message);
}

export function extractName(message: string, normalizeText: (value: string) => string) {
  return extractNameFromModule(message, normalizeText);
}

export function enrichLeadContext(
  currentContext: Record<string, unknown> | null,
  history: ConversationMessage[],
  latestUserMessage: string,
  deps: {
    normalizeText: (value: string) => string;
  },
) {
  const context = (currentContext ?? {}) as LeadContextShape;
  const phone = extractPhone(latestUserMessage);
  const name = extractName(latestUserMessage, deps.normalizeText);
  const whatsappContext =
    currentContext && typeof currentContext.whatsapp === "object" && currentContext.whatsapp !== null
      ? (currentContext.whatsapp as { remetente?: string | null; contactName?: string | null })
      : null;
  const channelContext =
    currentContext && typeof currentContext.channel === "object" && currentContext.channel !== null
      ? (currentContext.channel as { kind?: string | null; external_id?: string | null })
      : null;
  const whatsappPhone =
    (typeof whatsappContext?.remetente === "string" ? whatsappContext.remetente : null) ||
    (typeof channelContext?.external_id === "string" ? channelContext.external_id : null);
  const normalizedWhatsappPhone = whatsappPhone ? whatsappPhone.replace(/\D/g, "") : null;
  const isWhatsAppConversation = (channelContext?.kind ?? "").trim().toLowerCase() === "whatsapp";
  const nextCount = history.filter((item) => item.role !== "system").length;
  const resolvedPhone = phone ?? context.lead?.telefone ?? normalizedWhatsappPhone ?? null;
  const resolvedName =
    name ??
    context.lead?.nome ??
    (typeof whatsappContext?.contactName === "string" && whatsappContext.contactName.trim() ? whatsappContext.contactName.trim() : null) ??
    null;

  const nextContext = {
    origem: context.origem ?? "site",
    projeto: {
      id: (currentContext as { projeto?: { id?: string | null } } | null)?.projeto?.id ?? null,
      slug: (currentContext as { projeto?: { slug?: string | null } } | null)?.projeto?.slug ?? null,
      nome: (currentContext as { projeto?: { nome?: string | null } } | null)?.projeto?.nome ?? null,
    },
    agente: {
      id: context.agente?.id ?? null,
      nome: context.agente?.nome ?? null,
      locked: context.agente?.locked ?? false,
    },
    lead: {
      nome: resolvedName,
      telefone: resolvedPhone,
      email: context.lead?.email ?? null,
      identificado: isWhatsAppConversation ? Boolean(resolvedPhone) : Boolean(resolvedPhone && resolvedName),
    },
    memoria: {
      resumo: context.memoria?.resumo ?? null,
      mensagem_count: nextCount,
      ultimo_resumo_at: context.memoria?.ultimo_resumo_at ?? null,
    },
    qualificacao: {
      segmento: context.qualificacao?.segmento ?? null,
      dor_principal: context.qualificacao?.dor_principal ?? null,
      objetivo: context.qualificacao?.objetivo ?? null,
      pronto_para_whatsapp: context.qualificacao?.pronto_para_whatsapp ?? false,
    },
    catalogo: {
      ultimaBusca: context.catalogo?.ultimaBusca ?? null,
      produtoAtual: context.catalogo?.produtoAtual ?? null,
      ultimosProdutos: Array.isArray(context.catalogo?.ultimosProdutos) ? context.catalogo?.ultimosProdutos ?? [] : [],
      snapshotId: context.catalogo?.snapshotId ?? null,
      snapshotCreatedAt: context.catalogo?.snapshotCreatedAt ?? null,
      snapshotTurnId: context.catalogo?.snapshotTurnId ?? null,
    },
    channel: {
      kind: channelContext?.kind ?? null,
      external_id: channelContext?.external_id ?? null,
    },
    whatsapp: {
      remetente: whatsappContext?.remetente ?? null,
      contactName: whatsappContext?.contactName ?? null,
    },
  };

  const normalized = deps.normalizeText(latestUserMessage);

  if (!nextContext.qualificacao.objetivo) {
    if (normalized.includes("whatsapp")) nextContext.qualificacao.objetivo = "automatizar atendimento no WhatsApp";
    else if (normalized.includes("crm")) nextContext.qualificacao.objetivo = "integrar CRM";
    else if (normalized.includes("agenda") || normalized.includes("agendamento")) nextContext.qualificacao.objetivo = "automatizar agenda";
    else if (normalized.includes("venda") || normalized.includes("comercial") || normalized.includes("lead")) nextContext.qualificacao.objetivo = "melhorar operacao comercial";
    else if (normalized.includes("site") || normalized.includes("chat")) nextContext.qualificacao.objetivo = "implantar agente no site";
  }

  return nextContext;
}


