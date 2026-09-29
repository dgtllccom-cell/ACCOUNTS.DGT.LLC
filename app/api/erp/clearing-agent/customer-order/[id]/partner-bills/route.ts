import { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { canAccessOrder } from "@/lib/services/clearing-customer-order-scope";
import { getRequestLanguage } from "@/lib/i18n/server";
import {
  listPartnerBillsForOrder,
  createOrUpdatePartnerBill,
  approveAndPostPartnerBill,
  recordPartnerBillPayment
} from "@/lib/services/clearing-partner-bill-service";
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
    const data = await listPartnerBillsForOrder(id);
    return apiOk({ ...data, lang });
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
    const action = body.action || "create_bill";

    if (action === "create_bill") {
      const bill = await createOrUpdatePartnerBill(
        {
          orderId: id,
          legId: body.legId,
          providerAccountId: body.providerAccountId,
          expenseAccountId: body.expenseAccountId,
          agentName: body.agentName,
          countryOfService: body.countryOfService,
          invoiceRef: body.invoiceRef,
          expenseCategory: body.expenseCategory,
          totalAmount: Number(body.totalAmount),
          currencyCode: body.currencyCode,
          exchangeRate: Number(body.exchangeRate || 1),
          remarks: body.remarks,
          supportingDocuments: body.supportingDocuments,
          customsDuty: Number(body.customsDuty || 0),
          portCharges: Number(body.portCharges || 0),
          demurrageCharges: Number(body.demurrageCharges || 0),
          clearanceFee: Number(body.clearanceFee || 0),
          freightCharges: Number(body.freightCharges || 0),
          otherCharges: Number(body.otherCharges || 0)
        },
        session.userId,
        {
          countryId: session.countryIds?.[0] ?? null,
          countryBranchId: session.countryBranchIds?.[0] ?? null,
          cityBranchId: session.cityBranchIds?.[0] ?? null
        }
      );

      await auditApiAction(req, {
        action: "clearing.partner_bill.create",
        entityTable: "clearing_payment_bills",
        entityId: bill?.id || "",
        after: bill
      });

      return apiOk({ success: true, code: "BILL_DRAFT_CREATED", bill });
    }

    if (action === "approve_bill") {
      if (!body.billId) {
        throw new ApiClientError("billId is required to approve bill.", { status: 400 });
      }

      const res = await approveAndPostPartnerBill(body.billId, session.userId, {
        isSuperAdmin: session.isSuperAdmin,
        countryId: session.countryIds?.[0] ?? null,
        countryBranchId: session.countryBranchIds?.[0] ?? null,
        cityBranchId: session.cityBranchIds?.[0] ?? null
      });

      await auditApiAction(req, {
        action: "clearing.partner_bill.approve",
        entityTable: "clearing_payment_bills",
        entityId: body.billId,
        after: res
      });

      return apiOk({ success: true, code: "BILL_APPROVED_AND_POSTED", ...res });
    }

    if (action === "record_payment") {
      if (!body.billId) {
        throw new ApiClientError("billId is required to record payment.", { status: 400 });
      }
      if (!body.paymentAccountId) {
        throw new ApiClientError("Payment bank/cash account is required.", { status: 400, code: "ACCOUNT_REQUIRED" });
      }

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
        action: "clearing.partner_bill.payment",
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
