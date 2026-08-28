import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardUaeTax("read");
    const taxEntityId = new URL(request.url).searchParams.get("taxEntityId") || undefined;
    const returns = await uaeTaxService.listVatReturns(taxEntityId, scope);
    return apiOk({ returns });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await guardUaeTax("file");
    const { periodId } = z.object({ periodId: z.string().uuid() }).parse(await request.json());
    const result = await uaeTaxService.generateVatReturn(periodId, session.userId);
    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}
