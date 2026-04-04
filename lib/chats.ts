import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteChatAttachmentsByStoragePaths } from "@/lib/chat-attachments";

export type ChatMessageRole = "user" | "assistant" | "system";
export type ChatChannelKind = "web" | "whatsapp" | string;

export type ChatRecord = {
  id: string;
  titulo: string;
  contatoNome: string | null;
  contatoTelefone: string | null;
  contatoAvatarUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  totalTokens: number;
  totalCusto: number;
  agenteId: string | null;
  usuarioId: string | null;
  projetoId: string | null;
  canal: ChatChannelKind;
  identificadorExterno: string | null;
  contexto: Record<string, unknown> | null;
  ultimaMensagem: string | null;
  totalMensagens: number;
};

export type ChatMessageRecord = {
  id: string;
  chatId: string;
  role: ChatMessageRole;
  conteudo: string;
  canal: ChatChannelKind;
  identificadorExterno: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  custo: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type ChatRow = {
  id: string;
  titulo: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_avatar_url: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  total_tokens: number | null;
  total_custo: number | null;
  agente_id: string | null;
  usuario_id: string | null;
  projeto_id: string | null;
  canal: string | null;
  identificador_externo: string | null;
  contexto: Record<string, unknown> | null;
};

type ChatContext = {
  origem?: string;
  lead?: {
    nome?: string | null;
    telefone?: string | null;
    email?: string | null;
    identificado?: boolean;
  };
  memoria?: {
    resumo?: string | null;
    mensagem_count?: number;
    ultimo_resumo_at?: string | null;
  };
  qualificacao?: {
    segmento?: string | null;
    dor_principal?: string | null;
    objetivo?: string | null;
    pronto_para_whatsapp?: boolean;
  };
};

type ChatContactSnapshot = {
  contatoNome: string | null;
  contatoTelefone: string | null;
  contatoAvatarUrl: string | null;
};

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized : null;
}

function normalizeWhatsAppLookupPhone(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  let normalized = digits;
  while (normalized.startsWith("55") && normalized.length > 11) {
    normalized = normalized.slice(2);
  }

  if (normalized.length < 10) {
    return null;
  }

  if (normalized.length > 11) {
    normalized = normalized.slice(-11);
  }

  return normalized;
}

function extractChatContactSnapshot(
  contexto: Record<string, unknown> | null | undefined,
  fallbackExternalIdentifier?: string | null,
): ChatContactSnapshot {
  const lead =
    contexto && typeof contexto.lead === "object" && contexto.lead !== null && !Array.isArray(contexto.lead)
      ? (contexto.lead as { nome?: string | null; telefone?: string | null })
      : null;
  const whatsapp =
    contexto && typeof contexto.whatsapp === "object" && contexto.whatsapp !== null && !Array.isArray(contexto.whatsapp)
      ? (contexto.whatsapp as {
          contactName?: string | null;
          remotePhone?: string | null;
          remetente?: string | null;
          profilePicUrl?: string | null;
          rawContact?: {
            profilePicUrl?: string | null;
          } | null;
        })
      : null;

  return {
    contatoNome: normalizeOptionalText(lead?.nome) ?? normalizeOptionalText(whatsapp?.contactName),
    contatoTelefone:
      normalizeOptionalText(lead?.telefone) ??
      normalizeOptionalText(whatsapp?.remotePhone) ??
      normalizeOptionalText(whatsapp?.remetente) ??
      normalizeOptionalText(fallbackExternalIdentifier),
    contatoAvatarUrl:
      normalizeOptionalText(whatsapp?.profilePicUrl) ??
      normalizeOptionalText(whatsapp?.rawContact?.profilePicUrl),
  };
}

