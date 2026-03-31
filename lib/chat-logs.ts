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

function detectLevel(value: { tipo?: string | null; origem?: string | null; descricao?: string | null }) {
  const joined = [value.tipo, value.origem, value.descricao]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\berro\b|\berror\b|\bfailed\b|\bfailure\b|\bexception\b|\bfatal\b/.test(joined) ? "error" : "info";
}

function isErrorLogLike(value: { tipo?: string | null; origem?: string | null; descricao?: string | null }) {
  return detectLevel(value) === "error";
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
}) {
  const normalized = {
    tipo: input.tipo?.trim() || "system_event",
    origem: input.origem?.trim() || "system",
    descricao: input.descricao.trim(),
  };

  if (!isErrorLogLike(normalized)) {
    return;
  }

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

async function listDatabaseLogs(projetoId?: string | null, limit = 120) {
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

export async function listRecentSystemLogs(projetoId?: string | null, limit = 120): Promise<SystemLogEntry[]> {
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
  const [databaseResult, runtimeResult] = await Promise.all([
    supabase.from("logs").delete().not("id", "is", null),
    clearRuntimeErrorLogs(),
  ]);

  if (databaseResult.error) {
    console.error("[chat-logs] failed to clear database logs", databaseResult.error);
    return false;
  }

  return runtimeResult;
}
