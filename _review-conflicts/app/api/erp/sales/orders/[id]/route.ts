import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  id: uuidSchema
});

const salesOrderUpdateSchema = z.object({
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  customerAccountId: uuidSchema.optional().nullable(),
  customerLedgerId: uuidSchema.optional().nullable(),
  purchaseOrderId: uuidSchema.optional().nullable(),
  salesOrderNo: z.string().optional(),
  salesContractNo: z.string().optional().nullable(),
  orderDate: z.string().optional(),
  customerName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  manualReferenceNumber: z.string().optional().nullable(),
  customerNumber: z.string().optional().nullable(),
  productSummary: z.string().optional().nullable(),
  quantity: z.number().optional(),
  totalWeight: z.number().optional(),
  currencyCode: z.string().optional(),
  exchangeRate: z.number().optional(),
  orderTotal: z.number().optional(),
  paidAmount: z.number().optional(),
  remainingAmount: z.number().optional(),
  salesStatus: z.string().optional(),
  paymentStatus: z.string().optional(),
  deliveryStatus: z.string().optional(),
  workflowState: z.unknown().optional(),
  formData: z.unknown().optional()
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);

    const supabase = await createApiSupabaseClient();
    const row = await requireSupabaseData(
      supabase
        .from("sales_orders")
        .select("*")
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    );

    if (!row) {
      return NextResponse.json({ ok: false, error: { message: "Sales order not found" } }, { status: 404 });
    }

    authorizeApiScope(session, {
      resource: "sales",
      action: "read",
      countryId: (row as any).country_id,
      countryBranchId: (row as any).country_branch_id,
      cityBranchId: (row as any).city_branch_id
    });

    return apiOk({ order: row });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);
    const body = salesOrderUpdateSchema.parse(await request.json());

    const supabase = await createApiSupabaseClient();
    const before = await requireSupabaseData(
      supabase
        .from("sales_orders")
        .select("*")
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    );

    if (!before) {
      return NextResponse.json({ ok: false, error: { message: "Sales order not found" } }, { status: 404 });
    }

    // Sales Order becomes read-only after transfer
    const currentStatus = String((before as any).sales_status || "").toLowerCase();
    if (currentStatus === "transferred" || currentStatus === "finalized" || currentStatus === "completed") {
      return NextResponse.json({ ok: false, error: { message: "This Sales Order has already been transferred and is read-only." } }, { status: 400 });
    }

    authorizeApiScope(session, {
      resource: "sales",
      action: "update",
      countryId: (before as any).country_id,
      countryBranchId: (before as any).country_branch_id,
      cityBranchId: (before as any).city_branch_id
    });

    const patch: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (body.countryId !== undefined) patch.country_id = body.countryId;
    if (body.countryBranchId !== undefined) patch.country_branch_id = body.countryBranchId;
    if (body.cityBranchId !== undefined) patch.city_branch_id = body.cityBranchId;
    if (body.customerAccountId !== undefined) patch.customer_account_id = body.customerAccountId;
    if (body.customerLedgerId !== undefined) patch.customer_ledger_id = body.customerLedgerId;
    if (body.purchaseOrderId !== undefined) patch.purchase_order_id = body.purchaseOrderId;
    if (body.salesOrderNo !== undefined) patch.sales_order_no = body.salesOrderNo;
    if (body.salesContractNo !== undefined) patch.sales_contract_no = body.salesContractNo;
    if (body.orderDate !== undefined) patch.order_date = body.orderDate;
    if (body.customerName !== undefined) patch.customer_name = body.customerName;
    if (body.accountNumber !== undefined) patch.account_number = body.accountNumber;
    if (body.manualReferenceNumber !== undefined) patch.manual_reference_number = body.manualReferenceNumber;
    if (body.customerNumber !== undefined) patch.customer_number = body.customerNumber;
    if (body.productSummary !== undefined) patch.product_summary = body.productSummary;
    if (body.quantity !== undefined) patch.quantity = body.quantity;
    if (body.totalWeight !== undefined) patch.total_weight = body.totalWeight;
    if (body.currencyCode !== undefined) patch.currency_code = body.currencyCode;
    if (body.exchangeRate !== undefined) patch.exchange_rate = body.exchangeRate;
    if (body.orderTotal !== undefined) patch.order_total = body.orderTotal;
    if (body.paidAmount !== undefined) patch.paid_amount = body.paidAmount;
    if (body.remainingAmount !== undefined) patch.remaining_amount = body.remainingAmount;
    
    if (body.salesStatus !== undefined) {
      patch.sales_status = body.salesStatus;
      
      const targetStatus = String(body.salesStatus).toLowerCase();
      if (targetStatus === "transferred" || targetStatus === "finalized" || targetStatus === "completed") {
        patch.sales_status = "Transferred";
        patch.transfer_date = new Date().toISOString().slice(0, 10);
        patch.transfer_user = session.fullName || session.email || "Admin User";
        
        // Generate transfer serial number
        try {
          const admin = createSupabaseAdminClient() as any;
          const { data: generatedSerial } = await admin.rpc("next_transaction_serial", {
            p_scope_type: "transfer",
            p_scope_key: (before as any).country_id || "global",
            p_prefix: "TR"
          });
          patch.transfer_serial_number = generatedSerial || `TR-${Math.floor(100000 + Math.random() * 900000)}`;
        } catch (serialErr) {
          console.error("Non-fatal: Failed to generate transfer serial number:", serialErr);
          patch.transfer_serial_number = `TR-${Math.floor(100000 + Math.random() * 900000)}`;
        }

        // Automatic Accounting Posting: JV, Roznamcha, Cash Roznamcha, General Ledger
        const finalCost = Number(body.orderTotal ?? before.order_total ?? 0) * Number(body.exchangeRate ?? before.exchange_rate ?? 1);
        const raw = body.formData || before.form_data || {};
        const f = raw.form || {};
        
        const purchaseAccountCode = f.purchaseAccountNo;
        const salesAccountCode = f.salesAccountNo;
        
        if (purchaseAccountCode && salesAccountCode && finalCost > 0) {
          try {
            const entryNo = `JV-SO-${Math.floor(100000 + Math.random() * 900000)}`;
            const memo = `Sales Order Transfer - ${body.customerName || before.customer_name || "Customer"} (${body.productSummary || before.product_summary || "Goods"})`;
            const admin = createSupabaseAdminClient() as any;

            const { data: foundAccounts } = await admin
              .from("accounts")
              .select("id, code")
              .in("code", [purchaseAccountCode, salesAccountCode]);

            const debitAccObj = foundAccounts?.find(a => a.code === purchaseAccountCode);
            const creditAccObj = foundAccounts?.find(a => a.code === salesAccountCode);

            if (debitAccObj && creditAccObj) {
              const { data: journalEntry } = await admin
                .from("journal_entries")
                .insert({
                  company_id: (before as any).company_id,
                  entry_no: entryNo,
                  entry_date: new Date().toISOString().slice(0, 10),
                  status: "posted",
                  memo: memo,
                  source_type: "sales_order",
                  source_id: (before as any).id,
                  posted_at: new Date().toISOString(),
                  posted_by: session.userId,
                })
                .select()
                .single();

              if (journalEntry) {
                // Save generated JV Serial inside Sales Order workflow state / trace
                patch.workflow_state = {
                  ...(before.workflow_state || {}),
                  journal_serial_number: entryNo
                };
                
                await admin.from("journal_lines").insert([
                  {
                    journal_entry_id: journalEntry.id,
                    account_id: debitAccObj.id,
                    description: `Debit: Customer Ledger - ${body.customerName || before.customer_name || "Customer"}`,
                    debit: finalCost,
                    credit: 0
                  },
                  {
                    journal_entry_id: journalEntry.id,
                    account_id: creditAccObj.id,
                    description: `Credit: Sales Ledger - ${body.productSummary || before.product_summary || "Goods"}`,
                    debit: 0,
                    credit: finalCost
                  }
                ]);
              }
            }
          } catch (journalErr) {
            console.error("Non-fatal: Sales journal entry auto-posting error:", journalErr);
          }
        }
      }
    }
    
    if (body.paymentStatus !== undefined) patch.payment_status = body.paymentStatus;
    if (body.deliveryStatus !== undefined) patch.delivery_status = body.deliveryStatus;
    
    if (body.workflowState !== undefined) {
      patch.workflow_state = {
        ...(before.workflow_state || {}),
        ...(typeof body.workflowState === "object" && body.workflowState !== null ? body.workflowState : {})
      };
    }
    
    if (body.formData !== undefined) {
      patch.form_data = {
        ...(before.form_data || {}),
        ...(typeof body.formData === "object" && body.formData !== null ? body.formData : {})
      };
    }

    const { data: updated, error } = await supabase
      .from("sales_orders")
      .update(patch)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    await writeAuditLog({
      action: "update",
      entityTable: "sales_orders",
      entityId: params.id,
      before,
      after: updated,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    return apiOk({ order: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);

    const supabase = await createApiSupabaseClient();
    const before = await requireSupabaseData(
      supabase
        .from("sales_orders")
        .select("*")
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    );

    if (!before) {
      return NextResponse.json({ ok: false, error: { message: "Sales order not found" } }, { status: 404 });
    }

    authorizeApiScope(session, {
      resource: "sales",
      action: "delete",
      countryId: (before as any).country_id,
      countryBranchId: (before as any).country_branch_id,
      cityBranchId: (before as any).city_branch_id
    });

    const { data: deleted, error } = await supabase
      .from("sales_orders")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    await writeAuditLog({
      action: "delete",
      entityTable: "sales_orders",
      entityId: params.id,
      before,
      after: deleted,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
