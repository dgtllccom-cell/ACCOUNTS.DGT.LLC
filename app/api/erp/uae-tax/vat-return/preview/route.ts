import type { NextRequest } from "next/server";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    await guardUaeTax("read");
    const periodId = new URL(request.url).searchParams.get("periodId");
    if (!periodId) return apiError("VALIDATION_ERROR", "periodId is required", 422);
    const preview = await uaeTaxService.vatReturnPreview(periodId);
    return apiOk({ preview });
  } catch (error) {
    return handleApiError(error);
  }
}
