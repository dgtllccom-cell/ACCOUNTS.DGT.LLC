export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiClientError, apiCreated, apiOk, handleApiError, apiError } from "@/lib/api/response";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withKeyedLock } from "@/lib/db/keyed-lock";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { writeAuditLog } from "@/lib/api/supabase";
import { parseJsonish } from "@/lib/stock-journal/model";

const paymentSchema = z.object({
  loadingRecordId: z.string().uuid(),
  amount: z.coerce.number().positive("Payment amount must be greater than 0"),
  currency: z.string().trim().length(3).default("USD"),
  exchangeRate: z.coerce.number().positive().default(1),
  paymentDate: z.string().trim().default(() => new Date().toISOString().slice(0, 10)),
  paymentMethod: z.string().trim().default("Bank Transfer"),
  bankOrCashAccountId: z.string().trim().nullish(),
  bankOrCashAccountName: z.string().trim().nullish(),
  transporterAccountId: z.string().trim().nullish(),
  transporterName: z.string().trim().nullish(),
  truckNo: z.string().trim().nullish(),
  driverName: z.string().trim().nullish(),
  referenceNo: z.string().trim().max(120).nullish(),
  receiptNo: z.string().trim().max(120).nullish(),
  narration: z.string().trim().max(500).nullish(),
});

const updateChargesSchema = z.object({
  loadingRecordId: z.string().uuid(),
  transportCharges: z.coerce.number().min(0, "Transport charges must be >= 0"),
  currency: z.string().trim().length(3).default("USD"),
  transporterName: z.string().trim().nullish(),
  truckNo: z.string().trim().nullish(),
  driverName: z.string().trim().nullish(),
  driverMobile: z.string().trim().nullish(),
  transportMode: z.string().trim().nullish(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim().toLowerCase();
    const statusFilter = searchParams.get("status");

    const records = await withLocalPg(async (sql) => {
      const rows = await sql`
        select
          plr.id as loading_record_id,
          plr.loading_record_no,
          plr.purchase_order_id,
          plr.purchase_order_no,
          plr.container_number,
          plr.container_type,
          plr.loading_status,
          plr.loaded_at,
          plr.loading_location,
          plr.receiving_location,
          plr.carrier_name,
          plr.remarks,
          plr.report_payload,
          plr.created_at,
          po.order_total as purchase_bill_total,
          po.advance_paid as purchase_advance_paid,
          po.remaining_paid as purchase_remaining_paid,
          po.credit_amount as purchase_credit_amount,
          po.remaining_due as purchase_remaining_due,
          po.payment_status as purchase_payment_status,
          po.form_data as po_form_data,
          c.name as country_name,
          c.currency as country_currency,
          cb.name as branch_name
        from purchase_loading_records plr
        left join purchase_orders po on po.id = plr.purchase_order_id
        left join countries c on c.id = plr.country_id
        left join country_branches cb on cb.id = plr.country_branch_id
        where plr.deleted_at is null
        order by plr.created_at desc
        limit 500
      `;
      return rows;
    });

    const parsed = (records || []).map((row: any) => {
      const payload = parseJsonish(row.report_payload) || {};
      const poForm = parseJsonish(row.po_form_data)?.form || {};
      const goods = parseJsonish(row.po_form_data)?.goodsEntries || [];

      // Transport figures
      const transportMode = payload.transportMode || poForm.shippingMode || "By Sea";
      const transporterName = payload.transportCompany || poForm.transportCompany || row.carrier_name || "-";
      const truckNo = payload.vehicleNo || row.container_number || "-";
      const driverName = payload.driverName || "-";
      const driverMobile = payload.driverMobile || "-";

      // Transport charges & payments
      const transportCharges = Number(payload.transportCharges ?? payload.freightAmount ?? poForm.freightCharges ?? 0);
      const transportPayments = Array.isArray(payload.transportPayments) ? payload.transportPayments : [];
      const transportPaid = transportPayments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0)
        || Number(payload.transportPaid || 0);
      const transportBalance = Math.max(0, transportCharges - transportPaid);
      const transportCurrency = String(payload.transportCurrency || poForm.currency || row.country_currency || "USD");

      const isFullyPaid = transportCharges > 0 ? transportBalance <= 0.005 : transportPaid > 0;
      const paymentStatus = isFullyPaid ? "Fully Paid" : (transportPaid > 0 ? "Partially Paid" : "Unpaid");

      return {
        id: row.loading_record_id,
        loadingRecordNo: row.loading_record_no,
        purchaseOrderId: row.purchase_order_id,
        purchaseOrderNo: row.purchase_order_no || poForm.billNo || "-",
        billInvoiceNo: poForm.manualBillNo || poForm.billNo || poForm.invoiceNo || row.purchase_order_no || "-",
        supplierAccount: poForm.purchaseAccountName || poForm.supplierName || "-",
        goodsName: (Array.isArray(goods) && goods[0]?.itemName) || poForm.goodsName || "-",
        country: row.country_name || "-",
        branch: row.branch_name || "-",
        createdAt: row.created_at,
        loadedAt: row.loaded_at,
        loadingLocation: row.loading_location || "-",
        receivingLocation: row.receiving_location || "-",
        transportMode,
        transporterName,
        truckNo,
        driverName,
        driverMobile,
        transportCurrency,
        transportCharges,
        transportPaid,
        transportBalance,
        isFullyPaid,
        paymentStatus,
        payments: transportPayments,
        // Purchase bill figures kept strictly separate
        purchaseBillTotal: Number(row.purchase_bill_total || 0),
        purchaseTotalPaid: Number(row.purchase_advance_paid || 0) + Number(row.purchase_remaining_paid || 0) + Number(row.purchase_credit_amount || 0),
        purchaseRemainingDue: Number(row.purchase_remaining_due || 0),
        purchasePaymentStatus: row.purchase_payment_status || "pending"
      };
    });

    const filtered = parsed.filter((r: any) => {
      if (statusFilter === "paid" && !r.isFullyPaid) return false;
      if (statusFilter === "outstanding" && r.isFullyPaid) return false;
      if (!q) return true;
      return (
        r.purchaseOrderNo.toLowerCase().includes(q) ||
        r.billInvoiceNo.toLowerCase().includes(q) ||
        r.loadingRecordNo.toLowerCase().includes(q) ||
        r.transporterName.toLowerCase().includes(q) ||
        r.truckNo.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q) ||
        r.supplierAccount.toLowerCase().includes(q)
      );
    });

    return apiOk({ records: filtered, total: filtered.length });
  } catch (error) {
    return handleApiError(error);
  }
}

