import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_BUCKET = "whatsapp-session-backups";
const DEFAULT_OBJECT_PATH = "worker/latest.zip";

let bucketReady = false;

function getBucketName() {
  return process.env.WHATSAPP_SESSION_BACKUP_BUCKET?.trim() || DEFAULT_BUCKET;
}

function getObjectPath() {
  return process.env.WHATSAPP_SESSION_BACKUP_OBJECT_PATH?.trim() || DEFAULT_OBJECT_PATH;
}

async function ensureBackupBucket() {
  if (bucketReady) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const bucketName = getBucketName();
  const { data, error } = await supabase.storage.getBucket(bucketName);

  if (!error && data) {
    bucketReady = true;
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: "100MB",
  });

  if (createError && !/already exists|duplicate/i.test(createError.message || "")) {
    throw new Error(createError.message || "Falha ao criar bucket de backup da sessao do WhatsApp.");
  }

  bucketReady = true;
}

export async function uploadWhatsAppSessionBackup(buffer: Buffer) {
  await ensureBackupBucket();

  const supabase = getSupabaseAdminClient();
  const bucketName = getBucketName();
  const objectPath = getObjectPath();

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
    size: buffer.byteLength,
  };
}

export async function downloadWhatsAppSessionBackup() {
  await ensureBackupBucket();

  const supabase = getSupabaseAdminClient();
  const bucketName = getBucketName();
  const objectPath = getObjectPath();

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
    buffer,
  };
}
