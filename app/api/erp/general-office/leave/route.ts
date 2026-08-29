/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { requireOfficeSession, officeScopeWhere } from "@/lib/api/office-hr";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.string().default("Annual"),
  fromDate: z.string().min(8),
  toDate: z.string().min(8),
  reason: z.string().max(1000).nullable().optional(),
  status: z.string().default("Pending"),
  countryId: z.string().uuid().nullable().optional(),
  cityBranchId: z.string().uuid().nullable().optional()
});

function dayCount(from: string, to: string) {
  const a = new Date(from + "T00:00:00"); const b = new Date(to + "T00:00:00");
  const d = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return d > 0 ? d : 1;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireOfficeSession(false);
    const p = request.nextUrl.searchParams;
    const from = p.get("from"); const to = p.get("to");
    const data = await withLocalPg(async (sql) => {
      const scope = officeScopeWhere(sql, session, "l");
      // A leave overlaps the [from,to] window when its from_date <= window.to AND to_date >= window.from.
      const rows = await sql`
        select l.*, e.employee_code,
               coalesce(nullif(trim(concat_ws(' ', cu.first_name, cu.last_name)), ''), cu.customer_name) employee_name
        from office_leave_requests l
        join employees e on e.id = l.employee_id
        left join customers cu on cu.id = e.person_master_id
        where l.deleted_at is null
          and (${to ? sql`l.from_date <= ${to}` : sql`true`})
          and (${from ? sql`l.to_date >= ${from}` : sql`true`})
          and ${scope}
        order by l.from_date desc, l.created_at desc
        limit 500`;
      return rows;
    });
    return apiOk({ leave: data ?? [] });
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
        employee_id: body.employeeId,
        leave_type: body.leaveType,
        from_date: body.fromDate,
        to_date: body.toDate,
        days: dayCount(body.fromDate, body.toDate),
        reason: body.reason ?? null,
        status: body.status,
        country_id: body.countryId ?? null,
        city_branch_id: body.cityBranchId ?? null,
        created_by: session.userId
      };
      const [r] = await sql`insert into office_leave_requests ${sql(row)} returning id`;
      return r.id as string;
    });
    return apiCreated({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
