import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { gateDocument } from "@/lib/documents/document-access";
import { serveOfficeDocumentFile } from "@/lib/documents/document-file";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/documents/download?id=<office_documents.id>[&disposition=inline]
 *
 * Streams the REAL stored blob for a Central i-Documents record with a correct
 * filename. Never fabricates content. Resolves the blob from Supabase Storage
 * (private bucket, service client) or the local uploads fallback.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const id = request.nextUrl.searchParams.get("id");
    const disposition = request.nextUrl.searchParams.get("disposition") === "inline" ? "inline" : "attachment";
    if (!id) return NextResponse.json({ error: "Document ID required" }, { status: 400 });

    // documents:read + country / branch scope + operational domain of the document itself (404 when outside the login's reach)
    const gate = await gateDocument(session, id, "read");
    if ("response" in gate) return gate.response;

    return serveOfficeDocumentFile(id, disposition);
  } catch (error: unknown) {
    rethrowIfNextControlFlow(error);
    const message = error instanceof Error ? error.message : "Download failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
