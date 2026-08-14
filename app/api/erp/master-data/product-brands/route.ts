import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_brands", action: "read" });

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim();

    const data = await withLocalPg(async (sql) => {
      let query = sql`
        SELECT id, brand_code, brand_name, description, is_active, created_at
        FROM public.product_brands
        WHERE deleted_at IS NULL
      `;
      if (q) {
        const pattern = `%${q}%`;
        query = sql`${query} AND (brand_name ILIKE ${pattern} OR brand_code ILIKE ${pattern})`;
      }
      return await sql`${query} ORDER BY created_at DESC LIMIT 500`;
    });

    const list = data || [];
    const active = list.filter((item: any) => item.is_active).length;
    return apiOk({
      brands: list,
      productBrands: list,
      summary: { total: list.length, active, inactive: list.length - active }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_brands", action: "create" });

    const body = await request.json();
    const brandName = typeof body.brandName === "string" ? body.brandName.trim() : (body.name || "");
    const brandCode = typeof body.brandCode === "string" ? body.brandCode.trim().toUpperCase() : (body.code || "");

    if (!brandName || !brandCode) {
      return new Response(JSON.stringify({ error: "brandName and brandCode required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const created = await withLocalPg(async (sql) => {
      const rows = await sql`
        INSERT INTO public.product_brands (
          brand_code, brand_name, description, is_active, created_by, created_at, updated_at
        ) VALUES (
          ${brandCode},
          ${brandName},
          ${body.description || null},
          ${body.isActive !== false},
          ${session.userId ? sql`${session.userId}::uuid` : null},
          NOW(),
          NOW()
        )
        RETURNING *
      `;
      return rows[0];
    });

    return apiOk({ brand: created, productBrand: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
