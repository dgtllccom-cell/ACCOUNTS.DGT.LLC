import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Propose the period VAT summary posting (DR/CR against the VAT control ledgers).
// The actual roznamcha posting is executed separately via the existing posting
// path — this records the proposal for review.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await guardUaeTax("file");
    const { id } = await ctx.params;
    const result = await uaeTaxService.proposePeriodPosting(id);
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
