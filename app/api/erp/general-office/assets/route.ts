/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { requireOfficeSession, officeScopeWhere } from "@/lib/api/office-hr";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  assetTag: z.string().max(80).nullable().optional(),
  assetName: z.string().min(1).max(200),
  category: z.string().max(80).nullable().optional(),
  assignedEmployeeId: z.string().uuid().nullable().optional(),
  serialNumber: z.string().max(120).nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  assetValue: z.number().nullable().optional(),
  currency: z.string().max(10).nullable().optional(),
  status: z.string().default("Available"),
  notes: z.string().max(1000).nullable().optional(),
  countryId: z.string().uuid().nullable().optional(),
  cityBranchId: z.string().uuid().nullable().optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireOfficeSession(false);
    const p = request.nextUrl.searchParams;
    const from = p.get("from"); const to = p.get("to");
    const data = await withLocalPg(async (sql) => {
      const scope = officeScopeWhere(sql, session);
      const rows = await sql`
        select a.*,
               e.employee_code assigned_code,
               coalesce(nullif(trim(concat_ws(' ', cu.first_name, cu.last_name)), ''), cu.customer_name) assigned_name
        from office_assets a
        left join employees e on e.id = a.assigned_employee_id
        left join customers cu on cu.id = e.person_master_id
        where a.deleted_at is null
          and (${from ? sql`a.created_at::date >= ${from}` : sql`true`})
          and (${to ? sql`a.created_at::date <= ${to}` : sql`true`})
          and ${scope}
        order by a.created_at desc
        limit 500`;
      return rows;
    });
    return apiOk({ assets: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireOfficeSession(true);
    const body = createSchema.parse(await request.json());
    const id = await withLocalPg(async (sql) => {
      const row = {
        asset_tag: body.assetTag ?? null,
        asset_name: body.assetName,
        category: body.category ?? null,
        assigned_employee_id: body.assignedEmployeeId ?? null,
        serial_number: body.serialNumber ?? null,
        purchase_date: body.purchaseDate || null,
        asset_value: body.assetValue ?? null,
        currency: body.currency ?? null,
        status: body.status,
        notes: body.notes ?? null,
        country_id: body.countryId ?? null,
        city_branch_id: body.cityBranchId ?? null,
        created_by: session.userId
      };
      const [r] = await sql`insert into office_assets ${sql(row)} returning id`;
      return r.id as string;
    });
    return apiCreated({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
