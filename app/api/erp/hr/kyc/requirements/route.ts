import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrKycService } from "@/lib/services/hr-kyc-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    await guardHr("read");
    const countryId = request.nextUrl.searchParams.get("countryId");
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    let rows: any[] = await hrKycService.requirements(countryId);
    try {
      rows = await localizeRecordFields<any>(rows, "hr_employee_kyc_requirements", ["label"], lang);
    } catch {
      // keep original labels
    }
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}
