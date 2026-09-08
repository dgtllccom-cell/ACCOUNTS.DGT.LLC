import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields, wantsRawRecord } from "@/lib/i18n/localize-records";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_units", action: "read" });

    const item = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT * FROM public.product_units WHERE id = ${(await params).id}::uuid AND deleted_at IS NULL
      `;
      return rows[0] || null;
    });

    if (!item) {
      return new Response(JSON.stringify({ error: "Record not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    let unit = item;
    if (!wantsRawRecord(request)) {
      const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
      [unit] = await localizeRecordFields<any>([unit], "product_units", ["unit_name"], lang);
    }
    return apiOk({ unit });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_units", action: "update" });

    const body = await request.json();
    const updated = await withLocalPg(async (sql) => {
      const rows = await sql`
        UPDATE public.product_units
        SET
          unit_name = COALESCE(${body.unitName || body.name}, unit_name),
          unit_code = COALESCE(${body.unitCode || body.code}, unit_code),
          is_active = COALESCE(${body.isActive}, is_active),
          updated_at = NOW()
        WHERE id = ${(await params).id}::uuid AND deleted_at IS NULL
        RETURNING *
      `;
      return rows[0] || null;
    });

    if (!updated) {
      return new Response(JSON.stringify({ error: "Record not found or update failed" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    return apiOk({ unit: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_units", action: "delete" });

    await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.product_units SET deleted_at = NOW() WHERE id = ${(await params).id}::uuid
      `;
    });

    return apiOk({ success: true, id: (await params).id });
  } catch (error) {
    return handleApiError(error);
  }
}
