import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    await guardUaeTax("read");
    const p = new URL(request.url).searchParams;
    const rows = await uaeTaxService.getCompleteness(p.get("taxEntityId") || undefined, p.get("periodId") || undefined);
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}
