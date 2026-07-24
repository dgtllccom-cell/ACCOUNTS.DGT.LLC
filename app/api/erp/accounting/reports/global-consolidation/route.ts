import { NextRequest } from "next/server";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { globalConsolidationQuerySchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, {
      resource: "reports",
      action: "read"
    });

    if (!session.isSuperAdmin) {
      return apiError("FORBIDDEN", "Only Super Admin can view global consolidation", 403);
    }

    const query = globalConsolidationQuerySchema.parse({
      fromDate: request.nextUrl.searchParams.get("fromDate"),
      toDate: request.nextUrl.searchParams.get("toDate")
    });

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase.rpc("get_global_financial_consolidation", {
      p_from_date: query.fromDate,
      p_to_date: query.toDate
    });

    if (error) {
      throw new Error(error.message);
    }

    return apiOk({
      fromDate: query.fromDate,
      toDate: query.toDate,
      currency: "USD",
      rows: data ?? []
    });
  } catch (error) {
    return handleApiError(error);
  }
}