async function postTransportPayment(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = paymentSchema.parse(await request.json());

    const loadingRecord = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id, loading_record_no, purchase_order_id, purchase_order_no, report_payload, country_id, country_branch_id, city_branch_id
        from purchase_loading_records
        where id = ${body.loadingRecordId}::uuid and deleted_at is null
        limit 1
      `;
      return rows[0] || null;
    });

    if (!loadingRecord) {
      return apiError("NOT_FOUND", "Loading record not found", 404);
    }

    // the request must be inside the caller's country / branch scope and the caller must be allowed to post purchases
    authorizeApiScope(session, {
      resource: "purchases",
      action: "post",
      countryId: (loadingRecord as any).country_id ?? null,
      countryBranchId: (loadingRecord as any).country_branch_id ?? null,
      cityBranchId: (loadingRecord as any).city_branch_id ?? null
    });

    const currentPayload = parseJsonish(loadingRecord.report_payload) || {};
    const existingPayments = Array.isArray(currentPayload.transportPayments) ? currentPayload.transportPayments : [];

    const paymentRecord = {
      id: crypto.randomUUID(),
      loadingRecordId: body.loadingRecordId,
      loadingRecordNo: loadingRecord.loading_record_no,
      purchaseOrderNo: loadingRecord.purchase_order_no,
      amount: body.amount,
      currency: body.currency,
      exchangeRate: body.exchangeRate,
      paymentDate: body.paymentDate,
      paymentMethod: body.paymentMethod,
      bankOrCashAccountId: body.bankOrCashAccountId,
      bankOrCashAccountName: body.bankOrCashAccountName,
      transporterAccountId: body.transporterAccountId,
      transporterName: body.transporterName || currentPayload.transportCompany || "Transporter",
      truckNo: body.truckNo || currentPayload.vehicleNo || "-",
      driverName: body.driverName || currentPayload.driverName || "-",
      referenceNo: body.referenceNo || `TP-REF-${Date.now().toString().slice(-6)}`,
      receiptNo: body.receiptNo || `TR-REC-${Date.now().toString().slice(-6)}`,
      narration: body.narration || `Transport freight payment for PO #${loadingRecord.purchase_order_no || "-"}`,
      createdBy: session.fullName || session.userId || "Admin",
      createdAt: new Date().toISOString()
    };

    const newPayments = [paymentRecord, ...existingPayments];
    const newTotalPaid = newPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const transportCharges = Number(currentPayload.transportCharges || currentPayload.freightAmount || 0);
    const newBalance = Math.max(0, transportCharges - newTotalPaid);
    const chargesCcy = String(currentPayload.transportCurrency || body.currency).toUpperCase();
    if (transportCharges > 0 && body.currency.toUpperCase() === chargesCcy && newTotalPaid > transportCharges + 0.01) {
      const remainingBefore = Math.max(0, transportCharges - existingPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0));
      throw new ApiClientError(`Payment amount cannot exceed remaining transport balance (${remainingBefore.toFixed(2)} ${chargesCcy}).`, { status: 409, code: "BUSINESS_RULE" });
    }

    const updatedPayload = {
      ...currentPayload,
      transportPayments: newPayments,
      transportPaid: newTotalPaid,
      transportBalance: newBalance,
      transportLastPaymentDate: body.paymentDate
    };

    await withLocalPg(async (sql) => {
      await sql`
        update purchase_loading_records
        set report_payload = ${JSON.stringify(updatedPayload)}::jsonb,
            updated_at = now()
        where id = ${body.loadingRecordId}::uuid
      `;
    });

    await writeAuditLog({
      action: "create",
      entityTable: "purchase_loading_records",
      entityId: body.loadingRecordId,
      before: null,
      after: paymentRecord,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    return apiCreated({
      payment: paymentRecord,
      totalPaid: newTotalPaid,
      balanceRemaining: newBalance,
      isFullyPaid: newBalance <= 0.005
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function putTransportCharges(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = updateChargesSchema.parse(await request.json());

    const loadingRecord = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id, loading_record_no, report_payload, country_id, country_branch_id, city_branch_id
        from purchase_loading_records
        where id = ${body.loadingRecordId}::uuid and deleted_at is null
        limit 1
      `;
      return rows[0] || null;
    });

    if (!loadingRecord) {
      return apiError("NOT_FOUND", "Loading record not found", 404);
    }

    // the request must be inside the caller's country / branch scope and the caller must be allowed to post purchases
    authorizeApiScope(session, {
      resource: "purchases",
      action: "post",
      countryId: (loadingRecord as any).country_id ?? null,
      countryBranchId: (loadingRecord as any).country_branch_id ?? null,
      cityBranchId: (loadingRecord as any).city_branch_id ?? null
    });

    const currentPayload = parseJsonish(loadingRecord.report_payload) || {};
    const existingPayments = Array.isArray(currentPayload.transportPayments) ? currentPayload.transportPayments : [];
    const totalPaid = existingPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const newBalance = Math.max(0, body.transportCharges - totalPaid);

    const updatedPayload = {
      ...currentPayload,
      transportCharges: body.transportCharges,
      transportCurrency: body.currency,
      transportPaid: totalPaid,
      transportBalance: newBalance,
      transportCompany: body.transporterName || currentPayload.transportCompany,
      vehicleNo: body.truckNo || currentPayload.vehicleNo,
      driverName: body.driverName || currentPayload.driverName,
      driverMobile: body.driverMobile || currentPayload.driverMobile,
      transportMode: body.transportMode || currentPayload.transportMode
    };

    await withLocalPg(async (sql) => {
      await sql`
        update purchase_loading_records
        set report_payload = ${JSON.stringify(updatedPayload)}::jsonb,
            updated_at = now()
        where id = ${body.loadingRecordId}::uuid
      `;
    });

    return apiOk({
      transportCharges: body.transportCharges,
      transportPaid: totalPaid,
      transportBalance: newBalance,
      isFullyPaid: newBalance <= 0.005
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Both handlers read-modify-write ONE json document; run them one at a time per loading record so simultaneous requests cannot overwrite each other. */
async function serialised(request: NextRequest, run: () => Promise<Response>): Promise<Response> {
  try {
    const raw = await request.clone().json().catch(() => ({}));
    const id = typeof raw?.loadingRecordId === "string" ? raw.loadingRecordId : "";
    if (!id) return await run();
    return await withKeyedLock("transport-payment:" + id, run);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  return serialised(request, () => postTransportPayment(request));
}

export async function PUT(request: NextRequest) {
  return serialised(request, () => putTransportCharges(request));
}
