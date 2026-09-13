import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrGratuityService } from "@/lib/services/hr-gratuity-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    let rows: any[] = (await hrGratuityService.policies(scope)) ?? [];
    try {
      rows = await localizeRecordFields<any>(rows, "hr_gratuity_policy", ["name"], lang);
    } catch {
      // keep original names
    }
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}
