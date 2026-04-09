import "server-only";

import { randomUUID } from "crypto";
import { buildDemoExpirationDate, getDemoChannelMetadata, isDemoChannelExpired, withDemoChannelMetadata } from "@/lib/demo";
import { getProjetoById } from "@/lib/projetos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { purgeWhatsAppServiceSessions } from "@/lib/whatsapp-service";

export type WhatsAppChannelStatus = "ativo" | "inativo";

export type WhatsAppSessionData = {
  connectionStatus?: "offline" | "aguardando_qr" | "connecting" | "online";
  qrCodeUrl?: string | null;
  qrCodeDataUrl?: string | null;
  qrCodeText?: string | null;
  connectedAt?: string | null;
  disconnectedAt?: string | null;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  lastSyncAt?: string | null;
  worker?: string | null;
  notes?: string | null;
  [key: string]: unknown;
};

export type WhatsAppChannelRecord = {
  id: string;
  projetoId: string | null;
  agenteId: string | null;
  numero: string;
  sessionId: string | null;
  modo: "demo" | "real";
  expiraEm: string | null;
  demoExpired: boolean;
  status: WhatsAppChannelStatus;
  sessionData: WhatsAppSessionData | null;
  createdAt: string;
  updatedAt: string;
};

export class WhatsAppChannelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppChannelError";
  }
}

type WhatsAppChannelRow = {
  id: string;
  projeto_id: string | null;
  agente_id: string | null;
  numero: string | null;
  session_data: WhatsAppSessionData | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function normalizeNumero(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function mapWhatsAppChannel(row: WhatsAppChannelRow): WhatsAppChannelRecord {
  const demo = getDemoChannelMetadata(row.session_data);

  return {
    id: row.id,
    projetoId: row.projeto_id,
    agenteId: row.agente_id,
    numero: normalizeNumero(row.numero),
    sessionId: demo.sessionId,
    modo: demo.modo,
    expiraEm: demo.expiraEm,
    demoExpired: isDemoChannelExpired(row.session_data),
    sessionData: row.session_data ?? null,
    status: row.status === "inativo" ? "inativo" : "ativo",
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export async function listWhatsAppChannels(projetoId?: string | null) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("canais_whatsapp")
    .select("id, projeto_id, agente_id, numero, session_data, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (projetoId) {
    query = query.eq("projeto_id", projetoId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("[whatsapp-channels] failed to list channels", error);
    return [];
  }

  return data.map((row) => mapWhatsAppChannel(row as WhatsAppChannelRow));
}

export async function getWhatsAppChannelById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("canais_whatsapp")
    .select("id, projeto_id, agente_id, numero, session_data, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[whatsapp-channels] failed to load channel", error);
    }
    return null;
  }

  return mapWhatsAppChannel(data as WhatsAppChannelRow);
}

export async function getPreferredWhatsAppChannel(input: { projetoId: string; agenteId?: string | null }) {
  if (!input.agenteId) {
    return null;
  }

  const channels = await listWhatsAppChannels(input.projetoId);
  const activeChannels = channels.filter((channel) => channel.status === "ativo");
  return activeChannels.find((channel) => channel.agenteId === input.agenteId) ?? null;
}

export async function getWhatsAppChannelByProject(input: {
  projetoId: string;
  excludeId?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("canais_whatsapp")
    .select("id, projeto_id, agente_id, numero, session_data, status, created_at, updated_at")
    .eq("projeto_id", input.projetoId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (input.excludeId) {
    query = query.neq("id", input.excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[whatsapp-channels] failed to load project channel", error);
    }
    return null;
  }

  return mapWhatsAppChannel(data as WhatsAppChannelRow);
}

export async function createWhatsAppChannel(input: {
  projetoId: string;
  agenteId?: string | null;
  numero: string;
  sessionData?: WhatsAppSessionData | null;
  status?: WhatsAppChannelStatus;
}) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const projeto = await getProjetoById(input.projetoId);
  const isDemo = projeto?.isDemo === true;
  const sessionId = `wa_${randomUUID()}`;
  const nextSessionData = withDemoChannelMetadata(
    input.sessionData ?? { connectionStatus: "offline" },
    {
      sessionId,
      modo: isDemo ? "demo" : "real",
      expiraEm: isDemo ? (projeto?.demoExpiresAt ?? buildDemoExpirationDate()) : null,
      reconnectDisabled: isDemo,
    },
  );
  const { data, error } = await supabase
    .from("canais_whatsapp")
    .insert({
      projeto_id: input.projetoId,
      agente_id: input.agenteId ?? null,
      numero: normalizeNumero(input.numero),
      session_data: nextSessionData,
      status: input.status ?? "ativo",
      created_at: now,
      updated_at: now,
    } as never)
    .select("id, projeto_id, agente_id, numero, session_data, status, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[whatsapp-channels] failed to create channel", error);
    throw new WhatsAppChannelError(error?.message || "Falha ao criar canal WhatsApp no banco de dados.");
  }

  return mapWhatsAppChannel(data as WhatsAppChannelRow);
}

export async function updateWhatsAppChannel(input: {
  id: string;
  projetoId?: string | null;
  agenteId?: string | null;
  numero: string;
  sessionData?: WhatsAppSessionData | null;
  status?: WhatsAppChannelStatus;
}) {
  const supabase = getSupabaseAdminClient();
  const current = await getWhatsAppChannelById(input.id);
  const nextSessionData = input.sessionData === undefined ? current?.sessionData ?? null : input.sessionData;
  const { data, error } = await supabase
    .from("canais_whatsapp")
    .update({
      projeto_id: input.projetoId ?? undefined,
      agente_id: input.agenteId ?? null,
      numero: normalizeNumero(input.numero),
      session_data: nextSessionData,
      status: input.status ?? current?.status ?? "ativo",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id)
    .select("id, projeto_id, agente_id, numero, session_data, status, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[whatsapp-channels] failed to update channel", error);
    throw new WhatsAppChannelError(error?.message || "Falha ao atualizar canal WhatsApp no banco de dados.");
  }

  return mapWhatsAppChannel(data as WhatsAppChannelRow);
}

export async function updateWhatsAppChannelSession(id: string, nextSessionData: WhatsAppSessionData, status?: WhatsAppChannelStatus) {
  const current = await getWhatsAppChannelById(id);
  if (!current) {
    return null;
  }

  return await updateWhatsAppChannel({
    id,
    projetoId: current.projetoId,
    agenteId: current.agenteId,
    numero: current.numero,
    status: status ?? current.status,
    sessionData: {
      ...(current.sessionData ?? {}),
      ...nextSessionData,
      lastSyncAt: new Date().toISOString(),
    },
  });
}

export async function deleteWhatsAppChannel(id: string) {
  const purge = await purgeWhatsAppServiceSessions({ channelId: id });
  if (!purge.ok) {
    throw new WhatsAppChannelError(purge.error || "Falha ao limpar a persistencia do whatsapp-service.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("canais_whatsapp").delete().eq("id", id);

  if (error) {
    console.error("[whatsapp-channels] failed to delete channel", error);
    throw new WhatsAppChannelError(error?.message || "Falha ao excluir canal WhatsApp no banco de dados.");
  }

  return true;
}
