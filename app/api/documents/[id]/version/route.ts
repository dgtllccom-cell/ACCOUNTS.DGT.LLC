import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { saveDocumentBlob } from "@/lib/documents/document-storage";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function requestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

/**
 * POST /api/documents/[id]/version   (multipart: file)
 *
 * Uploads a replacement file for an existing Central i-Documents record.
 * The prior revision's storage key + checksum are archived in
 * metadata.versionHistory[]; version is bumped; an audit row is written.
 * The old blob is retained (not deleted) so the version chain stays intact.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;

    const form = await request.formData();
    const file = form.get("file");
    const note = (form.get("note") as string) || null;
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A replacement file is required." }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds the 25 MB limit." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(buffer).digest("hex");

    const result = await withLocalPg(async (sql) => {
      const current = (await sql`
        select id, storage_key, document_path, file_name, file_size, file_type, version, metadata,
               checksum_sha256, company_id, country_id
        from public.office_documents
        where id = ${id} and deleted_at is null
        limit 1
      `)[0];
      if (!current) return { notFound: true } as const;

      // Country scope enforcement for non-super-admins.
      const isSuperAdmin = session.roles?.includes("super_admin") || (session as { isSuperAdmin?: boolean }).isSuperAdmin;
      const allowedCountries: string[] = (session as { countryIds?: string[] }).countryIds ?? [];
      if (!isSuperAdmin && current.country_id && allowedCountries.length > 0 && !allowedCountries.includes(current.country_id)) {
        return { forbidden: true } as const;
      }

      const nextVersion = (Number(current.version) || 1) + 1;
      const ext = (file.name.split(".").pop() || current.file_type || "pdf").toLowerCase();
      const baseName = (current.file_name || `document-${id}`).replace(/\.[^/.]+$/, "");
      const newFileName = `${baseName}_v${nextVersion}.${ext}`;
      const newStorageKey = current.document_path
        ? `${current.document_path}/${newFileName}`
        : newFileName;

      const uploaded = await saveDocumentBlob({
        storageKey: newStorageKey,
        buffer,
        contentType: file.type || "application/octet-stream",
        upsert: false
      });

      const priorMeta = (current.metadata && typeof current.metadata === "object") ? current.metadata : {};
      const history = Array.isArray((priorMeta as Record<string, unknown>).versionHistory)
        ? [...((priorMeta as Record<string, unknown>).versionHistory as unknown[])]
        : [];
      history.push({
        version: current.version,
        storage_key: current.storage_key,
        file_name: current.file_name,
        file_size: current.file_size,
        checksum_sha256: current.checksum_sha256,
        replaced_at: new Date().toISOString(),
        replaced_by: session.userId,
        note
      });

      const updated = (await sql`
        update public.office_documents
        set version = ${nextVersion},
            storage_key = ${uploaded.storageKey},
            file_url = ${uploaded.fileUrl},
            file_name = ${newFileName},
            file_size = ${buffer.length},
            file_type = ${ext},
            checksum_sha256 = ${checksum},
            metadata = ${sql.json({ ...priorMeta, versionHistory: history, storageProvider: uploaded.storageProvider })},
            updated_at = now()
        where id = ${id}
        returning *
      `)[0];

      try {
        await sql`
          insert into public.audit_logs (company_id, actor_id, action, entity_table, entity_id, before, after, ip_address)
          values (
            ${current.company_id ?? null}, ${session.userId}, 'office_document.version', 'office_documents', ${id},
            ${sql.json({ version: current.version, storage_key: current.storage_key, file_name: current.file_name, checksum_sha256: current.checksum_sha256 })},
            ${sql.json({ version: nextVersion, storage_key: uploaded.storageKey, file_name: newFileName, checksum_sha256: checksum, note })},
            ${requestIp(request)}
          )
        `;
      } catch (err) {
        console.warn("[documents] version audit skipped:", err instanceof Error ? err.message : String(err));
      }

      return { document: updated, version: nextVersion };
    });

    if (!result) return NextResponse.json({ error: "Database connection is not configured." }, { status: 500 });
    if ("notFound" in result) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    if ("forbidden" in result) return NextResponse.json({ error: "Outside your assigned country scope." }, { status: 403 });

    return NextResponse.json({ success: true, document: result.document, version: result.version });
  } catch (error: unknown) {
    rethrowIfNextControlFlow(error);
    const message = error instanceof Error ? error.message : "Version upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
