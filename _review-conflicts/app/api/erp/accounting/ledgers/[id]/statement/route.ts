import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { ledgerStatementQuerySchema, uuidSchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, {
      resource: "ledgers",
      action: "read",
      countryId: request.nextUrl.searchParams.get("countryId"),
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId"),
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId")
    });

    const { id } = await context.params;
    const ledgerId = uuidSchema.parse(id);
    const query = ledgerStatementQuerySchema.parse({
      fromDate: request.nextUrl.searchParams.get("fromDate"),
      toDate: request.nextUrl.searchParams.get("toDate")
    });

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase.rpc("get_ledger_statement", {
      p_ledger_id: ledgerId,
      p_from_date: query.fromDate,
      p_to_date: query.toDate
    });

    if (error) {
      throw new Error(error.message);
    }

    return apiOk({
      ledgerId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      statement: data ?? []
    });
  } catch (error) {
    return handleApiError(error);
  }
}
