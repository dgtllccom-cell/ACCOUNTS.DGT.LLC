import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrReportsService, type HrReportType } from "@/lib/services/hr-reports-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

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
    const lang = await getRequestLanguage(sp.get("lang"));
    const data: any = await hrReportsService.run(
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
    if (type === "employee_directory" && Array.isArray(data?.rows) && data.rows.length) {
      try {
        const synthetic = data.rows
          .filter((r: any) => r.employee_id)
          .map((r: any) => ({ id: r.employee_id, designation: r.designation, department: r.department }));
        if (synthetic.length) {
          const localized = await localizeRecordFields<any>(synthetic, "employees", ["designation", "department"], lang);
          const byId = new Map(localized.map((l: any) => [l.id, l]));
          data.rows = data.rows.map((r: any) => {
            const l = r.employee_id ? byId.get(r.employee_id) : null;
            return l ? { ...r, designation: l.designation, department: l.department } : r;
          });
        }
      } catch {
        // keep original designation/department on failure
      }
    }
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}
