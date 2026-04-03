import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_BUCKET = "whatsapp-session-backups";
const DEFAULT_OBJECT_PATH = "worker/latest";
const DEFAULT_FILE_SIZE_LIMIT = "512MB";

let bucketReady = false;

function getBucketName() {
  return process.env.WHATSAPP_SESSION_BACKUP_BUCKET?.trim() || DEFAULT_BUCKET;
}

function getObjectPath() {
  return process.env.WHATSAPP_SESSION_BACKUP_OBJECT_PATH?.trim() || DEFAULT_OBJECT_PATH;
}

function getFileSizeLimit() {
  return process.env.WHATSAPP_SESSION_BACKUP_FILE_SIZE_LIMIT?.trim() || DEFAULT_FILE_SIZE_LIMIT;
}

export function getWhatsAppSessionBackupConfig() {
  return {
    bucketName: getBucketName(),
    objectPath: getObjectPath(),
    fileSizeLimit: getFileSizeLimit(),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "",
  };
}

function getManifestPath() {
  return `${getObjectPath()}/manifest.json`;
}

function getChunkPath(partName: string) {
  return `${getObjectPath()}/chunks/${partName}`;
}

export async function createWhatsAppSessionBackupUploadAccess(files?: Array<{ kind?: string; name?: string }>) {
  await ensureBackupBucket();

  const supabase = getSupabaseAdminClient();
  const { bucketName, fileSizeLimit, supabaseUrl, supabaseAnonKey } = getWhatsAppSessionBackupConfig();
  const requestedFiles = Array.isArray(files) && files.length
    ? files.map((file) => ({
        kind: file?.kind === "manifest" ? "manifest" : "chunk",
        path:
          file?.kind === "manifest"
            ? getManifestPath()
            : getChunkPath(String(file?.name || "").trim()),
      }))
    : [{ kind: "manifest", path: getManifestPath() }];
  const signedFiles = [];

  for (const file of requestedFiles) {
    const { data, error } = await supabase.storage.from(bucketName).createSignedUploadUrl(file.path, {
      upsert: true,
    });

    if (error || !data) {
      throw new Error(error?.message || "Falha ao criar acesso temporario de upload para o backup da sessao do WhatsApp.");
    }

    signedFiles.push({
      kind: file.kind,
      path: data.path,
      token: data.token,
      signedUrl: "signedUrl" in data ? data.signedUrl : null,
    });
  }

  return {
    bucketName,
    objectPath: getObjectPath(),
    fileSizeLimit,
    supabaseUrl,
    supabaseAnonKey,
    manifestPath: getManifestPath(),
    chunkPrefix: `${getObjectPath()}/chunks/`,
    signedFiles,
  };
}

export async function createWhatsAppSessionBackupDownloadAccess() {
  await ensureBackupBucket();

  const supabase = getSupabaseAdminClient();
  const { bucketName, objectPath, fileSizeLimit } = getWhatsAppSessionBackupConfig();
  const manifestPath = getManifestPath();
  const { data, error } = await supabase.storage.from(bucketName).download(manifestPath);

  if (error) {
    if (/not found|does not exist/i.test(error.message || "")) {
      return null;
    }

    throw new Error(error.message || "Falha ao ler o manifest do backup da sessao do WhatsApp.");
  }

  const manifest = JSON.parse(Buffer.from(await data.arrayBuffer()).toString("utf8"));
  const parts = Array.isArray(manifest?.parts) ? manifest.parts : [];
  const signedParts = [];

  for (const part of parts) {
    const chunkPath = getChunkPath(String(part?.name || "").trim());
    const { data: signedData, error: signedError } = await supabase.storage.from(bucketName).createSignedUrl(chunkPath, 60 * 30, {
      download: String(part?.name || "backup.part"),
    });

    if (signedError || !signedData?.signedUrl) {
      throw new Error(signedError?.message || `Falha ao gerar URL assinada para a parte ${String(part?.name || "").trim()}.`);
    }

    signedParts.push({
      name: String(part?.name || "").trim(),
      size: Number(part?.size || 0),
      signedUrl: signedData.signedUrl,
    });
  }

  const { data: manifestSignedData, error: manifestSignedError } = await supabase.storage.from(bucketName).createSignedUrl(manifestPath, 60 * 30, {
    download: "whatsapp-session-backup.zip",
  });

  if (manifestSignedError || !manifestSignedData?.signedUrl) {
    return null;
  }

  return {
    bucketName,
    objectPath,
    fileSizeLimit,
    manifest,
    manifestPath,
    signedUrl: manifestSignedData.signedUrl,
    parts: signedParts,
  };
}

async function ensureBackupBucket() {
  if (bucketReady) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const bucketName = getBucketName();
  const fileSizeLimit = getFileSizeLimit();
  const { data, error } = await supabase.storage.getBucket(bucketName);

  if (!error && data) {
    const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
      public: false,
      fileSizeLimit,
    });

    if (updateError) {
      throw new Error(updateError.message || "Falha ao atualizar limite do bucket de backup da sessao do WhatsApp.");
    }

    bucketReady = true;
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit,
  });

  if (createError && !/already exists|duplicate/i.test(createError.message || "")) {
    throw new Error(createError.message || "Falha ao criar bucket de backup da sessao do WhatsApp.");
  }

  bucketReady = true;
}

export async function uploadWhatsAppSessionBackup(buffer: Buffer) {
  await ensureBackupBucket();

  const supabase = getSupabaseAdminClient();
  const { bucketName, objectPath, fileSizeLimit } = getWhatsAppSessionBackupConfig();

  const { error } = await supabase.storage.from(bucketName).upload(objectPath, buffer, {
    upsert: true,
    contentType: "application/zip",
  });

  if (error) {
    throw new Error(error.message || "Falha ao salvar backup da sessao do WhatsApp.");
  }

  return {
    bucketName,
    objectPath,
    fileSizeLimit,
    size: buffer.byteLength,
  };
}

export async function downloadWhatsAppSessionBackup() {
  await ensureBackupBucket();

  const supabase = getSupabaseAdminClient();
  const { bucketName, objectPath, fileSizeLimit } = getWhatsAppSessionBackupConfig();

  const { data, error } = await supabase.storage.from(bucketName).download(objectPath);

  if (error) {
    if (/not found|does not exist/i.test(error.message || "")) {
      return null;
    }

    throw new Error(error.message || "Falha ao baixar backup da sessao do WhatsApp.");
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return {
    bucketName,
    objectPath,
    fileSizeLimit,
    buffer,
  };
}
