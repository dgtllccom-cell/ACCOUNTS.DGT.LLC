import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizeDocumentStorageKey } from "@/lib/documents/document-storage";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET_NAME = "erp-documents";
const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", BUCKET_NAME);

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

    // Scope-aware read via the same direct-PG bootstrap the rest of this module uses.
    const doc = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id, storage_key, file_name, file_type, file_url, deleted_at,
               country_id, country_name
        from public.office_documents
        where id = ${id}
        limit 1
      `;
      return rows[0] ?? null;
    });

    if (!doc || doc.deleted_at) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Country scope enforcement for non-super-admins.
    const isSuperAdmin = session.roles?.includes("super_admin") || (session as { isSuperAdmin?: boolean }).isSuperAdmin;
    const allowedCountries: string[] = (session as { countryIds?: string[] }).countryIds ?? [];
    if (!isSuperAdmin && doc.country_id && allowedCountries.length > 0 && !allowedCountries.includes(doc.country_id)) {
      return NextResponse.json({ error: "This document is outside your assigned country scope." }, { status: 403 });
    }

    const storageKey = normalizeDocumentStorageKey(doc.storage_key || "");
    const fileName = doc.file_name || `${id}`;
    const contentType = guessContentType(fileName, doc.file_type);

    // 1. Local uploads fallback (dev / self-hosted).
    if (storageKey) {
      const localPath = path.join(LOCAL_UPLOAD_ROOT, storageKey);
      try {
        const buf = await fs.readFile(localPath);
        return fileResponse(buf, fileName, contentType, disposition);
      } catch {
        /* not local — try Supabase */
      }
    }

    // 2. Supabase Storage (private bucket) via the service client.
    if (storageKey) {
      try {
        const supabase = createSupabaseServiceClient();
        const { data, error } = await supabase.storage.from(BUCKET_NAME).download(storageKey);
        if (!error && data) {
          const buf = Buffer.from(await data.arrayBuffer());
          return fileResponse(buf, fileName, contentType, disposition);
        }
      } catch {
        /* fall through */
      }
    }

    // 3. Absolute external URL stored directly on the row (legacy rows).
    if (doc.file_url && /^https?:\/\//i.test(doc.file_url)) {
      return NextResponse.redirect(doc.file_url);
    }

    return NextResponse.json(
      { error: "The stored file for this document could not be located in storage." },
      { status: 404 }
    );
  } catch (error: unknown) {
    rethrowIfNextControlFlow(error);
    const message = error instanceof Error ? error.message : "Download failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function fileResponse(buf: Buffer, fileName: string, contentType: string, disposition: "inline" | "attachment") {
  const asciiName = fileName.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buf.length),
      "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store"
    }
  });
}

function guessContentType(fileName: string, fileType?: string | null): string {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    txt: "text/plain"
  };
  if (map[ext]) return map[ext];
  if (fileType && fileType.includes("/")) return fileType;
  return "application/octet-stream";
}
