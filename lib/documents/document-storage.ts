import fs from "node:fs/promises";
import path from "node:path";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const BUCKET_NAME = "erp-documents";
const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", BUCKET_NAME);
const PUBLIC_UPLOAD_PREFIX = `/uploads/${BUCKET_NAME}`;

export function normalizeDocumentStorageKey(storageKey: string) {
  return storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
}

function localDocumentPath(storageKey: string) {
  return path.join(LOCAL_UPLOAD_ROOT, normalizeDocumentStorageKey(storageKey));
}

function localDocumentUrl(storageKey: string) {
  return `${PUBLIC_UPLOAD_PREFIX}/${normalizeDocumentStorageKey(storageKey)}`;
}

async function ensureLocalDocumentDir(storageKey: string) {
  await fs.mkdir(path.dirname(localDocumentPath(storageKey)), { recursive: true });
}

export async function resolveDocumentFileUrl(storageKey: string | null | undefined): Promise<string | null> {
  if (!storageKey) return null;

  const normalized = normalizeDocumentStorageKey(storageKey);
  try {
    await fs.access(localDocumentPath(normalized));
    return localDocumentUrl(normalized);
  } catch {
    // Fall through to Supabase Storage.
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(normalized, 60 * 60 * 24);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export async function saveDocumentBlob(options: {
  storageKey: string;
  buffer: Buffer;
  contentType?: string | null;
  upsert?: boolean;
}) {
  const normalizedStorageKey = normalizeDocumentStorageKey(options.storageKey);
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.storage.from(BUCKET_NAME).upload(normalizedStorageKey, options.buffer, {
      contentType: options.contentType || "application/octet-stream",
      upsert: options.upsert ?? false
    });
    if (error) throw error;

    const signed = await supabase.storage.from(BUCKET_NAME).createSignedUrl(normalizedStorageKey, 60 * 60 * 24);
    return {
      storageKey: normalizedStorageKey,
      fileUrl: signed.data?.signedUrl ?? localDocumentUrl(normalizedStorageKey),
      storageProvider: "supabase" as const
    };
  } catch (error) {
    if (process.env.ALLOW_DOCUMENT_LOCAL_FALLBACK === "true") {
      await ensureLocalDocumentDir(normalizedStorageKey);
      await fs.writeFile(localDocumentPath(normalizedStorageKey), options.buffer);
      return {
        storageKey: normalizedStorageKey,
        fileUrl: localDocumentUrl(normalizedStorageKey),
        storageProvider: "local" as const,
        uploadError: error instanceof Error ? error.message : String(error)
      };
    }
    throw error;
  }
}

export async function deleteDocumentBlob(storageKey: string | null | undefined) {
  if (!storageKey) return;
  const normalized = normalizeDocumentStorageKey(storageKey);

  try {
    const supabase = createSupabaseServiceClient();
    await supabase.storage.from(BUCKET_NAME).remove([normalized]);
  } catch {
    // Ignore and continue with local cleanup.
  }

  try {
    await fs.rm(localDocumentPath(normalized), { force: true });
  } catch {
    // Ignore missing files.
  }
}
