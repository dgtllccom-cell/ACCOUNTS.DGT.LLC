import type { NextRequest } from "next/server";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ lineId: string }> }) {
  try {
    const { scope } = await guardUaeTax("read");
    const { lineId } = await ctx.params;
    const trace = await uaeTaxService.traceLine(lineId, scope);
    if (!trace) return apiError("NOT_FOUND", "Tax line not found", 404);
    const documents = await uaeTaxService.listLineDocuments(lineId);
    return apiOk({ trace, documents });
  } catch (error) {
    return handleApiError(error);
  }
}
