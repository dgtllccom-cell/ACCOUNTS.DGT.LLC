import { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { canAccessOrder } from "@/lib/services/clearing-customer-order-scope";
import { getRequestLanguage } from "@/lib/i18n/server";
import {
  listInsurancePoliciesForOrder,
  createOrUpdateInsurancePolicy,
  cancelInsurancePolicy,
  createInsurancePremiumBill
} from "@/lib/services/clearing-insurance-service";
// Reused, unmodified: the same generic posting/payment pipeline already
// E2E-verified for external partner bills. An insurance premium bill is just
// another clearing_payment_bills row (see clearing-insurance-service.ts).
import { approveAndPostPartnerBill, recordPartnerBillPayment } from "@/lib/services/clearing-partner-bill-service";
import { auditApiAction } from "@/lib/api/audit";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;

    const access = await canAccessOrder(id, session);
    if (!access) {
      throw new ApiClientError("Access denied to customer order.", { status: 403, code: "FORBIDDEN" });
    }

    const lang = await getRequestLanguage();
    const policies = await listInsurancePoliciesForOrder(id);
    return apiOk({ policies, lang });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;

    const access = await canAccessOrder(id, session);
    if (!access) {
      throw new ApiClientError("Access denied to customer order.", { status: 403, code: "FORBIDDEN" });
    }

    const body = await req.json();
    const action = body.action || "create_policy";

    if (action === "create_policy" || action === "update_policy") {
      const policy = await createOrUpdateInsurancePolicy(
        {
          orderId: id,
          insurerName: body.insurerName,
          insurerAccountId: body.insurerAccountId,
          policyNo: body.policyNo,
          coveredCargo: body.coveredCargo,
          insuredValue: Number(body.insuredValue),
          currency: body.currency,
          coverageFrom: body.coverageFrom,
          coverageTo: body.coverageTo,
          territory: body.territory,
          fromLegNo: Number(body.fromLegNo),
          toLegNo: Number(body.toLegNo),
          premiumAmount: body.premiumAmount != null ? Number(body.premiumAmount) : null,
          premiumCurrency: body.premiumCurrency,
          remarks: body.remarks
        },
        session.userId,
        action === "update_policy" ? body.policyId : null
      );

      await auditApiAction(req, {
        action: action === "update_policy" ? "clearing.insurance_policy.update" : "clearing.insurance_policy.create",
        entityTable: "clearing_order_insurance_policies",
        entityId: policy?.id || "",
        after: policy
      });

      return apiOk({ success: true, code: action === "update_policy" ? "POLICY_UPDATED" : "POLICY_CREATED", policy });
    }

    if (action === "cancel_policy") {
      if (!body.policyId) throw new ApiClientError("policyId is required to cancel a policy.", { status: 400 });
      const policy = await cancelInsurancePolicy(body.policyId, id);
      await auditApiAction(req, {
        action: "clearing.insurance_policy.cancel",
        entityTable: "clearing_order_insurance_policies",
        entityId: body.policyId,
        after: policy
      });
      return apiOk({ success: true, code: "POLICY_CANCELLED", policy });
    }

    if (action === "create_bill") {
      if (!body.policyId) throw new ApiClientError("policyId is required to create a premium bill.", { status: 400 });
      const bill = await createInsurancePremiumBill(body.policyId, session.userId);
      await auditApiAction(req, {
        action: "clearing.insurance_bill.create",
        entityTable: "clearing_payment_bills",
        entityId: bill?.id || "",
        after: bill
      });
      return apiOk({ success: true, code: "BILL_DRAFT_CREATED", bill });
    }

    if (action === "approve_bill") {
      if (!body.billId) throw new ApiClientError("billId is required to approve bill.", { status: 400 });
      const res = await approveAndPostPartnerBill(body.billId, session.userId, {
        isSuperAdmin: session.isSuperAdmin,
        countryId: session.countryIds?.[0] ?? null,
        countryBranchId: session.countryBranchIds?.[0] ?? null,
        cityBranchId: session.cityBranchIds?.[0] ?? null
      });
      await auditApiAction(req, {
        action: "clearing.insurance_bill.approve",
        entityTable: "clearing_payment_bills",
        entityId: body.billId,
        after: res
      });
      return apiOk({ success: true, code: "BILL_APPROVED_AND_POSTED", ...res });
    }

    if (action === "record_payment") {
      if (!body.billId) throw new ApiClientError("billId is required to record payment.", { status: 400 });
      if (!body.paymentAccountId) throw new ApiClientError("Payment bank/cash account is required.", { status: 400, code: "ACCOUNT_REQUIRED" });

      const res = await recordPartnerBillPayment(
        {
          billId: body.billId,
          amount: Number(body.amount),
          paymentAccountId: body.paymentAccountId,
          paymentDate: body.paymentDate,
          paymentMethod: body.paymentMethod,
          referenceNo: body.referenceNo,
          narration: body.narration
        },
        session.userId
      );

      await auditApiAction(req, {
        action: "clearing.insurance_bill.payment",
        entityTable: "clearing_payment_bill_payments",
        entityId: res.payment.id,
        after: res
      });

      return apiOk({ success: true, code: "PAYMENT_RECORDED", ...res });
    }

    throw new ApiClientError(`Unknown action: ${action}`, { status: 400 });
  } catch (error) {
    return handleApiError(error);
  }
}
