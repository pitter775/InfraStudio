import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type ChatHandoffStatus = "bot" | "pending_human" | "human";
export type ChatHandoffActor = "system" | "agent" | "human";
export type ChatHandoffEventType = "requested" | "alert_sent" | "claimed" | "released" | "paused" | "resumed" | "note";

export type ChatHandoffRecord = {
  id: string;
  chatId: string;
  projetoId: string;
  canalWhatsappId: string | null;
  status: ChatHandoffStatus;
  motivo: string | null;
  requestedBy: ChatHandoffActor;
  requestedByUsuarioId: string | null;
  claimedByUsuarioId: string | null;
  releasedByUsuarioId: string | null;
  requestedAt: string;
  claimedAt: string | null;
  releasedAt: string | null;
  lastAlertAt: string | null;
  alertMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type ChatHandoffRow = {
  id: string;
  chat_id: string;
  projeto_id: string;
  canal_whatsapp_id: string | null;
  status: ChatHandoffStatus;
  motivo: string | null;
  requested_by: ChatHandoffActor;
  requested_by_usuario_id: string | null;
  claimed_by_usuario_id: string | null;
  released_by_usuario_id: string | null;
  requested_at: string | null;
  claimed_at: string | null;
  released_at: string | null;
  last_alert_at: string | null;
  alert_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

function mapChatHandoff(row: ChatHandoffRow): ChatHandoffRecord {
  return {
    id: row.id,
    chatId: row.chat_id,
    projetoId: row.projeto_id,
    canalWhatsappId: row.canal_whatsapp_id,
    status: row.status,
    motivo: row.motivo?.trim() || null,
    requestedBy: row.requested_by,
    requestedByUsuarioId: row.requested_by_usuario_id,
    claimedByUsuarioId: row.claimed_by_usuario_id,
    releasedByUsuarioId: row.released_by_usuario_id,
    requestedAt: row.requested_at ?? new Date().toISOString(),
    claimedAt: row.claimed_at,
    releasedAt: row.released_at,
    lastAlertAt: row.last_alert_at,
    alertMessage: row.alert_message?.trim() || null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export function shouldPauseAssistantForHandoff(handoff: ChatHandoffRecord | null | undefined) {
  return handoff?.status === "human";
}

export async function getChatHandoffByChatId(chatId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_handoffs")
    .select("*")
    .eq("chat_id", chatId)
    .maybeSingle<ChatHandoffRow>();

  if (error) {
    console.error("[chat-handoffs] failed to load handoff by chat", error);
    return null;
  }

  return data ? mapChatHandoff(data) : null;
}

export async function listChatHandoffsByChatIds(chatIds: string[]) {
  if (!chatIds.length) {
    return new Map<string, ChatHandoffRecord>();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("chat_handoffs").select("*").in("chat_id", chatIds);

  if (error || !data) {
    if (error) {
      console.error("[chat-handoffs] failed to list handoffs", error);
    }
    return new Map<string, ChatHandoffRecord>();
  }

  return new Map((data as ChatHandoffRow[]).map((row) => {
    const mapped = mapChatHandoff(row);
    return [mapped.chatId, mapped] as const;
  }));
}

export async function ensureChatHandoff(input: {
  chatId: string;
  projetoId: string;
  canalWhatsappId?: string | null;
}) {
  const existing = await getChatHandoffByChatId(input.chatId);
  if (existing) {
    return existing;
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("chat_handoffs")
    .insert({
      chat_id: input.chatId,
      projeto_id: input.projetoId,
      canal_whatsapp_id: input.canalWhatsappId ?? null,
      status: "bot",
      requested_by: "system",
      requested_at: now,
      metadata: {},
      created_at: now,
      updated_at: now,
    } as never)
    .select("*")
    .single<ChatHandoffRow>();

  if (error || !data) {
    console.error("[chat-handoffs] failed to ensure handoff", error);
    return existing;
  }

  return mapChatHandoff(data);
}

export async function appendChatHandoffEvent(input: {
  handoffId: string;
  chatId: string;
  projetoId: string;
  tipo: ChatHandoffEventType;
  descricao?: string | null;
  usuarioId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("chat_handoff_eventos").insert({
    handoff_id: input.handoffId,
    chat_id: input.chatId,
    projeto_id: input.projetoId,
    tipo: input.tipo,
    descricao: input.descricao?.trim() || null,
    usuario_id: input.usuarioId ?? null,
    metadata: input.metadata ?? {},
    created_at: new Date().toISOString(),
  } as never);

  if (error) {
    console.error("[chat-handoffs] failed to append event", error);
  }
}

async function updateChatHandoffRecord(input: {
  handoffId: string;
  patch: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_handoffs")
    .update({
      ...input.patch,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.handoffId)
    .select("*")
    .single<ChatHandoffRow>();

  if (error || !data) {
    console.error("[chat-handoffs] failed to update handoff", error);
    return null;
  }

  return mapChatHandoff(data);
}

export async function requestHumanHandoff(input: {
  chatId: string;
  projetoId: string;
  canalWhatsappId?: string | null;
  motivo?: string | null;
  requestedBy?: ChatHandoffActor;
  requestedByUsuarioId?: string | null;
  metadata?: Record<string, unknown> | null;
  alertMessage?: string | null;
}) {
  const current =
    (await ensureChatHandoff({
      chatId: input.chatId,
      projetoId: input.projetoId,
      canalWhatsappId: input.canalWhatsappId ?? null,
    })) ?? (await getChatHandoffByChatId(input.chatId));

  if (!current) {
    return null;
  }

  const next = await updateChatHandoffRecord({
    handoffId: current.id,
    patch: {
      projeto_id: input.projetoId,
      canal_whatsapp_id: input.canalWhatsappId ?? current.canalWhatsappId ?? null,
      status: current.status === "human" ? "human" : "pending_human",
      motivo: input.motivo?.trim() || current.motivo || null,
      requested_by: input.requestedBy ?? "agent",
      requested_by_usuario_id: input.requestedByUsuarioId ?? null,
      requested_at: new Date().toISOString(),
      last_alert_at: new Date().toISOString(),
      alert_message: input.alertMessage?.trim() || current.alertMessage || null,
      metadata: {
        ...(current.metadata ?? {}),
        ...(input.metadata ?? {}),
      },
    },
  });

  if (!next) {
    return current;
  }

  await appendChatHandoffEvent({
    handoffId: next.id,
    chatId: next.chatId,
    projetoId: next.projetoId,
    tipo: "requested",
    descricao: input.motivo?.trim() || "Cliente pediu atendimento humano.",
    usuarioId: input.requestedByUsuarioId ?? null,
    metadata: input.metadata ?? {},
  });

  return next;
}

export async function claimHumanHandoff(input: {
  chatId: string;
  projetoId: string;
  usuarioId: string;
  canalWhatsappId?: string | null;
  motivo?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const current =
    (await ensureChatHandoff({
      chatId: input.chatId,
      projetoId: input.projetoId,
      canalWhatsappId: input.canalWhatsappId ?? null,
    })) ?? (await getChatHandoffByChatId(input.chatId));

  if (!current) {
    return null;
  }

  const next = await updateChatHandoffRecord({
    handoffId: current.id,
    patch: {
      projeto_id: input.projetoId,
      canal_whatsapp_id: input.canalWhatsappId ?? current.canalWhatsappId ?? null,
      status: "human",
      claimed_by_usuario_id: input.usuarioId,
      claimed_at: new Date().toISOString(),
      motivo: input.motivo?.trim() || current.motivo || null,
      metadata: {
        ...(current.metadata ?? {}),
        ...(input.metadata ?? {}),
      },
    },
  });

  if (!next) {
    return current;
  }

  await appendChatHandoffEvent({
    handoffId: next.id,
    chatId: next.chatId,
    projetoId: next.projetoId,
    tipo: "claimed",
    descricao: input.motivo?.trim() || "Atendimento assumido por humano.",
    usuarioId: input.usuarioId,
    metadata: input.metadata ?? {},
  });

  return next;
}

export async function releaseHumanHandoff(input: {
  chatId: string;
  projetoId: string;
  usuarioId?: string | null;
  motivo?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const current = await getChatHandoffByChatId(input.chatId);
  if (!current) {
    return await ensureChatHandoff({
      chatId: input.chatId,
      projetoId: input.projetoId,
    });
  }

  const next = await updateChatHandoffRecord({
    handoffId: current.id,
    patch: {
      status: "bot",
      released_by_usuario_id: input.usuarioId ?? null,
      released_at: new Date().toISOString(),
      motivo: input.motivo?.trim() || null,
      metadata: {
        ...(current.metadata ?? {}),
        ...(input.metadata ?? {}),
      },
    },
  });

  if (!next) {
    return current;
  }

  await appendChatHandoffEvent({
    handoffId: next.id,
    chatId: next.chatId,
    projetoId: next.projetoId,
    tipo: "released",
    descricao: input.motivo?.trim() || "Atendimento liberado para a IA.",
    usuarioId: input.usuarioId ?? null,
    metadata: input.metadata ?? {},
  });

  return next;
}
