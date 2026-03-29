import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_HOME_WIDGET_SLUG = "infrastudio-home";

export type ChatWidgetRecord = {
  id: string;
  nome: string;
  slug: string;
  projetoId: string | null;
  agenteId: string | null;
  dominio: string;
  whatsappCelular: string;
  tema: "dark" | "light";
  corPrimaria: string;
  fundoTransparente: boolean;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
};

type ChatWidgetRow = {
  id: string;
  nome: string | null;
  slug: string | null;
  projeto_id: string | null;
  agente_id: string | null;
  dominio: string | null;
  whatsapp_celular: string | null;
  tema: "dark" | "light" | null;
  cor_primaria: string | null;
  fundo_transparente: boolean | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function mapChatWidget(row: ChatWidgetRow): ChatWidgetRecord {
  return {
    id: row.id,
    nome: row.nome?.trim() || "Widget sem nome",
    slug: row.slug?.trim() || DEFAULT_HOME_WIDGET_SLUG,
    projetoId: row.projeto_id,
    agenteId: row.agente_id,
    dominio: row.dominio?.trim() || "",
    whatsappCelular: row.whatsapp_celular?.trim() || "",
    tema: row.tema === "light" ? "light" : "dark",
    corPrimaria: row.cor_primaria?.trim() || "#2563eb",
    fundoTransparente: Boolean(row.fundo_transparente),
    ativo: Boolean(row.ativo),
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export async function listChatWidgets(projetoId?: string | null) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("chat_widgets")
    .select("id, nome, slug, projeto_id, agente_id, dominio, whatsapp_celular, tema, cor_primaria, fundo_transparente, ativo, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (projetoId) {
    query = query.eq("projeto_id", projetoId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("[chat-widgets] failed to list widgets", error);
    return [];
  }

  return data.map((row) => mapChatWidget(row as ChatWidgetRow));
}

export async function getChatWidgetById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_widgets")
    .select("id, nome, slug, projeto_id, agente_id, dominio, whatsapp_celular, tema, cor_primaria, fundo_transparente, ativo, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[chat-widgets] failed to load widget by id", error);
    }
    return null;
  }

  return mapChatWidget(data as ChatWidgetRow);
}

export async function getChatWidgetBySlug(slug: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_widgets")
    .select("id, nome, slug, projeto_id, agente_id, dominio, whatsapp_celular, tema, cor_primaria, fundo_transparente, ativo, created_at, updated_at")
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[chat-widgets] failed to load widget by slug", error);
    }
    return null;
  }

  return mapChatWidget(data as ChatWidgetRow);
}

export async function getChatWidgetByProjetoAgente(input: {
  projetoId: string;
  agenteId?: string | null;
}) {
  const supabase = getSupabaseAdminClient();

  if (input.agenteId) {
    const { data, error } = await supabase
      .from("chat_widgets")
      .select("id, nome, slug, projeto_id, agente_id, dominio, whatsapp_celular, tema, cor_primaria, fundo_transparente, ativo, created_at, updated_at")
      .eq("projeto_id", input.projetoId)
      .eq("agente_id", input.agenteId)
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (data) {
      return mapChatWidget(data as ChatWidgetRow);
    }

    if (error) {
      console.error("[chat-widgets] failed to load widget by projeto/agente", error);
    }
  }

  const { data, error } = await supabase
    .from("chat_widgets")
    .select("id, nome, slug, projeto_id, agente_id, dominio, whatsapp_celular, tema, cor_primaria, fundo_transparente, ativo, created_at, updated_at")
    .eq("projeto_id", input.projetoId)
    .is("agente_id", null)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[chat-widgets] failed to load fallback widget by projeto", error);
    }
    return null;
  }

  return mapChatWidget(data as ChatWidgetRow);
}

export async function createChatWidget(input: {
  nome: string;
  slug: string;
  projetoId?: string | null;
  agenteId?: string | null;
  dominio?: string | null;
  whatsappCelular?: string | null;
  tema?: "dark" | "light";
  corPrimaria?: string | null;
  fundoTransparente?: boolean;
  ativo?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("chat_widgets")
    .insert({
      nome: input.nome.trim(),
      slug: input.slug.trim(),
        projeto_id: input.projetoId ?? null,
        agente_id: input.agenteId ?? null,
        dominio: input.dominio?.trim() || null,
        whatsapp_celular: input.whatsappCelular?.trim() || null,
        tema: input.tema === "light" ? "light" : "dark",
        cor_primaria: input.corPrimaria?.trim() || "#2563eb",
        fundo_transparente: input.fundoTransparente ?? true,
        ativo: input.ativo ?? true,
        created_at: now,
        updated_at: now,
    } as never)
    .select("id, nome, slug, projeto_id, agente_id, dominio, whatsapp_celular, tema, cor_primaria, fundo_transparente, ativo, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[chat-widgets] failed to create widget", error);
    return null;
  }

  return mapChatWidget(data as ChatWidgetRow);
}

export async function updateChatWidget(input: {
  id: string;
  nome: string;
  slug: string;
  projetoId?: string | null;
  agenteId?: string | null;
  dominio?: string | null;
  whatsappCelular?: string | null;
  tema?: "dark" | "light";
  corPrimaria?: string | null;
  fundoTransparente?: boolean;
  ativo?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_widgets")
    .update({
      nome: input.nome.trim(),
      slug: input.slug.trim(),
      projeto_id: input.projetoId ?? null,
      agente_id: input.agenteId ?? null,
      dominio: input.dominio?.trim() || null,
      whatsapp_celular: input.whatsappCelular?.trim() || null,
      tema: input.tema === "light" ? "light" : "dark",
      cor_primaria: input.corPrimaria?.trim() || "#2563eb",
      fundo_transparente: input.fundoTransparente ?? true,
      ativo: input.ativo ?? true,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id)
    .select("id, nome, slug, projeto_id, agente_id, dominio, whatsapp_celular, tema, cor_primaria, fundo_transparente, ativo, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[chat-widgets] failed to update widget", error);
    return null;
  }

  return mapChatWidget(data as ChatWidgetRow);
}

export async function deleteChatWidget(id: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("chat_widgets").delete().eq("id", id);

  if (error) {
    console.error("[chat-widgets] failed to delete widget", error);
    return false;
  }

  return true;
}
