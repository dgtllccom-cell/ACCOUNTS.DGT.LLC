import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { checkRoute } from "@/lib/services/clearing-order-route-insurance-service";

export const dynamic = "force-dynamic";

/** Route check for the legs being edited (before save): land borders, crossings, gaps, ports. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { legs } = z.object({ legs: z.array(z.record(z.string(), z.any())).max(30) }).parse(await request.json());
    return apiOk({ issues: await checkRoute(legs) });
  } catch (error) {
    return handleApiError(error);
  }
}
