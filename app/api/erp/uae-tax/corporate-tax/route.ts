import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { createReturn, ctDashboard, listReturns } from "@/lib/services/uae-corporate-tax-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { scope } = await guardUaeTax("read");
    const [returns, dashboard] = await Promise.all([listReturns(scope), ctDashboard(scope)]);
    return apiOk({ returns, dashboard });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, scope } = await guardUaeTax("write");
    const b = z.object({
      taxEntityId: z.string().uuid(),
      fyStart: z.string(),
      fyEnd: z.string(),
      ctTrn: z.string().trim().nullish(),
      responsibleUserId: z.string().uuid().nullish(),
    }).parse(await request.json());
    return apiCreated(await createReturn(session, scope, b));
  } catch (error) {
    return handleApiError(error);
  }
}
