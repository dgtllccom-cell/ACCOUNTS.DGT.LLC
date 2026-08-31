import { NextRequest } from "next/server";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { requireInquirySession, inquiryErrorResponse } from "@/lib/customer-inquiry/route-helpers";
import { addAttachment, deleteAttachment } from "@/lib/customer-inquiry/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) return apiError("VALIDATION", "Upload must be multipart/form-data with a 'file' part.", 400);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("VALIDATION", "Missing 'file' part.", 400);
    if (file.size <= 0) return apiError("VALIDATION", "The file is empty.", 400);
    if (file.size > MAX_BYTES) return apiError("VALIDATION", `File is too large (max ${MAX_BYTES / 1024 / 1024} MB).`, 400);
    const kind = String(form.get("kind") || "doc").slice(0, 24);
    const buffer = Buffer.from(await file.arrayBuffer());
    const res = await addAttachment(auth.session, id, {
      name: file.name || "file",
      buffer,
      contentType: file.type || "application/octet-stream",
      kind,
    });
    return apiCreated(res);
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireInquirySession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  try {
    const attachmentId = new URL(request.url).searchParams.get("attachmentId");
    if (!attachmentId) return apiError("VALIDATION", "attachmentId is required", 400);
    await deleteAttachment(auth.session, id, attachmentId);
    return apiOk({ ok: true });
  } catch (error) {
    return inquiryErrorResponse(error);
  }
}
