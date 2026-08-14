import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_categories", action: "read" });

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim();

    const data = await withLocalPg(async (sql) => {
      let query = sql`
        SELECT id, category_code, category_name, description, is_active, created_at
        FROM public.product_categories
        WHERE deleted_at IS NULL
      `;
      if (q) {
        const pattern = `%${q}%`;
        query = sql`${query} AND (category_name ILIKE ${pattern} OR category_code ILIKE ${pattern})`;
      }
      return await sql`${query} ORDER BY created_at DESC LIMIT 500`;
    });

    const list = data || [];
    const active = list.filter((item: any) => item.is_active).length;
    return apiOk({
      categories: list,
      productCategories: list,
      summary: { total: list.length, active, inactive: list.length - active }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_categories", action: "create" });

    const body = await request.json();
    const categoryName = typeof body.categoryName === "string" ? body.categoryName.trim() : (body.name || "");
    const categoryCode = typeof body.categoryCode === "string" ? body.categoryCode.trim().toUpperCase() : (body.code || "");

    if (!categoryName || !categoryCode) {
      return new Response(JSON.stringify({ error: "categoryName and categoryCode required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const created = await withLocalPg(async (sql) => {
      const rows = await sql`
        INSERT INTO public.product_categories (
          category_code, category_name, description, is_active, created_by, created_at, updated_at
        ) VALUES (
          ${categoryCode},
          ${categoryName},
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

    return apiOk({ category: created, productCategory: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
