import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizeDocumentStorageKey } from "@/lib/documents/document-storage";

/**
 * Streams the REAL stored blob of one Central i-Documents record (local uploads, then the private Supabase bucket, then a legacy absolute URL).
 * The CALLER must already have proved the login may read this document (documents gate or the HR KYC gate) - this helper does no access check.
 */
const BUCKET_NAME = "erp-documents";
const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", BUCKET_NAME);

export async function serveOfficeDocumentFile(id: string, disposition: "inline" | "attachment"): Promise<NextResponse> {
  const doc = await withLocalPg(async (sql) => {
    const rows = await sql`
      select id, storage_key, file_name, file_type, file_url, deleted_at
      from public.office_documents
      where id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  });
  if (!doc || doc.deleted_at) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const storageKey = normalizeDocumentStorageKey(doc.storage_key || "");
  const fileName = doc.file_name || `${id}`;
  const contentType = guessContentType(fileName, doc.file_type);

  if (storageKey) {
    try {
      const buf = await fs.readFile(path.join(LOCAL_UPLOAD_ROOT, storageKey));
      return fileResponse(buf, fileName, contentType, disposition);
    } catch {
      /* not local - try Supabase */
    }
    try {
      const supabase = createSupabaseServiceClient();
      const { data, error } = await supabase.storage.from(BUCKET_NAME).download(storageKey);
      if (!error && data) return fileResponse(Buffer.from(await data.arrayBuffer()), fileName, contentType, disposition);
    } catch {
      /* fall through */
    }
  }
  if (doc.file_url && /^https?:\/\//i.test(doc.file_url)) return NextResponse.redirect(doc.file_url);
  return NextResponse.json({ error: "The stored file for this document could not be located in storage." }, { status: 404 });
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
