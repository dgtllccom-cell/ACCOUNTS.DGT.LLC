import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrReportsService, type HrReportType } from "@/lib/services/hr-reports-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const typeSchema = z.enum([
  "employee_directory", "attendance", "leave", "overtime", "payroll_register",
  "salary_slip", "employee_ledger", "expiring_documents", "gratuity", "audit_history",
]);

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const type = typeSchema.parse(sp.get("type")) as HrReportType;
    const data = await hrReportsService.run(
      type,
      {
        from: sp.get("from") || undefined,
        to: sp.get("to") || undefined,
        periodMonth: sp.get("periodMonth") || undefined,
        employeeId: sp.get("employeeId") || undefined,
        countryId: sp.get("countryId") || undefined,
        status: sp.get("status") || undefined,
      },
      scope,
    );
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}
