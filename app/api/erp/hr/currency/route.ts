import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const qSchema = z.object({
  countryId: z.string().uuid().nullish(),
  countryBranchId: z.string().uuid().nullish(),
  cityBranchId: z.string().uuid().nullish(),
  employeeId: z.string().uuid().nullish(),
});

/**
 * Resolve the OFFICIAL salary currency for a country / branch scope (or an
 * employee). City branch → main branch → country currency_code → USD.
 * Every HRM salary screen calls this instead of hard-coding a currency.
 */
export async function GET(request: NextRequest) {
  try {
    await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const q = qSchema.parse({
      countryId: sp.get("countryId"),
      countryBranchId: sp.get("countryBranchId"),
      cityBranchId: sp.get("cityBranchId"),
      employeeId: sp.get("employeeId"),
    });
    const currency = await withLocalPg(async (sql) => {
      if (q.employeeId) {
        const r = await sql`SELECT public.hr_employee_currency(${q.employeeId}) AS c`;
        return r?.[0]?.c ?? "USD";
      }
      const r = await sql`SELECT public.hr_resolve_currency(${q.countryId ?? null}, ${q.countryBranchId ?? null}, ${q.cityBranchId ?? null}) AS c`;
      return r?.[0]?.c ?? "USD";
    });
    return apiOk({ currency });
  } catch (error) {
    return handleApiError(error);
  }
}
