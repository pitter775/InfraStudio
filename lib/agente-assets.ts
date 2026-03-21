import "server-only";

import { randomUUID } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const AGENTE_ASSETS_BUCKET = "agente-assets";

export type AgenteAssetRecord = {
  id: string;
  agenteId: string;
  projetoId: string | null;
  nome: string;
  descricao: string;
  arquivoNome: string;
  mimeType: string;
  tamanhoBytes: number;
  categoria: "image" | "file";
  storagePath: string;
  publicUrl: string;
  createdAt: string;
};

type AgenteAssetRow = {
  id: string;
  agente_id: string | null;
  projeto_id: string | null;
  nome: string | null;
  descricao: string | null;
  arquivo_nome: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  categoria: string | null;
  storage_path: string | null;
  public_url: string | null;
  created_at: string | null;
};

function mapAgenteAsset(row: AgenteAssetRow): AgenteAssetRecord {
  return {
    id: row.id,
    agenteId: row.agente_id ?? "",
    projetoId: row.projeto_id ?? null,
    nome: row.nome?.trim() || row.arquivo_nome?.trim() || "Arquivo do agente",
    descricao: row.descricao?.trim() || "",
    arquivoNome: row.arquivo_nome?.trim() || "arquivo",
    mimeType: row.mime_type?.trim() || "application/octet-stream",
    tamanhoBytes: Number(row.tamanho_bytes ?? 0),
    categoria: row.categoria === "image" ? "image" : "file",
    storagePath: row.storage_path?.trim() || "",
    publicUrl: row.public_url?.trim() || "",
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function shortenId(value: string | null | undefined) {
  const normalized = String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

  return normalized.slice(0, 8) || "x";
}

function inferAssetCategory(mimeType: string) {
  return mimeType.startsWith("image/") ? "image" : "file";
}

export async function listAgenteAssetsByAgenteIds(agenteIds: string[]) {
  if (!agenteIds.length) {
    return new Map<string, AgenteAssetRecord[]>();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("agente_arquivos")
    .select("id, agente_id, projeto_id, nome, descricao, arquivo_nome, mime_type, tamanho_bytes, categoria, storage_path, public_url, created_at")
    .in("agente_id", agenteIds)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("[agente-assets] failed to list assets by agent ids", error);
    return new Map<string, AgenteAssetRecord[]>();
  }

  const map = new Map<string, AgenteAssetRecord[]>();
  for (const row of data as AgenteAssetRow[]) {
    const asset = mapAgenteAsset(row);
    const current = map.get(asset.agenteId) ?? [];
    current.push(asset);
    map.set(asset.agenteId, current);
  }

  return map;
}

export async function listAgenteAssets(agenteId: string) {
  const map = await listAgenteAssetsByAgenteIds([agenteId]);
  return map.get(agenteId) ?? [];
}

export async function getAgenteAssetById(id: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("agente_arquivos")
    .select("id, agente_id, projeto_id, nome, descricao, arquivo_nome, mime_type, tamanho_bytes, categoria, storage_path, public_url, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[agente-assets] failed to get asset by id", error);
    }
    return null;
  }

  return mapAgenteAsset(data as AgenteAssetRow);
}

export async function createAgenteAsset(input: {
  agenteId: string;
  projetoId: string | null;
  nome?: string | null;
  descricao?: string | null;
  file: File;
}) {
  const supabase = getSupabaseAdminClient();
  const mimeType = input.file.type || "application/octet-stream";
  const categoria = inferAssetCategory(mimeType);
  const extension = input.file.name.includes(".") ? input.file.name.split(".").pop() ?? "" : "";
  const compactStamp = Date.now().toString(36);
  const compactToken = randomUUID().replace(/-/g, "").slice(0, 10);
  const safeExtension = extension ? sanitizeFileName(extension) : "";
  const compactFileName = `${compactStamp}-${compactToken}${safeExtension ? `.${safeExtension}` : ""}`;
  const storagePath = `p-${shortenId(input.projetoId)}/a-${shortenId(input.agenteId)}/${compactFileName}`;
  const fileBuffer = await input.file.arrayBuffer();

  const uploadResult = await supabase.storage.from(AGENTE_ASSETS_BUCKET).upload(storagePath, fileBuffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (uploadResult.error) {
    console.error("[agente-assets] failed to upload file", uploadResult.error);
    return null;
  }

  const publicUrl = supabase.storage.from(AGENTE_ASSETS_BUCKET).getPublicUrl(storagePath).data.publicUrl;

  const { data, error } = await supabase
    .from("agente_arquivos")
    .insert({
      agente_id: input.agenteId,
      projeto_id: input.projetoId,
      nome: input.nome?.trim() || input.file.name,
      descricao: input.descricao?.trim() || null,
      arquivo_nome: input.file.name,
      mime_type: mimeType,
      tamanho_bytes: input.file.size,
      categoria,
      storage_path: storagePath,
      public_url: publicUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .select("id, agente_id, projeto_id, nome, descricao, arquivo_nome, mime_type, tamanho_bytes, categoria, storage_path, public_url, created_at")
    .single();

  if (error || !data) {
    console.error("[agente-assets] failed to persist asset", error);
    await supabase.storage.from(AGENTE_ASSETS_BUCKET).remove([storagePath]);
    return null;
  }

  return mapAgenteAsset(data as AgenteAssetRow);
}

export async function deleteAgenteAsset(id: string) {
  const supabase = getSupabaseAdminClient();
  const current = await getAgenteAssetById(id);
  if (!current) {
    return false;
  }

  const { error } = await supabase.from("agente_arquivos").delete().eq("id", id);
  if (error) {
    console.error("[agente-assets] failed to delete asset row", error);
    return false;
  }

  if (current.storagePath) {
    const storageResult = await supabase.storage.from(AGENTE_ASSETS_BUCKET).remove([current.storagePath]);
    if (storageResult.error) {
      console.error("[agente-assets] failed to delete asset file", storageResult.error);
    }
  }

  return true;
}
