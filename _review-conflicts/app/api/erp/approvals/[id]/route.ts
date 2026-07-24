import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { approvalDecisionSchema, uuidSchema } from "@/lib/api/erp-validation";
import { auditApiAction } from "@/lib/api/audit";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { SupabaseApprovalsRepository } from "@/lib/api/approval-repository";
import { requireErpSession } from "@/lib/auth/session";
import { ApprovalService } from "@/lib/services/approval-service";

type ApprovalRow = {
  id: string;
  request_no: string;
  status: string;
  target_table: string;
  target_id: string;
  country_id: string | null;
  city_branch_id: string | null;
  after_data?: any;
  before_data?: any;
  action?: string;
  requested_by?: string;
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const approvalRequestId = uuidSchema.parse(id);
    const body = approvalDecisionSchema.parse(await request.json());

    const supabase = await createApiSupabaseClient();
    const currentResult = await supabase
      .from("approval_requests")
      .select("id, request_no, status, target_table, target_id, country_id, city_branch_id, after_data, before_data, action, requested_by")
      .eq("id", approvalRequestId)
      .single();

    if (currentResult.error) {
      throw new Error(currentResult.error.message);
    }

    const current = currentResult.data as ApprovalRow;
    const service = new ApprovalService(new SupabaseApprovalsRepository());

    if (body.action === "unlock") {
      await service.unlockRecord(session, {
        recordTable: body.recordTable ?? current.target_table,
        recordId: body.recordId ?? current.target_id
      });

      await auditApiAction(request, {
        action: "approval.unlock",
        entityTable: "approval_requests",
        entityId: approvalRequestId,
        before: current,
        after: {
          recordTable: body.recordTable ?? current.target_table,
          recordId: body.recordId ?? current.target_id,
          note: body.note ?? null
        }
      });

      return apiOk({
        approvalRequestId,
        action: body.action,
        status: current.status,
        unlocked: true
      });
    }

    const statusByAction = {
      approve: "approved",
      reject: "rejected",
      cancel: "cancelled"
    } as const;

    const nextStatus = statusByAction[body.action];

    await service.decide(session, {
      approvalRequestId,
      status: nextStatus,
      countryId: body.countryId ?? current.country_id,
      cityBranchId: body.cityBranchId ?? current.city_branch_id,
      note: body.note
    });

    if (nextStatus === "approved" && current.target_table === "daily_usd_rates") {
      const payload = current.after_data as any;
      if (payload) {
        // Query if daily_usd_rates row with current.target_id exists
        const { data: existingRate } = await supabase
          .from("daily_usd_rates")
          .select("id")
          .eq("id", current.target_id)
          .maybeSingle();

        let savedRate;
        if (existingRate?.id) {
          const { data, error } = await supabase
            .from("daily_usd_rates")
            .update({
              ...payload,
              approved_by: session.userId,
              approved_at: new Date().toISOString(),
              approval_request_id: current.id
            })
            .eq("id", current.target_id)
            .select("*")
            .single();
          if (error) throw new Error(error.message);
          savedRate = data;
        } else {
          const { data, error } = await supabase
            .from("daily_usd_rates")
            .insert({
              id: current.target_id,
              ...payload,
              approved_by: session.userId,
              approved_at: new Date().toISOString(),
              approval_request_id: current.id
            })
            .select("*")
            .single();
          if (error) throw new Error(error.message);
          savedRate = data;
        }

        // Also insert into exchange_rate_history
        const { error: histError } = await supabase.from("exchange_rate_history").insert({
          country_id: payload.country_id,
          from_currency: "LOCAL",
          to_currency: "USD",
          old_rate: (current.before_data as any)?.selling_rate ?? null,
          new_rate: payload.selling_rate,
          effective_date: payload.rate_date,
          changed_by: current.requested_by,
          reason: "USD rate approved from approval queue."
        });
        if (histError) throw new Error(histError.message);
      }

      // Unlock the record lock
      await service.unlockRecord(session, {
        recordTable: current.target_table,
        recordId: current.target_id
      });
    }

    if (nextStatus === "rejected" || nextStatus === "cancelled") {
      await service.unlockRecord(session, {
        recordTable: current.target_table,
        recordId: current.target_id
      });
    }

    await auditApiAction(request, {
      action: `approval.${body.action}`,
      entityTable: "approval_requests",
      entityId: approvalRequestId,
      before: current,
      after: {
        status: nextStatus,
        note: body.note ?? null
      }
    });

    return apiOk({
      approvalRequestId,
      requestNo: current.request_no,
      action: body.action,
      status: nextStatus
    });
  } catch (error) {
    return handleApiError(error);
  }
}
