import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireTaskSession, taskErrorResponse } from "@/lib/user-tasks/route-helpers";
import { getAttachmentForDownload } from "@/lib/user-tasks/service";
import { resolveDocumentFileUrl } from "@/lib/documents/document-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Scope-checked download: resolves the stored file to a short-lived signed URL and redirects. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string; attachmentId: string }> }) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  const { id, attachmentId } = await ctx.params;
  try {
    const att = await getAttachmentForDownload(auth.session, id, attachmentId);
    if (!att) return apiError("NOT_FOUND", "Attachment not found", 404);
    const storageKey = (att.file as any)?.storageKey as string | undefined;
    if (!storageKey) return apiError("NOT_FOUND", "This attachment has no stored file.", 404);
    const url = await resolveDocumentFileUrl(storageKey);
    if (!url) return apiError("NOT_FOUND", "The file could not be resolved.", 404);
    return NextResponse.redirect(url.startsWith("http") ? url : new URL(url, request.url), 302);
  } catch (error) {
    return taskErrorResponse(error);
  }
}
