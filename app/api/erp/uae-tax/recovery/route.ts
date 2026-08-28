import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  id: z.string().uuid().optional(),
  taxEntityId: z.string().uuid(),
  taxPeriodId: z.string().uuid().nullish(),
  status: z.enum(["recoverable","pending","claimed","carry_forward","refund_requested","refund_received","rejected","adjusted"]),
  amountAed: z.number(),
  ftaReference: z.string().max(120).nullish(),
  notes: z.string().max(1000).nullish(),
});

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardUaeTax("read");
    const taxEntityId = new URL(request.url).searchParams.get("taxEntityId") || undefined;
    const rows = await uaeTaxService.listRecovery(taxEntityId, scope);
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await guardUaeTax("file");
    const body = schema.parse(await request.json());
    const result = await uaeTaxService.upsertRecovery({ ...body, actor: session.userId });
    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}
