import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardPkTax } from "@/lib/services/pk-tax-api";
import { createReturn, pkSalesTaxDashboard, listReturns } from "@/lib/services/pk-sales-tax-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { scope } = await guardPkTax("read");
    const [returns, dashboard] = await Promise.all([listReturns(scope), pkSalesTaxDashboard(scope)]);
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
      periodYear: z.number().int().min(2020).max(2100),
      periodMonth: z.number().int().min(1).max(12),
      strn: z.string().trim().nullish(),
      responsibleUserId: z.string().uuid().nullish(),
    }).parse(await request.json());
    return apiCreated(await createReturn(session, scope, b));
  } catch (error) {
    return handleApiError(error);
  }
}
