/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { requireOfficeSession, officeScopeWhere } from "@/lib/api/office-hr";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  employeeId: z.string().uuid(),
  attendanceDate: z.string().min(8),
  checkIn: z.string().nullable().optional(),
  checkOut: z.string().nullable().optional(),
  status: z.string().default("Present"),
  workHours: z.number().nullable().optional(),
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
      const scope = officeScopeWhere(sql, session, "a");
      const rows = await sql`
        select a.*, e.employee_code,
               coalesce(nullif(trim(concat_ws(' ', cu.first_name, cu.last_name)), ''), cu.customer_name) employee_name,
               e.designation, e.department
        from office_attendance a
        join employees e on e.id = a.employee_id
        left join customers cu on cu.id = e.person_master_id
        where a.deleted_at is null
          and (${from ? sql`a.attendance_date >= ${from}` : sql`true`})
          and (${to ? sql`a.attendance_date <= ${to}` : sql`true`})
          and ${scope}
        order by a.attendance_date desc, a.created_at desc
        limit 500`;
      return rows;
    });
    return apiOk({ attendance: data ?? [] });
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
        attendance_date: body.attendanceDate,
        check_in: body.checkIn || null,
        check_out: body.checkOut || null,
        status: body.status,
        work_hours: body.workHours ?? null,
        notes: body.notes ?? null,
        country_id: body.countryId ?? null,
        city_branch_id: body.cityBranchId ?? null,
        created_by: session.userId
      };
      const [r] = await sql`insert into office_attendance ${sql(row)} returning id`;
      return r.id as string;
    });
    return apiCreated({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
