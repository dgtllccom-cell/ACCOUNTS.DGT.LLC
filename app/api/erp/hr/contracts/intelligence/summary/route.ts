import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardContracts } from "@/lib/services/contract-register-api";
import { contractRegisterService } from "@/lib/services/contract-register-service";
import { getRequestLanguage } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Portfolio-level Contract Intelligence risk summary (counts by risk level + contracts needing attention). */
export async function GET(req: NextRequest) {
  try {
    const { scope } = await guardContracts("read");
    await getRequestLanguage(req.nextUrl.searchParams.get("lang")); // counts only — no free text in this response
    const summary = await contractRegisterService.getIntelligenceSummary(scope);
    return apiOk({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
