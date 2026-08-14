import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_units", action: "read" });

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim();

    const data = await withLocalPg(async (sql) => {
      let query = sql`
        SELECT id, unit_code, unit_name, base_unit_code, conversion_factor, is_active, created_at
        FROM public.product_units
        WHERE deleted_at IS NULL
      `;
      if (q) {
        const pattern = `%${q}%`;
        query = sql`${query} AND (unit_name ILIKE ${pattern} OR unit_code ILIKE ${pattern})`;
      }
      return await sql`${query} ORDER BY created_at DESC LIMIT 500`;
    });

    const list = data || [];
    const active = list.filter((item: any) => item.is_active).length;
    return apiOk({
      units: list,
      productUnits: list,
      summary: { total: list.length, active, inactive: list.length - active }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_units", action: "create" });

    const body = await request.json();
    const unitName = typeof body.unitName === "string" ? body.unitName.trim() : (body.name || "");
    const unitCode = typeof body.unitCode === "string" ? body.unitCode.trim().toUpperCase() : (body.code || "");

    if (!unitName || !unitCode) {
      return new Response(JSON.stringify({ error: "unitName and unitCode required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const created = await withLocalPg(async (sql) => {
      const rows = await sql`
        INSERT INTO public.product_units (
          unit_code, unit_name, base_unit_code, conversion_factor, is_active, created_by, created_at, updated_at
        ) VALUES (
          ${unitCode},
          ${unitName},
          ${body.baseUnitCode || null},
          ${body.conversionFactor ? Number(body.conversionFactor) : 1},
          ${body.isActive !== false},
          ${session.userId ? sql`${session.userId}::uuid` : null},
          NOW(),
          NOW()
        )
        RETURNING *
      `;
      return rows[0];
    });

    return apiOk({ unit: created, productUnit: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
