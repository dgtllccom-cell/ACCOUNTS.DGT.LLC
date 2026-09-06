import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/documents/[id]/audit
 *
 * Full audit history for one Central i-Documents record: upload, metadata
 * updates, new versions, delete — with actor, timestamp, before/after and IP.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;

    const rows = await withLocalPg(async (sql) => {
      const doc = (await sql`
        select id, country_id, title, version, checksum_sha256, storage_key, document_path,
               approval_status, created_by, created_at, updated_at
        from public.office_documents
        where id = ${id}
        limit 1
      `)[0];
      if (!doc) return { notFound: true } as const;

      const isSuperAdmin = session.roles?.includes("super_admin") || (session as { isSuperAdmin?: boolean }).isSuperAdmin;
      const allowedCountries: string[] = (session as { countryIds?: string[] }).countryIds ?? [];
      if (!isSuperAdmin && doc.country_id && allowedCountries.length > 0 && !allowedCountries.includes(doc.country_id)) {
        return { forbidden: true } as const;
      }

      const events = await sql`
        select id, actor_id, action, before, after, ip_address, created_at,
               (select full_name from public.profiles p where p.id = a.actor_id) as actor_name
        from public.audit_logs a
        where a.entity_table = 'office_documents' and a.entity_id = ${id}
        order by a.created_at asc
      `;
      return { doc, events };
    });

    if (!rows) return NextResponse.json({ error: "Database connection is not configured." }, { status: 500 });
    if ("notFound" in rows) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    if ("forbidden" in rows) return NextResponse.json({ error: "Outside your assigned country scope." }, { status: 403 });

    return NextResponse.json({ document: rows.doc, events: rows.events });
  } catch (error: unknown) {
    rethrowIfNextControlFlow(error);
    const message = error instanceof Error ? error.message : "Failed to load audit history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
