import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { clearRuntimeErrorLogs, listRecentRuntimeErrorLogs } from "@/lib/runtime-error-log";

type LogRow = {
  id: string;
  projeto_id: string | null;
  tipo: string | null;
  origem: string | null;
  descricao: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
};

export type SystemLogEntry = {
  id: string;
  projetoId: string | null;
  tipo: string;
  origem: string;
  descricao: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  level: "info" | "error";
};

function normalizeLogField(value: string | undefined, fallback: string, maxLength = 20) {
  const normalized = value?.trim() || fallback;
  return normalized.slice(0, maxLength);
}

function detectLevel(value: { tipo?: string | null; origem?: string | null; descricao?: string | null }) {
  const joined = [value.tipo, value.origem, value.descricao]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\berro\b|\berror\b|\bfailed\b|\bfailure\b|\bexception\b|\bfatal\b/.test(joined) ? "error" : "info";
}

function sanitizePayload(payload: Record<string, unknown> | null) {
  if (!payload) {
    return null;
  }

  const entries = Object.entries(payload).filter(([key]) => {
    const normalizedKey = key.toLowerCase();
    return ![
      "summary",
      "latestusermessage",
      "replypreview",
      "requestdebug",
      "requestpayload",
      "messages",
      "history",
      "conteudo",
      "content",
    ].includes(normalizedKey);
  });

  return entries.length ? Object.fromEntries(entries) : null;
}

function mapLog(row: LogRow): SystemLogEntry {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    tipo: row.tipo?.trim() || "log",
    origem: row.origem?.trim() || "sistema",
    descricao: row.descricao?.trim() || "Log do sistema",
    payload: sanitizePayload(row.payload),
    createdAt: row.created_at ?? new Date().toISOString(),
    level: detectLevel(row),
  };
}

export async function appendChatRequestLog(input: {
  projetoId?: string | null;
  descricao?: string;
  payload?: Record<string, unknown> | null;
}) {
  void input;
}

export async function appendSystemLog(input: {
  projetoId?: string | null;
  tipo?: string;
  origem?: string;
  descricao: string;
  payload?: Record<string, unknown> | null;
  skipErrorGate?: boolean;
}) {
  const normalized = {
    tipo: normalizeLogField(input.tipo, "system_event"),
    origem: normalizeLogField(input.origem, "system"),
    descricao: input.descricao.trim(),
  };

  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from("logs").insert({
      projeto_id: input.projetoId ?? null,
      tipo: normalized.tipo,
      origem: normalized.origem,
      descricao: normalized.descricao,
      payload: input.payload ?? null,
      created_at: new Date().toISOString(),
    } as never);
  } catch (error) {
    console.error("[chat-logs] failed to append system log", error);
  }
}

async function listDatabaseLogs(projetoId?: string | null, limit = 500) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("logs")
    .select("id, projeto_id, tipo, origem, descricao, payload, created_at")
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

  return (data as LogRow[]).map(mapLog);
}

export async function listRecentSystemLogs(projetoId?: string | null, limit = 500): Promise<SystemLogEntry[]> {
  const [databaseLogs, runtimeLogs] = await Promise.all([
    listDatabaseLogs(projetoId, limit),
    listRecentRuntimeErrorLogs(limit),
  ]);

  const filteredRuntimeLogs = projetoId
    ? runtimeLogs.filter((entry) => entry.projetoId === projetoId)
    : runtimeLogs;

  const runtimeEntries: SystemLogEntry[] = filteredRuntimeLogs.map((entry) => ({
    id: entry.id,
    projetoId: entry.projetoId,
    tipo: "runtime_error",
    origem: entry.source,
    descricao: entry.message,
    payload: sanitizePayload(entry.payload),
    createdAt: entry.createdAt,
    level: "error",
  }));

  return [...databaseLogs, ...runtimeEntries]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}

export async function clearAllSystemLogs() {
  const supabase = getSupabaseAdminClient();
  const clearDatabaseLogs = async () => {
    const { data, error } = await supabase
      .from("logs")
      .select("id");

    if (error) {
      console.error("[chat-logs] failed to list logs before clear", error);
      return false;
    }

    const ids = ((data ?? []) as Array<{ id: string | null }>).map((row) => row.id).filter((id): id is string => Boolean(id));
    if (!ids.length) {
      return true;
    }

    const chunkSize = 500;
    for (let index = 0; index < ids.length; index += chunkSize) {
      const batch = ids.slice(index, index + chunkSize);
      const { error: deleteError } = await supabase
        .from("logs")
        .delete()
        .in("id", batch);

      if (deleteError) {
        console.error("[chat-logs] failed to clear database logs", deleteError);
        return false;
      }
    }

    return true;
  };

  const [databaseResult, runtimeResult] = await Promise.all([
    clearDatabaseLogs(),
    clearRuntimeErrorLogs(),
  ]);

  return databaseResult && runtimeResult;
}
