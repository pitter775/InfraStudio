import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type ChatLogRow = {
  id: string;
  projeto_id: string | null;
  tipo: string | null;
  origem: string | null;
  descricao: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
};

export type ChatRequestLog = {
  id: string;
  projetoId: string | null;
  tipo: string;
  origem: string;
  descricao: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

function mapLog(row: ChatLogRow): ChatRequestLog {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    tipo: row.tipo?.trim() || "chat_request",
    origem: row.origem?.trim() || "api_chat",
    descricao: row.descricao?.trim() || "Log de requisicao do chat",
    payload: row.payload,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export async function appendChatRequestLog(input: {
  projetoId?: string | null;
  descricao?: string;
  payload?: Record<string, unknown> | null;
}) {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from("logs").insert({
      projeto_id: input.projetoId ?? null,
      tipo: "chat_request",
      origem: "api_chat",
      descricao: input.descricao?.trim() || "Snapshot da requisicao do chat",
      payload: input.payload ?? null,
      created_at: new Date().toISOString(),
    } as never);
  } catch (error) {
    console.error("[chat-logs] failed to append chat request log", error);
  }
}

export async function listRecentChatLogs(projetoId?: string | null, limit = 60) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("logs")
    .select("id, projeto_id, tipo, origem, descricao, payload, created_at")
    .eq("tipo", "chat_request")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projetoId) {
    query = query.eq("projeto_id", projetoId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("[chat-logs] failed to list logs", error);
    return [];
  }

  return (data as ChatLogRow[]).map(mapLog);
}