type MensagemRow = {
  id: string;
  chat_id: string | null;
  role: string;
  conteudo: string;
  canal: string | null;
  identificador_externo: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  custo: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

function mapChat(row: ChatRow): ChatRecord {
  return {
    id: row.id,
    titulo: row.titulo?.trim() || "Nova conversa",
    contatoNome: normalizeOptionalText(row.contato_nome),
    contatoTelefone: normalizeOptionalText(row.contato_telefone),
    contatoAvatarUrl: normalizeOptionalText(row.contato_avatar_url),
    status: row.status ?? "ativo",
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    totalTokens: row.total_tokens ?? 0,
    totalCusto: Number(row.total_custo ?? 0),
    agenteId: row.agente_id,
    usuarioId: row.usuario_id,
    projetoId: row.projeto_id,
    canal: (row.canal?.trim() || "web") as ChatChannelKind,
    identificadorExterno: row.identificador_externo?.trim() || null,
    contexto: row.contexto,
    ultimaMensagem: null,
    totalMensagens: 0,
  };
}

function mapMensagem(row: MensagemRow): ChatMessageRecord {
  return {
    id: row.id,
    chatId: row.chat_id ?? "",
    role: row.role === "assistant" ? "assistant" : row.role === "system" ? "system" : "user",
    conteudo: row.conteudo,
    canal: (row.canal?.trim() || "web") as ChatChannelKind,
    identificadorExterno: row.identificador_externo?.trim() || null,
    tokensInput: row.tokens_input,
    tokensOutput: row.tokens_output,
    custo: row.custo,
    metadata: row.metadata,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export async function createChat(input: {
  titulo?: string;
  usuarioId?: string | null;
  projetoId?: string | null;
  agenteId?: string | null;
  canal?: ChatChannelKind;
  identificadorExterno?: string | null;
  contexto?: Record<string, unknown> | null;
  contatoNome?: string | null;
  contatoTelefone?: string | null;
  contatoAvatarUrl?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const contactSnapshot = extractChatContactSnapshot(input.contexto, input.identificadorExterno);
  const { data, error } = await supabase
    .from("chats")
    .insert({
      titulo: input.titulo?.trim() || "Nova conversa",
      contato_nome: normalizeOptionalText(input.contatoNome) ?? contactSnapshot.contatoNome,
      contato_telefone: normalizeOptionalText(input.contatoTelefone) ?? contactSnapshot.contatoTelefone,
      contato_avatar_url: normalizeOptionalText(input.contatoAvatarUrl) ?? contactSnapshot.contatoAvatarUrl,
      usuario_id: input.usuarioId ?? null,
      projeto_id: input.projetoId ?? null,
      agente_id: input.agenteId ?? null,
      canal: input.canal ?? "web",
      identificador_externo: input.identificadorExterno?.trim() || null,
      contexto: input.contexto ?? null,
      status: "ativo",
      total_tokens: 0,
      total_custo: 0,
      created_at: now,
      updated_at: now,
    } as never)
    .select("id, titulo, contato_nome, contato_telefone, contato_avatar_url, status, created_at, updated_at, total_tokens, total_custo, agente_id, usuario_id, projeto_id, canal, identificador_externo, contexto")
    .single();

  if (error || !data) {
    console.error("[chats] failed to create chat", error);
    return null;
  }

  return mapChat(data as ChatRow);
}

export function getChatContext(chat: ChatRecord | null) {
  return (chat?.contexto ?? {}) as ChatContext;
}

export async function appendMessage(input: {
  chatId: string;
  role: ChatMessageRole;
  conteudo: string;
  canal?: ChatChannelKind | null;
  identificadorExterno?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  custo?: number | null;
  metadata?: Record<string, unknown> | null;
}) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("mensagens")
    .insert({
      chat_id: input.chatId,
      role: input.role,
      conteudo: input.conteudo,
      canal: input.canal ?? "web",
      identificador_externo: input.identificadorExterno?.trim() || null,
      tokens_input: input.tokensInput ?? null,
      tokens_output: input.tokensOutput ?? null,
      custo: input.custo ?? null,
      metadata: input.metadata ?? null,
      created_at: now,
    } as never)
    .select("id, chat_id, role, conteudo, canal, identificador_externo, tokens_input, tokens_output, custo, metadata, created_at")
    .single();

  if (error || !data) {
    console.error("[chats] failed to append message", error);
    return null;
  }

  return mapMensagem(data as MensagemRow);
}

export async function updateChatStats(input: {
  chatId: string;
  totalTokensToAdd?: number;
  totalCustoToAdd?: number;
  titulo?: string;
  contexto?: Record<string, unknown> | null;
  identificadorExterno?: string | null;
  contatoNome?: string | null;
  contatoTelefone?: string | null;
  contatoAvatarUrl?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { data: current, error: currentError } = await supabase
    .from("chats")
    .select("id, titulo, identificador_externo, contato_nome, contato_telefone, contato_avatar_url, total_tokens, total_custo")
    .eq("id", input.chatId)
    .single<{
      id: string;
      titulo: string | null;
      identificador_externo: string | null;
      contato_nome: string | null;
      contato_telefone: string | null;
      contato_avatar_url: string | null;
      total_tokens: number | null;
      total_custo: number | null;
    }>();

  if (currentError || !current) {
    console.error("[chats] failed to read current chat stats", currentError);
    return;
  }

  const contactSnapshot = extractChatContactSnapshot(
    input.contexto,
    input.identificadorExterno ?? current.identificador_externo,
  );
  const { error } = await supabase
    .from("chats")
    .update({
      titulo: input.titulo?.trim() || current.titulo,
      contato_nome:
        normalizeOptionalText(input.contatoNome) ??
        contactSnapshot.contatoNome ??
        normalizeOptionalText(current.contato_nome),
      contato_telefone:
        normalizeOptionalText(input.contatoTelefone) ??
        contactSnapshot.contatoTelefone ??
        normalizeOptionalText(current.contato_telefone),
      contato_avatar_url:
        normalizeOptionalText(input.contatoAvatarUrl) ??
        contactSnapshot.contatoAvatarUrl ??
        normalizeOptionalText(current.contato_avatar_url),
      total_tokens: (current.total_tokens ?? 0) + (input.totalTokensToAdd ?? 0),
      total_custo: Number(current.total_custo ?? 0) + Number(input.totalCustoToAdd ?? 0),
      contexto: input.contexto ?? undefined,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.chatId);

  if (error) {
    console.error("[chats] failed to update chat stats", error);
  }
}

export async function updateChatContext(chatId: string, contexto: Record<string, unknown>) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("chats")
    .update({
      contexto,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", chatId);

  if (error) {
    console.error("[chats] failed to update chat context", error);
  }
}

export async function touchChatUpdatedAt(chatId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("chats")
    .update({
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", chatId);

  if (error) {
    console.error("[chats] failed to touch chat updated_at", error);
  }
}

export async function getChatById(chatId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chats")
    .select("id, titulo, contato_nome, contato_telefone, contato_avatar_url, status, created_at, updated_at, total_tokens, total_custo, agente_id, usuario_id, projeto_id, canal, identificador_externo, contexto")
    .eq("id", chatId)
    .maybeSingle();

  if (error || !data) {
    console.error("[chats] failed to load chat", error);
    return null;
  }

  return mapChat(data as ChatRow);
}

export async function findActiveChatByChannel(input: {
  projetoId?: string | null;
  agenteId?: string | null;
  canal: ChatChannelKind;
  identificadorExterno: string;
  channelScopeId?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("chats")
    .select("id, titulo, contato_nome, contato_telefone, contato_avatar_url, status, created_at, updated_at, total_tokens, total_custo, agente_id, usuario_id, projeto_id, canal, identificador_externo, contexto")
    .eq("canal", input.canal)
    .eq("identificador_externo", input.identificadorExterno.trim())
    .eq("status", "ativo")
    .order("updated_at", { ascending: false })
    .limit(input.channelScopeId ? 20 : 1);

  if (input.projetoId) {
    query = query.eq("projeto_id", input.projetoId);
  }

  if (input.agenteId) {
    query = query.eq("agente_id", input.agenteId);
  }

  if (!input.channelScopeId) {
    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      if (error) {
        console.error("[chats] failed to find active chat by channel", error);
      }
      return null;
    }

    return mapChat(data as ChatRow);
  }

  const { data, error } = await query;

  if (error || !data) {
    if (error) {
      console.error("[chats] failed to find active chat candidates by channel", error);
    }
    return null;
  }

  const match = data.find((row) => {
    const mapped = mapChat(row as ChatRow);
    const whatsapp = (mapped.contexto?.whatsapp ?? null) as Record<string, unknown> | null;
    return typeof whatsapp?.channelId === "string" && whatsapp.channelId === input.channelScopeId;
  });

  return match ? mapChat(match as ChatRow) : null;
}

export async function findActiveWhatsAppChatByPhone(input: {
  projetoId?: string | null;
  agenteId?: string | null;
  phone: string;
  channelScopeId?: string | null;
}) {
  const normalizedPhone = normalizeWhatsAppLookupPhone(input.phone);
  if (!normalizedPhone) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("chats")
    .select("id, titulo, contato_nome, contato_telefone, contato_avatar_url, status, created_at, updated_at, total_tokens, total_custo, agente_id, usuario_id, projeto_id, canal, identificador_externo, contexto")
    .eq("canal", "whatsapp")
    .eq("status", "ativo")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (input.projetoId) {
    query = query.eq("projeto_id", input.projetoId);
  }

  if (input.agenteId) {
    query = query.eq("agente_id", input.agenteId);
  }

  const { data, error } = await query;
  if (error || !data) {
    if (error) {
      console.error("[chats] failed to find active whatsapp chats by phone", error);
    }
    return null;
  }

  const match = data.find((row) => {
    const mapped = mapChat(row as ChatRow);
    const whatsapp = (mapped.contexto?.whatsapp ?? null) as Record<string, unknown> | null;
    const channelMatches =
      !input.channelScopeId || (typeof whatsapp?.channelId === "string" && whatsapp.channelId === input.channelScopeId);

    if (!channelMatches) {
      return false;
    }

    const contactSnapshot = extractChatContactSnapshot(mapped.contexto, mapped.identificadorExterno);
    const candidates = [
      mapped.contatoTelefone,
      mapped.identificadorExterno,
      contactSnapshot.contatoTelefone,
      typeof whatsapp?.remotePhone === "string" ? whatsapp.remotePhone : null,
      typeof whatsapp?.remetente === "string" ? whatsapp.remetente : null,
    ];

    return candidates.some((candidate) => normalizeWhatsAppLookupPhone(candidate) === normalizedPhone);
  });

  return match ? mapChat(match as ChatRow) : null;
}

export async function listChats(projetoId?: string | null) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("chats")
    .select("id, titulo, contato_nome, contato_telefone, contato_avatar_url, status, created_at, updated_at, total_tokens, total_custo, agente_id, usuario_id, projeto_id, canal, identificador_externo, contexto")
    .order("updated_at", { ascending: false });

  if (projetoId) {
    query = query.eq("projeto_id", projetoId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("[chats] failed to list chats", error);
    return [];
  }

  const chats = data.map((row) => mapChat(row as ChatRow));
  const chatIds = chats.map((chat) => chat.id);

  if (!chatIds.length) {
    return chats;
  }

  const { data: messagesData, error: messagesError } = await supabase
    .from("mensagens")
    .select("chat_id, role, conteudo, created_at")
    .in("chat_id", chatIds)
    .neq("role", "system")
    .order("created_at", { ascending: false });

  if (messagesError || !messagesData) {
    if (messagesError) {
      console.error("[chats] failed to load latest chat messages", messagesError);
    }
    return chats;
  }

  const latestMessageByChatId = new Map<string, string>();
  const messageCountByChatId = new Map<string, number>();

  for (const row of messagesData as Array<{ chat_id: string | null; conteudo: string | null }>) {
    const chatId = row.chat_id ?? "";
    if (!chatId) {
      continue;
    }

    messageCountByChatId.set(chatId, (messageCountByChatId.get(chatId) ?? 0) + 1);

    if (latestMessageByChatId.has(chatId)) {
      continue;
    }

    const content = row.conteudo?.trim() || "";
    if (!content) {
      continue;
    }

    latestMessageByChatId.set(chatId, content);
  }

  return chats.map((chat) => ({
    ...chat,
    ultimaMensagem: latestMessageByChatId.get(chat.id) ?? null,
    totalMensagens: messageCountByChatId.get(chat.id) ?? 0,
  }));
}

export async function listChatMessages(chatId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("mensagens")
    .select("id, chat_id, role, conteudo, canal, identificador_externo, tokens_input, tokens_output, custo, metadata, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("[chats] failed to list messages", error);
    return [];
  }

  return data.map((row) => mapMensagem(row as MensagemRow));
}

function extractAttachmentStoragePaths(metadata: Record<string, unknown> | null | undefined) {
  const attachments =
    metadata && Array.isArray(metadata.attachments)
      ? metadata.attachments
      : [];

  return attachments
    .map((attachment) => {
      if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
        return "";
      }

      const storagePath = "storagePath" in attachment ? String((attachment as { storagePath?: string | null }).storagePath || "").trim() : "";
      return storagePath;
    })
    .filter(Boolean);
}

export async function deleteChatConversation(chatId: string) {
  const supabase = getSupabaseAdminClient();
  const chat = await getChatById(chatId);

  if (!chat) {
    return { ok: false, error: "Conversa nao encontrada." };
  }

  const { data: messagesData, error: messagesReadError } = await supabase
    .from("mensagens")
    .select("id, metadata")
    .eq("chat_id", chatId);

  if (messagesReadError) {
    console.error("[chats] failed to read chat messages before delete", messagesReadError);
    return { ok: false, error: "Nao foi possivel carregar as mensagens da conversa." };
  }

  const storagePaths = ((messagesData ?? []) as Array<{ metadata?: Record<string, unknown> | null }>)
    .flatMap((message) => extractAttachmentStoragePaths(message.metadata))
    .filter(Boolean);

  if (storagePaths.length) {
    await deleteChatAttachmentsByStoragePaths(storagePaths);
  }

  const { error: handoffEventsError } = await supabase.from("chat_handoff_eventos").delete().eq("chat_id", chatId);
  if (handoffEventsError) {
    console.error("[chats] failed to delete chat handoff events", handoffEventsError);
    return { ok: false, error: "Nao foi possivel limpar os eventos de atendimento humano." };
  }

  const { error: handoffError } = await supabase.from("chat_handoffs").delete().eq("chat_id", chatId);
  if (handoffError) {
    console.error("[chats] failed to delete chat handoff", handoffError);
    return { ok: false, error: "Nao foi possivel limpar o estado de atendimento humano." };
  }

  const { error: messagesDeleteError } = await supabase.from("mensagens").delete().eq("chat_id", chatId);
  if (messagesDeleteError) {
    console.error("[chats] failed to delete chat messages", messagesDeleteError);
    return { ok: false, error: "Nao foi possivel remover as mensagens da conversa." };
  }

  const { error: chatDeleteError } = await supabase.from("chats").delete().eq("id", chatId);
  if (chatDeleteError) {
    console.error("[chats] failed to delete chat", chatDeleteError);
    return { ok: false, error: "Nao foi possivel remover a conversa." };
  }

  return { ok: true };
}
