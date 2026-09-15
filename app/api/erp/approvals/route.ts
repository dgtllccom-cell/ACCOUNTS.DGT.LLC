import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { approvalCreateSchema } from "@/lib/api/erp-validation";
import { auditApiAction } from "@/lib/api/audit";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { SupabaseApprovalsRepository } from "@/lib/api/approval-repository";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { ApprovalService } from "@/lib/services/approval-service";

export async function GET() {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "approvals", action: "read" });

    const supabase = await createApiSupabaseClient();
    let query = supabase
      .from("approval_requests")
      .select(
        "id, request_no, action, status, target_table, target_id, country_id, country_branch_id, city_branch_id, requested_by, approved_by, rejected_by, decided_at, reason, rejection_reason, created_at, updated_at"
      )
      .is("deleted_at", null);

    // createApiSupabaseClient() returns a service-role client in production
    // (bypasses RLS) — scope must be enforced here explicitly for anyone who
    // isn't a Super Admin, matching can_approve_erp_scope's DB-side rule.
    if (!session.isSuperAdmin) {
      if (session.countryIds.length === 0) {
        return apiOk({ approvals: [], limit: 50 });
      }
      query = query.in("country_id", session.countryIds);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(50);

    if (error) {
      throw new Error(error.message);
    }

    return apiOk({
      approvals: data ?? [],
      limit: 50
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = approvalCreateSchema.parse(await request.json());

    const service = new ApprovalService(new SupabaseApprovalsRepository());
    const approval = await service.requestApproval(session, body);

    await auditApiAction(request, {
      action: `approval.request.${body.action}`,
      entityTable: "approval_requests",
      entityId: approval.id,
      after: {
        requestNo: approval.requestNo,
        targetTable: body.targetTable,
        targetId: body.targetId,
        resource: body.resource,
        action: body.action
      }
    });

    return apiCreated({
      approval,
      status: "pending",
      locked: {
        targetTable: body.targetTable,
        targetId: body.targetId
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
