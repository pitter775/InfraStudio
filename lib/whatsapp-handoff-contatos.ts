import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeBrazilWhatsAppPhone } from "@/lib/whatsapp-phone";

export class WhatsAppHandoffContactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppHandoffContactError";
  }
}

function mapHandoffContactError(error: { code?: string; message?: string | null } | null | undefined, fallback: string) {
  const rawMessage = String(error?.message || "").trim().toLowerCase();
  const isDuplicateNumber =
    error?.code === "23505" ||
    rawMessage.includes("duplicate key") ||
    rawMessage.includes("already exists") ||
    rawMessage.includes("whatsapp_handoff_contatos_numero_unique");
  const isMissingTable =
    error?.code === "42P01" ||
    (rawMessage.includes("relation") && rawMessage.includes("whatsapp_handoff_contatos"));
  const isPermissionDenied =
    error?.code === "42501" ||
    rawMessage.includes("permission denied") ||
    rawMessage.includes("not allowed");

  if (isDuplicateNumber) {
    return new WhatsAppHandoffContactError(
      "Este numero ja esta cadastrado como contato de aviso neste projeto. Use outro numero ou edite o contato existente.",
    );
  }

  if (isMissingTable) {
    return new WhatsAppHandoffContactError(
      "A configuracao de atendimento humano ainda nao foi criada no banco. Aplique o SQL de `database/seeder/20260401_whatsapp_handoff.sql` no Supabase.",
    );
  }

  if (isPermissionDenied) {
    return new WhatsAppHandoffContactError(
      "O banco bloqueou o acesso aos contatos de handoff deste projeto. Libere a tabela `whatsapp_handoff_contatos` no Supabase para o backend.",
    );
  }

  return new WhatsAppHandoffContactError(error?.message || fallback);
}

export type WhatsAppHandoffContactRecord = {
  id: string;
  projetoId: string;
  canalWhatsappId: string | null;
  usuarioId: string | null;
  nome: string;
  numero: string;
  papel: string | null;
  observacoes: string | null;
  ativo: boolean;
  receberAlertas: boolean;
  createdAt: string;
  updatedAt: string;
};

type WhatsAppHandoffContactRow = {
  id: string;
  projeto_id: string;
  canal_whatsapp_id: string | null;
  usuario_id: string | null;
  nome: string | null;
  numero: string | null;
  papel: string | null;
  observacoes: string | null;
  ativo: boolean | null;
  receber_alertas: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function mapContact(row: WhatsAppHandoffContactRow): WhatsAppHandoffContactRecord {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    canalWhatsappId: row.canal_whatsapp_id,
    usuarioId: row.usuario_id,
    nome: row.nome?.trim() || "Contato",
    numero: normalizeBrazilWhatsAppPhone(row.numero),
    papel: row.papel?.trim() || null,
    observacoes: row.observacoes?.trim() || null,
    ativo: row.ativo !== false,
    receberAlertas: row.receber_alertas !== false,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export async function listWhatsAppHandoffContacts(input: {
  projetoId: string;
  canalWhatsappId?: string | null;
  onlyActive?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("whatsapp_handoff_contatos")
    .select("*")
    .eq("projeto_id", input.projetoId)
    .order("nome", { ascending: true });

  if (input.onlyActive) {
    query = query.eq("ativo", true).eq("receber_alertas", true);
  }

  if (input.canalWhatsappId) {
    query = query.or(`canal_whatsapp_id.is.null,canal_whatsapp_id.eq.${input.canalWhatsappId}`);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("[whatsapp-handoff-contatos] failed to list contacts", error);
    throw mapHandoffContactError(error, "Nao foi possivel carregar os contatos de aviso.");
  }

  return (data as WhatsAppHandoffContactRow[]).map((row) => mapContact(row));
}

export async function createWhatsAppHandoffContact(input: {
  projetoId: string;
  canalWhatsappId?: string | null;
  usuarioId?: string | null;
  nome: string;
  numero: string;
  papel?: string | null;
  observacoes?: string | null;
  ativo?: boolean;
  receberAlertas?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const normalizedPhone = normalizeBrazilWhatsAppPhone(input.numero);
  const { data, error } = await supabase
    .from("whatsapp_handoff_contatos")
    .insert({
      projeto_id: input.projetoId,
      canal_whatsapp_id: input.canalWhatsappId ?? null,
      usuario_id: input.usuarioId ?? null,
      nome: input.nome.trim(),
      numero: normalizedPhone,
      papel: input.papel?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
      ativo: input.ativo !== false,
      receber_alertas: input.receberAlertas !== false,
      created_at: now,
      updated_at: now,
    } as never)
    .select("*")
    .single<WhatsAppHandoffContactRow>();

  if (error || !data) {
    console.error("[whatsapp-handoff-contatos] failed to create contact", error);
    throw mapHandoffContactError(error, `Falha ao criar contato de aviso para o numero ${normalizedPhone || "informado"}.`);
  }

  return mapContact(data);
}

export async function updateWhatsAppHandoffContact(input: {
  id: string;
  nome?: string;
  numero?: string;
  papel?: string | null;
  observacoes?: string | null;
  ativo?: boolean;
  receberAlertas?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof input.nome === "string") {
    patch.nome = input.nome.trim();
  }

  if (typeof input.numero === "string") {
    patch.numero = normalizeBrazilWhatsAppPhone(input.numero);
  }

  if (input.papel !== undefined) {
    patch.papel = input.papel?.trim() || null;
  }

  if (input.observacoes !== undefined) {
    patch.observacoes = input.observacoes?.trim() || null;
  }

  if (typeof input.ativo === "boolean") {
    patch.ativo = input.ativo;
  }

  if (typeof input.receberAlertas === "boolean") {
    patch.receber_alertas = input.receberAlertas;
  }

  const { data, error } = await supabase
    .from("whatsapp_handoff_contatos")
    .update(patch as never)
    .eq("id", input.id)
    .select("*")
    .single<WhatsAppHandoffContactRow>();

  if (error || !data) {
    console.error("[whatsapp-handoff-contatos] failed to update contact", error);
    return null;
  }

  return mapContact(data);
}

export async function deleteWhatsAppHandoffContact(id: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("whatsapp_handoff_contatos").delete().eq("id", id);

  if (error) {
    console.error("[whatsapp-handoff-contatos] failed to delete contact", error);
    return false;
  }

  return true;
}
