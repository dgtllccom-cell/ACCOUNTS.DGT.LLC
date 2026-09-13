import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrKycService } from "@/lib/services/hr-kyc-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeJoinedNames } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    let rows: any[] = await hrKycService.queue(scope, {
      status: sp.get("status") || undefined,
      countryId: sp.get("countryId") || undefined,
      search: sp.get("search")?.trim() || undefined,
    });
    const lang = await getRequestLanguage(sp.get("lang"));
    try {
      rows = await localizeJoinedNames<any>(rows, lang, [
        { idField: "country_id", nameField: "country_name", table: "countries", field: "name" }
      ]);
    } catch {
      // keep original country names
    }
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    await guardHr("write");
    const res = await hrKycService.markExpired();
    return apiOk(res);
  } catch (error) {
    return handleApiError(error);
  }
}
