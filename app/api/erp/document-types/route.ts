import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "document_types", action: "read" });

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim();
    const lang = normalizeLanguage(searchParams.get("lang"), "en");

    const data = await withLocalPg(async (sql) => {
      let query = sql`
        SELECT id, code, name, description, is_active, created_at, name_en, name_ur, name_ar, name_fa, name_ps
        FROM public.document_types
        WHERE deleted_at IS NULL
      `;
      if (q) {
        const pattern = `%${q}%`;
        query = sql`${query} AND (name ILIKE ${pattern} OR code ILIKE ${pattern} OR description ILIKE ${pattern})`;
      }
      return await sql`${query} ORDER BY created_at DESC LIMIT 500`;
    });

    const list = data || [];
    const localized = Array.isArray(list) && list.length > 0
      ? await localizeRecordNames<any>(list, "document_types", "name", lang, { phraseFallback: true })
      : list;
    const localizedWithDescription = Array.isArray(localized) && localized.length > 0
      ? await localizeRecordNames<any>(localized, "document_types", "description", lang, { phraseFallback: true })
      : localized;
    const active = localizedWithDescription.filter((item: any) => item.is_active).length;
    return apiOk({
      documentTypes: localizedWithDescription,
      summary: { total: localizedWithDescription.length, active, inactive: localizedWithDescription.length - active }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "document_types", action: "create" });

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;

    if (!name || !code) {
      return new Response(JSON.stringify({ error: "name and code required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const created = await withLocalPg(async (sql) => {
      const rows = await sql`
        INSERT INTO public.document_types (
          code, name, description, is_active, created_by, created_at, updated_at
        ) VALUES (
          ${code},
          ${name},
          ${description},
          ${body.isActive !== false},
          ${session.userId ? sql`${session.userId}::uuid` : null},
          NOW(),
          NOW()
        )
        RETURNING *
      `;
      return rows[0];
    });

    return apiOk({ documentType: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
