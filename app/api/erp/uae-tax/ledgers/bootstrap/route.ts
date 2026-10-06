import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { session } = await guardUaeTax("settings");
    const { taxEntityId } = z.object({ taxEntityId: z.string().uuid() }).parse(await request.json());
    const result = await uaeTaxService.bootstrapLedgers(taxEntityId, session.userId);
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
