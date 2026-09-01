import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { listCalls, callSummary, mapCallError } from "@/lib/ai-receptionist/service";
import { aiCallStatusReport } from "@/lib/ai-receptionist/config";

/** GET /api/erp/ai-calls — scoped AI Receptionist call register. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "customers", action: "read" });
    const p = request.nextUrl.searchParams;
    try {
      const [rows, summary] = await Promise.all([
        listCalls(session, {
          direction: p.get("direction") || undefined,
          status: p.get("status") || undefined,
          limit: p.get("limit") ? Number(p.get("limit")) : undefined,
        }),
        callSummary(session),
      ]);
      return apiOk({ rows, summary, telephony: aiCallStatusReport() });
    } catch (err) {
      const mapped = mapCallError(err);
      if (mapped.setupPending) return apiOk({ rows: [], summary: {}, setupPending: true, telephony: aiCallStatusReport() });
      throw err;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
