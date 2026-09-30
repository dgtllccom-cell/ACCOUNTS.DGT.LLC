import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardPkTax } from "@/lib/services/pk-tax-api";
import { createReturn, pkIncomeTaxDashboard, listReturns } from "@/lib/services/pk-income-tax-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { scope } = await guardPkTax("read");
    const [returns, dashboard] = await Promise.all([listReturns(scope), pkIncomeTaxDashboard(scope)]);
    return apiOk({ returns, dashboard });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, scope } = await guardPkTax("write");
    const b = z.object({
      taxEntityId: z.string().uuid(),
      taxYear: z.number().int().min(2020).max(2100),
      companyType: z.enum(["small", "banking", "other"]).default("other"),
      ntn: z.string().trim().nullish(),
      responsibleUserId: z.string().uuid().nullish(),
    }).parse(await request.json());
    return apiCreated(await createReturn(session, scope, b));
  } catch (error) {
    return handleApiError(error);
  }
}
