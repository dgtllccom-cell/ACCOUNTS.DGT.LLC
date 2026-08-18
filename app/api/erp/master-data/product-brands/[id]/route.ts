import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_brands", action: "read" });

    const item = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT * FROM public.product_brands WHERE id = ${(await params).id}::uuid AND deleted_at IS NULL
      `;
      return rows[0] || null;
    });

    if (!item) {
      return new Response(JSON.stringify({ error: "Record not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    return apiOk({ brand: item });
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
    authorizeApiScope(session, { resource: "product_brands", action: "update" });

    const body = await request.json();
    const updated = await withLocalPg(async (sql) => {
      const rows = await sql`
        UPDATE public.product_brands
        SET
          brand_name = COALESCE(${body.brandName || body.name}, brand_name),
          brand_code = COALESCE(${body.brandCode || body.code}, brand_code),
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

    return apiOk({ brand: updated });
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
    authorizeApiScope(session, { resource: "product_brands", action: "delete" });

    await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.product_brands SET deleted_at = NOW() WHERE id = ${(await params).id}::uuid
      `;
    });

    return apiOk({ success: true, id: (await params).id });
  } catch (error) {
    return handleApiError(error);
  }
}
