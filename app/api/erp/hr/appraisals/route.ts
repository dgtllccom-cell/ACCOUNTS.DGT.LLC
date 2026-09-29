import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createAppraisal, listAppraisals } from "@/lib/services/hr-appraisal-service";
import { goalsSchema } from "@/lib/services/hr-appraisal-schema";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  employeeId: z.string().uuid(),
  periodType: z.enum(["quarterly", "annual", "custom"]),
  periodLabel: z.string().trim().max(20).nullish(),
  periodStart: z.string().nullish(),
  periodEnd: z.string().nullish(),
  reviewerId: z.string().uuid().nullish(),
  goals: goalsSchema.optional(),
});

/** HR sees appraisals in scope; managers see the ones they review; ?mine=1 = the caller's own. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const q = request.nextUrl.searchParams;
    return apiOk({ appraisals: await listAppraisals(session, { periodLabel: q.get("period"), status: q.get("status"), mine: q.get("mine") === "1" }) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    return apiCreated(await createAppraisal(session, createSchema.parse(await request.json())));
  } catch (error) {
    return handleApiError(error);
  }
}
