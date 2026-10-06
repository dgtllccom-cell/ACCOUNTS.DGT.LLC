import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { requireTaskSession, taskErrorResponse } from "@/lib/user-tasks/route-helpers";
import { addAttachment, deleteAttachment } from "@/lib/user-tasks/service";
import { saveDocumentBlob } from "@/lib/documents/document-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB — stored in the shared erp-documents bucket, not inline

function safeName(name: string): string {
  return (name || "file")
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "file";
}

/**
 * Evidence / instruction file upload. The bytes go to the existing shared
 * `erp-documents` storage bucket (Supabase Storage, with the same local-fallback
 * the Documents module uses) — the DB row keeps only a storage key, never inline
 * base64. Retrieve via GET .../attachments/<attachmentId> (signed URL redirect).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return apiError("VALIDATION", "Upload must be multipart/form-data with a 'file' part.", 400);
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("VALIDATION", "Missing 'file' part.", 400);
    if (file.size <= 0) return apiError("VALIDATION", "The file is empty.", 400);
    if (file.size > MAX_BYTES) return apiError("VALIDATION", `File is too large (max ${MAX_BYTES / 1024 / 1024} MB).`, 400);

    const kindRaw = String(form.get("kind") || "evidence");
    const kind = kindRaw === "instruction" ? "instruction" : "evidence";
    const note = (String(form.get("note") || "").trim() || null) as string | null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const attId = randomUUID();
    const storageKey = `user-tasks/${id}/${attId}-${safeName(file.name)}`;
    const saved = await saveDocumentBlob({
      storageKey,
      buffer,
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    const res = await addAttachment(auth.session, id, {
      kind,
      name: file.name || safeName(file.name),
      mime: file.type || null,
      sizeBytes: file.size,
      note,
      file: { storageKey: saved.storageKey, storageProvider: saved.storageProvider },
    });
    return apiCreated(res);
  } catch (error) {
    return taskErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  try {
    const attachmentId = new URL(request.url).searchParams.get("attachmentId");
    if (!attachmentId) return apiError("VALIDATION", "attachmentId is required", 400);
    await deleteAttachment(auth.session, id, attachmentId);
    return apiOk({ ok: true });
  } catch (error) {
    return taskErrorResponse(error);
  }
}
