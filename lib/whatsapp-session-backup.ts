import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_BUCKET = "whatsapp-session-backups";
const DEFAULT_OBJECT_PATH = "worker/latest.zip";
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
