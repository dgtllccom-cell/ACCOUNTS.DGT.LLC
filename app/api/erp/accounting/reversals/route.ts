import { NextRequest } from "next/server";
import { apiCreated, handleApiError } from "@/lib/api/response";
import { reversalSchema } from "@/lib/api/erp-validation";
import { requireApprovedActionUnlessSuperAdmin } from "@/lib/api/approval-guards";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";

type SourceScope = {
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = reversalSchema.parse(await request.json());
    const supabase = await createApiSupabaseClient();

    const sourceTable = body.sourceType === "ledger_batch" ? "ledger_posting_batches" : "roznamcha_entries";
    const sourceResult = await supabase
      .from(sourceTable)
      .select("country_id, country_branch_id, city_branch_id")
      .eq("id", body.sourceId)
      .is("deleted_at", null)
      .single();

    if (sourceResult.error) {
      throw new Error(sourceResult.error.message);
    }

    const source = sourceResult.data as SourceScope;

    authorizeApiScope(session, {
      resource: body.sourceType === "ledger_batch" ? "journal_entries" : "roznamcha",
      action: "post",
      countryId: source.country_id,
      countryBranchId: source.country_branch_id,
      cityBranchId: source.city_branch_id
    });

    const approvalError = await requireApprovedActionUnlessSuperAdmin({
      session,
      approvalRequestId: body.approvalRequestId,
      targetTable: sourceTable,
      targetId: body.sourceId,
      action: "reverse"
    });

    if (approvalError) return approvalError;

    const rpcName = body.sourceType === "ledger_batch" ? "reverse_enterprise_ledger_batch" : "reverse_roznamcha_entry";
    const args =
      body.sourceType === "ledger_batch"
        ? {
            p_original_batch_id: body.sourceId,
            p_reason: body.reason,
            p_approval_request_id: body.approvalRequestId ?? null
          }
        : {
            p_original_entry_id: body.sourceId,
            p_reason: body.reason,
            p_approval_request_id: body.approvalRequestId ?? null
          };

    const { data, error } = await supabase.rpc(rpcName, args);

    if (error) {
      throw new Error(error.message);
    }

    return apiCreated({
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      reversalId: data as string
    });
  } catch (error) {
    return handleApiError(error);
  }
}
