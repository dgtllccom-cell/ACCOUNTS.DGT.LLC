import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrKycService } from "@/lib/services/hr-kyc-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const rows = await hrKycService.queue(scope, {
      status: sp.get("status") || undefined,
      countryId: sp.get("countryId") || undefined,
      search: sp.get("search")?.trim() || undefined,
    });
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
