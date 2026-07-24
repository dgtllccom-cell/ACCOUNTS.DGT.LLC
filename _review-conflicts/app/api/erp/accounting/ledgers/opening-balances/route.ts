import { NextRequest } from "next/server";
import { apiCreated, handleApiError } from "@/lib/api/response";
import { openingBalanceSchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = openingBalanceSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "ledgers",
      action: "update"
    });

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase.rpc("post_ledger_opening_balance", {
      p_ledger_id: body.ledgerId,
      p_financial_period_id: body.financialPeriodId,
      p_opening_balance: body.openingBalance,
      p_approval_request_id: body.approvalRequestId ?? null
    });

    if (error) {
      throw new Error(error.message);
    }

    return apiCreated({
      openingBalanceId: data as string
    });
  } catch (error) {
    return handleApiError(error);
  }
}
