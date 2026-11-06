import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeLogistics } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { listPurchaseLaneTracking } from "@/lib/services/purchase-lane-service";
import { getRequestLanguage } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeLogistics(session, { action: "read" });
    void await getRequestLanguage(request.nextUrl.searchParams.get("lang")); // Existing references, codes and quantities only.
    const input = z.object({ id: z.string().uuid().optional(), q: z.string().trim().max(200).optional() }).parse(Object.fromEntries(request.nextUrl.searchParams));
    return apiOk({ rows: await listPurchaseLaneTracking(session, input) });
  } catch (error) { return handleApiError(error); }
}
