import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "company_registration_types", action: "read" });

    const item = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT * FROM public.company_registration_types WHERE id = ${params.id}::uuid AND deleted_at IS NULL
      `;
      return rows[0] || null;
    });

    if (!item) {
      return new Response(JSON.stringify({ error: "Record not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    return apiOk({ companyRegistrationType: item });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "company_registration_types", action: "update" });

    const body = await request.json();
    const updated = await withLocalPg(async (sql) => {
      const rows = await sql`
        UPDATE public.company_registration_types
        SET
          name = COALESCE(${body.name}, name),
          code = COALESCE(${body.code}, code),
          description = COALESCE(${body.description}, description),
          is_active = COALESCE(${body.isActive}, is_active),
          updated_at = NOW()
        WHERE id = ${params.id}::uuid AND deleted_at IS NULL
        RETURNING *
      `;
      return rows[0] || null;
    });

    if (!updated) {
      return new Response(JSON.stringify({ error: "Record not found or update failed" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    return apiOk({ companyRegistrationType: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "company_registration_types", action: "delete" });

    await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.company_registration_types SET deleted_at = NOW() WHERE id = ${params.id}::uuid
      `;
    });

    return apiOk({ success: true, id: params.id });
  } catch (error) {
    return handleApiError(error);
  }
}
