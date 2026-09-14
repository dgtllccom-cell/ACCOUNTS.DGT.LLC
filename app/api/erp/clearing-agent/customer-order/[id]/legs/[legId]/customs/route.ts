export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { recordLegCustoms } from "@/lib/services/clearing-order-workflow-service";
import { CLEARANCE_TYPES, DUTY_TREATMENTS, CUSTOMS_STATUSES } from "@/lib/services/clearing-country-customs-config";

const schema = z.object({
  customsCountryId: z.string().uuid().nullish(),
  customsPointText: z.string().trim().max(200).nullish(),
  customsClearingAgentId: z.string().uuid().nullish(),
  clearanceType: z.enum(CLEARANCE_TYPES as [string, ...string[]]),
  dutyTreatment: z.enum(DUTY_TREATMENTS as [string, ...string[]]),
  dutyAmount: z.number().nullish(),
  dutyCurrency: z.string().trim().max(10).nullish(),
  dutyPayer: z.string().trim().max(120).nullish(),
  customsReceiptRef: z.string().trim().max(120).nullish(),
  billOfEntryNo: z.string().trim().max(120).nullish(),
  pgmNumber: z.string().trim().max(120).nullish(),
  declarationReference: z.string().trim().max(120).nullish(),
  taxAmount: z.number().nullish(),
  otherCharges: z.number().nullish(),
  customsStatus: z.enum(CUSTOMS_STATUSES as [string, ...string[]]),
  customsClearanceDate: z.string().trim().max(30).nullish(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string; legId: string }> }) {
  try {
    const session = await requireErpSession();
    const { legId } = await ctx.params;
    const body = schema.parse(await request.json()) as any;
    const result = await recordLegCustoms(session, { legId, ...body });
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
