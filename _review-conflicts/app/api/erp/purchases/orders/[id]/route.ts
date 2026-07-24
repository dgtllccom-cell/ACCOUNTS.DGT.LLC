import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { purchaseOrderUpdateSchema, uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revertOrderBookingTransfer, revertAllOrderPayments } from "@/lib/services/purchase-payment-reversal";
import {
  safeInsertPurchaseOrderItems,
  safeDeletePurchaseOrderItems,
  safeInsertPurchaseOrderExpenses,
  safeDeletePurchaseOrderExpenses,
  ensurePurchaseSchemaAndEnums
} from "@/lib/services/purchase-table-manager";
import { revalidatePath } from "next/cache";

const paramsSchema = z.object({
  id: uuidSchema
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);

    const supabase = await createApiSupabaseClient();
    const row = await requireSupabaseData(
      supabase
        .from("purchase_orders")
        .select(
          "id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id, supplier_company_id, companies(name), currency_code, exchange_rate, order_total, advance_paid, remaining_paid, credit_amount, remaining_due, payment_status, ledger_posting_status, form_data, created_at, updated_at"
        )
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    );

    authorizeApiScope(session, {
      resource: "purchases",
      action: "read",
      countryId: (row as any)?.country_id ?? null,
      countryBranchId: (row as any)?.country_branch_id ?? null,
      cityBranchId: (row as any)?.city_branch_id ?? null
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
    const body = purchaseOrderUpdateSchema.parse(await request.json());

    const supabase = await createApiSupabaseClient();
    const before = await requireSupabaseData(
      supabase
        .from("purchase_orders")
        .select(
          "id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id, supplier_company_id, currency_code, exchange_rate, order_total, form_data, created_at, ledger_posting_status"
        )
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    );

    authorizeApiScope(session, {
      resource: "purchases",
      action: "update",
      countryId: (before as any)?.country_id ?? null,
      countryBranchId: (before as any)?.country_branch_id ?? null,
      cityBranchId: (before as any)?.city_branch_id ?? null
    });

    // --- ENFORCE STRICT LOCK ON TRANSFERRED ORDERS ---
    if ((before as any)?.ledger_posting_status === "transferred" || (before as any)?.ledger_posting_status === "posted") {
      // If this is a transfer request itself, and they had previously successfully edited it, allow the transfer
      const isReTransferRequest = body.ledgerPostingStatus === "transferred" || body.ledgerPostingStatus === "posted";
      
      if (!session.isSuperAdmin && !isReTransferRequest) {
        return handleApiError(new Error("Bill is transferred/posted and locked. Admin approval is required to edit or reverse."));
      }
    }
    // -------------------------------------------------

    const isAlreadyPostedOrTransferred = (before as any)?.ledger_posting_status === "posted" || (before as any)?.ledger_posting_status === "transferred";
    const isRevertingOrEditing = isAlreadyPostedOrTransferred && (
      body.ledgerPostingStatus === "draft" ||
      body.ledgerPostingStatus === "pending" ||
      body.ledgerPostingStatus === "cancelled" ||
      body.orderTotal !== undefined ||
      body.formData !== undefined ||
      body.items !== undefined
    );

    if (isRevertingOrEditing) {
      const adminSupabase = createSupabaseAdminClient() as any;

      // 1. Revert the booking transfer Roznamcha entry if it exists
      const { data: existingRoz } = await supabase
        .from("roznamcha_entries")
        .select("id")
        .eq("journal_no", (before as any).purchase_order_no)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingRoz) {
        const { data: lines } = await supabase
          .from("roznamcha_lines")
          .select("ledger_id, enterprise_account_id, debit, credit")
          .eq("roznamcha_entry_id", existingRoz.id);

        if (lines && lines.length > 0) {
          for (const line of lines) {
            const { data: ledger } = await adminSupabase
              .from("ledgers")
              .select("debit_total, credit_total, current_balance")
              .eq("id", line.ledger_id)
              .maybeSingle();
            if (ledger) {
              await adminSupabase
                .from("ledgers")
                .update({
                  debit_total: Number(ledger.debit_total || 0) - Number(line.debit || 0),
                  credit_total: Number(ledger.credit_total || 0) - Number(line.credit || 0),
                  current_balance: Number(ledger.current_balance || 0) - Number(line.debit || 0) + Number(line.credit || 0),
                  updated_at: new Date().toISOString()
                })
                .eq("id", line.ledger_id);
            }

            if (line.enterprise_account_id) {
              const { data: entAcc } = await adminSupabase
                .from("enterprise_accounts")
                .select("current_balance")
                .eq("id", line.enterprise_account_id)
                .maybeSingle();
              if (entAcc) {
                await adminSupabase
                  .from("enterprise_accounts")
                  .update({
                    current_balance: Number(entAcc.current_balance || 0) - Number(line.debit || 0) + Number(line.credit || 0),
                    updated_at: new Date().toISOString()
                  })
                  .eq("id", line.enterprise_account_id);
              }
            }
          }
        }

        await adminSupabase
          .from("roznamcha_entries")
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", existingRoz.id);
      }

      // 2. Revert ALL payments and their ledger/roznamcha entries
      await revertAllOrderPayments(params.id, supabase, adminSupabase);

      // 3. Soft-delete the payments records
      await supabase
        .from("purchase_order_payments")
        .update({ 
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("purchase_order_id", params.id);
    }

    const patch: Record<string, unknown> = {};
    if (isRevertingOrEditing) {
      patch.advance_paid = 0;
      patch.remaining_paid = 0;
      patch.credit_amount = 0;
      patch.remaining_due = body.orderTotal !== undefined ? body.orderTotal : (before as any).order_total;
      patch.payment_status = "pending";
    }
    if (body.countryId !== undefined) patch.country_id = body.countryId ?? null;
    if (body.countryBranchId !== undefined) patch.country_branch_id = body.countryBranchId ?? null;
    if (body.cityBranchId !== undefined) patch.city_branch_id = body.cityBranchId ?? null;
    if (body.supplierCompanyId !== undefined) patch.supplier_company_id = body.supplierCompanyId ?? null;
    if (body.purchaseContractNo !== undefined) patch.purchase_contract_no = body.purchaseContractNo?.trim() || null;
    if (body.currencyCode !== undefined) {
      patch.currency_code = body.currencyCode;
      patch.purchase_currency = body.currencyCode;
    }
    if (body.paymentCurrencyCode !== undefined) patch.payment_currency = body.paymentCurrencyCode;
    if (body.exchangeRate !== undefined) patch.exchange_rate = body.exchangeRate;
    if (body.orderTotal !== undefined) patch.order_total = body.orderTotal;
    if (body.totalGoodsOriginal !== undefined) patch.total_goods_original = body.totalGoodsOriginal;
    if (body.totalGoodsLocal !== undefined) patch.total_goods_local = body.totalGoodsLocal;
    if (body.totalGoodsUsd !== undefined) patch.total_goods_usd = body.totalGoodsUsd;
    if (body.totalExpensesOriginal !== undefined) patch.total_expenses_original = body.totalExpensesOriginal;
    if (body.totalExpensesLocal !== undefined) patch.total_expenses_local = body.totalExpensesLocal;
    if (body.totalExpensesUsd !== undefined) patch.total_expenses_usd = body.totalExpensesUsd;
    if (body.landedCostOriginal !== undefined) patch.landed_cost_original = body.landedCostOriginal;
    if (body.landedCostLocal !== undefined) patch.landed_cost_local = body.landedCostLocal;
    if (body.landedCostUsd !== undefined) patch.landed_cost_usd = body.landedCostUsd;
    if (body.formData !== undefined) patch.form_data = body.formData ?? null;
    if (body.ledgerPostingStatus !== undefined) {
      const s = String(body.ledgerPostingStatus).toLowerCase();
      patch.ledger_posting_status = s === "posted" ? "posted" : s === "transferred" ? "transferred" : s === "cancelled" ? "cancelled" : "draft";
    }
    if (body.paymentStatus !== undefined) {
      const s = String(body.paymentStatus).toLowerCase();
      patch.payment_status = ["pending", "partial", "completed", "cancelled"].includes(s) ? s : "pending";
    }
    
    // Only set as edited if this isn't the transfer status update itself
    if (body.ledgerPostingStatus !== "Posted" && body.ledgerPostingStatus !== "posted" && body.ledgerPostingStatus !== "transferred") {
      patch.is_edited_since_transfer = true;
    }
    
    patch.updated_at = new Date().toISOString();

    const isOrderAlreadyPosted = (before as any)?.ledger_posting_status === "posted";
    const shouldPost =
      (patch.ledger_posting_status === "posted" && !isOrderAlreadyPosted) ||
      (isOrderAlreadyPosted && (body.ledgerPostingStatus === "posted" || body.orderTotal !== undefined || body.formData !== undefined));

    // Ledger posting has been removed from Purchase Booking.
    // Booking must remain only in the Purchase Booking Register until transferred and paid.
    
    // We do NOT update advance_paid automatically here.
    // Advance amounts are managed through actual payment records.
    if (body.orderTotal !== undefined) {
      // If the order total changes, we should ideally fetch current paid amounts to calculate remaining due.
      // For now, let's keep it simple and not overwrite advance_paid.
    }

    let updated;
    try {
      updated = await requireSupabaseData(
        supabase.from("purchase_orders").update(patch).eq("id", params.id).select("id").single()
      );
    } catch (e: any) {
      const errMsg = String(e.message || e);
      if (errMsg.includes("schema cache") || errMsg.includes("column") || errMsg.includes("relation") || errMsg.includes("landed_cost") || errMsg.includes("currency")) {
        await ensurePurchaseSchemaAndEnums();
        try {
          updated = await requireSupabaseData(
            supabase.from("purchase_orders").update(patch).eq("id", params.id).select("id").single()
          );
        } catch (retryErr: any) {
          return apiError("UPDATE_FAILED", retryErr.message || String(retryErr), 400);
        }
      } else {
        return apiError("UPDATE_FAILED", errMsg, 400);
      }
    }

    // CASCADE BILL NUMBER TO PAYMENTS
    if (body.purchaseContractNo !== undefined && body.purchaseContractNo?.trim()) {
      const adminSupabase = createSupabaseAdminClient() as any;
      await adminSupabase
        .from("purchase_order_payments")
        .update({ reference_no: body.purchaseContractNo.trim() })
        .eq("purchase_order_id", params.id);
    }

    if (body.items !== undefined) {
      await safeDeletePurchaseOrderItems(supabase, params.id);
      if (body.items && body.items.length > 0) {
        const itemsPayload = body.items.map((it: any) => ({
          purchase_order_id: params.id,
          product_id: it.productId || null,
          goods_name: it.goodsName || "Unknown",
          hs_code: it.hsCode || null,
          size: it.size || null,
          brand: it.brand || null,
          origin: it.origin || null,
          quantity: it.quantity || 0,
          unit_name: it.unitName || "pcs",
          unit_weight: it.unitWeight || 0,
          gross_weight: it.grossWeight || 0,
          net_weight: it.netWeight || 0,
          // rate_original: it.rateOriginal || 0,
          // rate_local: it.rateLocal || 0,
          // rate_usd: it.rateUsd || 0,
          // total_original: it.totalOriginal || 0,
          // total_local: it.totalLocal || 0,
          // total_usd: it.totalUsd || 0
        }));
        await safeInsertPurchaseOrderItems(supabase, itemsPayload);
      }
    }

    if (body.expenses !== undefined) {
      await safeDeletePurchaseOrderExpenses(supabase, params.id);
      if (body.expenses && body.expenses.length > 0) {
        const expPayload = body.expenses.map((ex: any) => ({
          purchase_order_id: params.id,
          expense_type: ex.expenseType,
          ledger_id: ex.ledgerId || null,
          description: ex.description || null,
          // expense_currency: ex.expenseCurrency || "USD",
          exchange_rate: ex.exchangeRate || 1,
          // amount_original: ex.amountOriginal || 0,
          // amount_local: ex.amountLocal || 0,
          // amount_usd: ex.amountUsd || 0
        }));
        await safeInsertPurchaseOrderExpenses(supabase, expPayload);
      }
    }

    await writeAuditLog({
      action: "update",
      entityTable: "purchase_orders",
      entityId: (updated as any).id ?? params.id,
      before,
      after: patch,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    // Requirement 9 & 11: Real-time Synchronization
    revalidatePath("/dashboard/purchases", "layout");
    revalidatePath("/dashboard/reports", "layout");

    return apiOk({ purchaseOrderId: params.id });
  } catch (error) {
    return handleApiError(error);
  }
}

async function getLedgerIdByCode(supabase: any, code: string, input?: any) {
  const lookup = String(code || "").trim();
  if (!lookup) return null;

  const expectedScope = input?.cityBranchId ? "city_branch" : input?.countryBranchId ? "main_branch" : "super_admin";

  let ledgerQuery = supabase
    .from("ledgers")
    .select("id")
    .eq("code", lookup)
    .is("deleted_at", null)
    .eq("scope", expectedScope);
  if (input?.cityBranchId) ledgerQuery = ledgerQuery.eq("city_branch_id", input.cityBranchId);
  else if (input?.countryBranchId) ledgerQuery = ledgerQuery.eq("country_branch_id", input.countryBranchId);
  else if (input?.countryId) ledgerQuery = ledgerQuery.eq("country_id", input.countryId);

  const { data, error } = await ledgerQuery.maybeSingle();
  if (!error && data?.id) return data.id;

  let accountQuery = supabase
    .from("enterprise_accounts")
    .select("id, code, account_number, manual_reference_number, customer_number, name")
    .or(`code.eq."${lookup}",account_number.eq."${lookup}",manual_reference_number.eq."${lookup}",customer_number.eq."${lookup}"`)
    .is("deleted_at", null)
    .limit(1);

  const { data: accountList } = await accountQuery;
  const account = accountList?.[0];

  if (account?.id) {
    let ledgerByAccountQuery = supabase
      .from("ledgers")
      .select("id")
      .eq("enterprise_account_id", account.id)
      .eq("scope", expectedScope)
      .is("deleted_at", null);
      
    if (input?.cityBranchId) ledgerByAccountQuery = ledgerByAccountQuery.eq("city_branch_id", input.cityBranchId);
    else if (input?.countryBranchId) ledgerByAccountQuery = ledgerByAccountQuery.eq("country_branch_id", input.countryBranchId);
    else if (input?.countryId) ledgerByAccountQuery = ledgerByAccountQuery.eq("country_id", input.countryId);

    const { data: ledgerByAccount } = await ledgerByAccountQuery.maybeSingle();
    if (ledgerByAccount?.id) return ledgerByAccount.id;

    const { data: newLedger } = await supabase
      .from("ledgers")
      .insert({
        scope: expectedScope,
        country_id: input?.countryId || null,
        country_branch_id: input?.countryBranchId || null,
        city_branch_id: input?.cityBranchId || null,
        enterprise_account_id: account.id,
        code: account.code || lookup,
        name: account.name || `${lookup} Account`,
        currency: input?.currencyCode || "USD",
        opening_balance: 0,
        current_balance: 0,
        debit_total: 0,
        credit_total: 0,
        normal_balance: input?.kind === "liability" ? "credit" : "debit",
        is_active: true,
        created_by: input?.userId
      })
      .select("id")
      .single();
    if (newLedger?.id) return newLedger.id;
  }

  const accountCodes = account ? [account.code, account.account_number, account.manual_reference_number, account.customer_number].filter(Boolean) : [];
  if (accountCodes.length) {
    let ledgerByCodeQuery = supabase
      .from("ledgers")
      .select("id")
      .in("code", accountCodes)
      .is("deleted_at", null)
      .eq("scope", expectedScope)
      .limit(1);
    if (input?.cityBranchId) ledgerByCodeQuery = ledgerByCodeQuery.eq("city_branch_id", input.cityBranchId);
    else if (input?.countryBranchId) ledgerByCodeQuery = ledgerByCodeQuery.eq("country_branch_id", input.countryBranchId);
    else if (input?.countryId) ledgerByCodeQuery = ledgerByCodeQuery.eq("country_id", input.countryId);

    const { data: ledgerByCode } = await ledgerByCodeQuery.maybeSingle();
    if (ledgerByCode?.id) return ledgerByCode.id;
  }

  // If we reach here, neither Account nor Ledger exists. Auto-create both as a fallback.
  if (input?.userId) {
    try {
      const scope = input.cityBranchId ? "city_branch" : input.countryBranchId ? "main_branch" : "super_admin";
      let branchCode = "BRANCH";
      let branchPrefix = "BR";
      let countryPrefix = "CT";

      if (input.cityBranchId) {
        const { data: cb } = await supabase.from("city_branches").select("code, city_name").eq("id", input.cityBranchId).maybeSingle();
        if (cb) {
          branchCode = cb.code || cb.city_name || "CITY";
          branchPrefix = cb.city_name || cb.code || "CITY";
        }
      } else if (input.countryBranchId) {
        const { data: cb } = await supabase.from("country_branches").select("code, name").eq("id", input.countryBranchId).maybeSingle();
        if (cb) {
          branchCode = cb.code || cb.name || "MAIN";
          branchPrefix = "MAIN";
        }
      }

      if (input.countryId) {
        const { data: c } = await supabase.from("countries").select("name, iso2").eq("id", input.countryId).maybeSingle();
        if (c) {
          countryPrefix = c.name?.toLowerCase().includes("united arab emirates") ? "UAE" : (c.iso2 || "CT");
        }
      }

      const { count: totalCount } = await supabase.from("enterprise_accounts").select("id", { count: "exact", head: true });
      let branchQuery = supabase.from("enterprise_accounts").select("id", { count: "exact", head: true }).eq("scope", scope).is("deleted_at", null);
      if (input.countryId) branchQuery = branchQuery.eq("country_id", input.countryId);
      if (input.countryBranchId) branchQuery = branchQuery.eq("country_branch_id", input.countryBranchId);
      if (input.cityBranchId) branchQuery = branchQuery.eq("city_branch_id", input.cityBranchId);
      const { count: branchCount } = await branchQuery;

      let countryQuery = supabase.from("enterprise_accounts").select("id", { count: "exact", head: true }).is("deleted_at", null);
      if (input.countryId) countryQuery = countryQuery.eq("country_id", input.countryId);
      const { count: countryCount } = await countryQuery;

      const accountSerialNumber = Number(totalCount ?? 0) + 1;
      const branchAccountSequence = Number(branchCount ?? 0) + 1;
      const countrySerialNumber = `${countryPrefix.toUpperCase()}-${String(Number(countryCount ?? 0) + 1).padStart(6, "0")}`;
      const branchSerialNumber = `${countryPrefix.toUpperCase()}-${branchPrefix.slice(0, 3).toUpperCase()}-${String(branchAccountSequence).padStart(6, "0")}`;

      const { data: newAcc, error: accErr } = await supabase
        .from("enterprise_accounts")
        .insert({
          scope,
          country_id: input.countryId || null,
          country_branch_id: input.countryBranchId || null,
          city_branch_id: input.cityBranchId || null,
          code: lookup,
          account_number: `${lookup}-${Date.now().toString().slice(-6)}`,
          customer_number: `CUST-${lookup}-${Date.now().toString().slice(-6)}`,
          account_serial_number: accountSerialNumber,
          country_serial_number: countrySerialNumber,
          branch_serial_number: branchSerialNumber,
          branch_code: branchCode.slice(0, 6).toUpperCase(),
          branch_account_sequence: branchAccountSequence,
          name: input.name || `${lookup} Fallback Account`,
          kind: input.kind || "liability",
          currency: input?.currencyCode || "USD",
          status: "active",
          is_control_account: false,
          opening_balance: 0,
          current_balance: 0,
          creation_date: new Date().toISOString(),
          created_by: input.userId
        })
        .select("id, code, name")
        .single();

      if (accErr) {
        console.error("Failed creating fallback acc", accErr);
      }

      if (newAcc?.id) {
        const { data: newLedg } = await supabase
          .from("ledgers")
          .insert({
            scope,
            country_id: input.countryId || null,
            country_branch_id: input.countryBranchId || null,
            city_branch_id: input.cityBranchId || null,
            enterprise_account_id: newAcc.id,
            code: newAcc.code,
            name: newAcc.name,
            currency: input?.currencyCode || "USD",
            opening_balance: 0,
            current_balance: 0,
            debit_total: 0,
            credit_total: 0,
            normal_balance: input.kind === "liability" ? "credit" : "debit",
            is_active: true,
            created_by: input.userId
          })
          .select("id")
          .single();
        if (newLedg?.id) return newLedg.id;
      }
    } catch (e) {
      console.error("Auto-create fallback account failed", e);
    }
  }

  return null;
}

async function resolveOrCreateCashLedger(
  supabase: any,
  input: {
    cashAccountCode?: string;
    currencyCode: string;
    countryId: string | null;
    countryBranchId: string | null;
    cityBranchId: string | null;
    userId: string;
  }
) {
  const code = (input.cashAccountCode || "CASH-001").trim();
  
  // 1. Try to find ledger by code
  const ledgerId = await getLedgerIdByCode(supabase, code);
  if (ledgerId) return ledgerId;

  // 2. Try to find any active ledger containing "cash" (case insensitive)
  const { data: cashL } = await supabase
    .from("ledgers")
    .select("id")
    .ilike("name", "%cash%")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (cashL?.id) return cashL.id;

  // 3. Try to find any active ledger containing "bank" (case insensitive)
  const { data: bankL } = await supabase
    .from("ledgers")
    .select("id")
    .ilike("name", "%bank%")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (bankL?.id) return bankL.id;

  // 4. Create standard fallback Cash Account and Ledger
  const scope = input.cityBranchId 
    ? "city_branch" 
    : input.countryBranchId 
      ? "main_branch" 
      : "super_admin";

  const { data: existingAccount } = await supabase
    .from("enterprise_accounts")
    .select("id")
    .eq("code", "CASH-001")
    .is("deleted_at", null)
    .maybeSingle();

  let accountId = existingAccount?.id;

  if (!accountId) {
    // Generate serials and codes
    let branchCode = "BRANCH";
    let branchPrefix = "BR";
    let countryPrefix = "CT";

    if (input.cityBranchId) {
      const { data: cb } = await supabase
        .from("city_branches")
        .select("code, city_name")
        .eq("id", input.cityBranchId)
        .maybeSingle();
      if (cb) {
        branchCode = cb.code || cb.city_name || "CITY";
        branchPrefix = cb.city_name || cb.code || "CITY";
      }
    } else if (input.countryBranchId) {
      const { data: cb } = await supabase
        .from("country_branches")
        .select("code, name")
        .eq("id", input.countryBranchId)
        .maybeSingle();
      if (cb) {
        branchCode = cb.code || cb.name || "MAIN";
        branchPrefix = "MAIN";
      }
    }

    if (input.countryId) {
      const { data: c } = await supabase
        .from("countries")
        .select("name, iso2")
        .eq("id", input.countryId)
        .maybeSingle();
      if (c) {
        countryPrefix = c.name?.toLowerCase().includes("united arab emirates") ? "UAE" : (c.iso2 || "CT");
      }
    }

    // Count total enterprise accounts
    const { count: totalCount } = await supabase
      .from("enterprise_accounts")
      .select("id", { count: "exact", head: true });

    // Count branch-specific enterprise accounts
    let branchQuery = supabase
      .from("enterprise_accounts")
      .select("id", { count: "exact", head: true })
      .eq("scope", scope)
      .is("deleted_at", null);
    if (input.countryId) branchQuery = branchQuery.eq("country_id", input.countryId);
    if (input.countryBranchId) branchQuery = branchQuery.eq("country_branch_id", input.countryBranchId);
    if (input.cityBranchId) branchQuery = branchQuery.eq("city_branch_id", input.cityBranchId);
    const { count: branchCount } = await branchQuery;

    // Count country-specific enterprise accounts
    let countryQuery = supabase
      .from("enterprise_accounts")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null);
    if (input.countryId) countryQuery = countryQuery.eq("country_id", input.countryId);
    const { count: countryCount } = await countryQuery;

    const accountSerialNumber = Number(totalCount ?? 0) + 1;
    const branchAccountSequence = Number(branchCount ?? 0) + 1;
    const countrySerialNumber = `${countryPrefix.toUpperCase()}-${String(Number(countryCount ?? 0) + 1).padStart(6, "0")}`;
    const branchSerialNumber = `${countryPrefix.toUpperCase()}-${branchPrefix.slice(0, 3).toUpperCase()}-${String(branchAccountSequence).padStart(6, "0")}`;

    const { data: newAccount, error: accError } = await supabase
      .from("enterprise_accounts")
      .insert({
        scope,
        country_id: input.countryId,
        country_branch_id: input.countryBranchId,
        city_branch_id: input.cityBranchId,
        code: "CASH-001",
        account_number: "CASH-001",
        customer_number: "CUST-CASH-001",
        account_serial_number: accountSerialNumber,
        country_serial_number: countrySerialNumber,
        branch_serial_number: branchSerialNumber,
        branch_code: branchCode.slice(0, 6).toUpperCase(),
        branch_account_sequence: branchAccountSequence,
        name: "General Cash Account",
        kind: "asset",
        currency: input.currencyCode || "USD",
        status: "active",
        is_control_account: false,
        opening_balance: 0,
        current_balance: 0,
        creation_date: new Date().toISOString(),
        created_by: input.userId
      })
      .select("id")
      .single();

    if (accError) {
      console.error("Failed to create fallback cash enterprise account:", accError);
      throw new Error(`Failed to create fallback cash account: ${accError.message}`);
    }
    accountId = newAccount.id;
  }

  // Create the ledger record bound to this enterprise account
  const { data: newLedger, error: ledgerError } = await supabase
    .from("ledgers")
    .insert({
      scope,
      country_id: input.countryId,
      country_branch_id: input.countryBranchId,
      city_branch_id: input.cityBranchId,
      enterprise_account_id: accountId,
      code: "CASH-001",
      name: "General Cash Account",
      currency: input.currencyCode || "USD",
      opening_balance: 0,
      current_balance: 0,
      debit_total: 0,
      credit_total: 0,
      normal_balance: "debit",
      is_active: true,
      created_by: input.userId
    })
    .select("id")
    .single();

  if (ledgerError) {
    console.error("Failed to create fallback cash ledger:", ledgerError);
    throw new Error(`Failed to create fallback cash ledger: ${ledgerError.message}`);
  }

  return newLedger.id;
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);

    const supabase = await createApiSupabaseClient();
    const row = await requireSupabaseData(
      supabase
        .from("purchase_orders")
        .select("id, purchase_order_no, country_id, country_branch_id, city_branch_id, ledger_posting_status, payment_status")
        .eq("id", params.id)
        .is("deleted_at", null)
        .maybeSingle()
    );

    // Explicitly require super_admin or country_admin for deletion
    if (!session.isSuperAdmin && !session.roles?.includes("super_admin") && !session.roles?.includes("country_admin")) {
      throw new Error("Unauthorized: Only Super Admin or Country Admin can delete purchase bookings.");
    }

    authorizeApiScope(session, {
      resource: "purchases",
      action: "delete",
      countryId: (row as any)?.country_id ?? null,
      countryBranchId: (row as any)?.country_branch_id ?? null,
      cityBranchId: (row as any)?.city_branch_id ?? null
    });

    const adminSupabase = createSupabaseAdminClient() as any;

    // 1. Revert the booking transfer Roznamcha entry if it exists
    const poNo = (row as any).purchase_order_no;
    if (poNo) {
      const { data: existingRoz } = await supabase
        .from("roznamcha_entries")
        .select("id")
        .eq("journal_no", poNo)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingRoz) {
        const { data: lines } = await supabase
          .from("roznamcha_lines")
          .select("ledger_id, enterprise_account_id, debit, credit")
          .eq("roznamcha_entry_id", existingRoz.id);

        if (lines && lines.length > 0) {
          for (const line of lines) {
            const { data: ledger } = await adminSupabase
              .from("ledgers")
              .select("debit_total, credit_total, current_balance")
              .eq("id", line.ledger_id)
              .maybeSingle();
            if (ledger) {
              await adminSupabase
                .from("ledgers")
                .update({
                  debit_total: Number(ledger.debit_total || 0) - Number(line.debit || 0),
                  credit_total: Number(ledger.credit_total || 0) - Number(line.credit || 0),
                  current_balance: Number(ledger.current_balance || 0) - Number(line.debit || 0) + Number(line.credit || 0),
                  updated_at: new Date().toISOString()
                })
                .eq("id", line.ledger_id);
            }

            if (line.enterprise_account_id) {
              const { data: entAcc } = await adminSupabase
                .from("enterprise_accounts")
                .select("current_balance")
                .eq("id", line.enterprise_account_id)
                .maybeSingle();
              if (entAcc) {
                await adminSupabase
                  .from("enterprise_accounts")
                  .update({
                    current_balance: Number(entAcc.current_balance || 0) - Number(line.debit || 0) + Number(line.credit || 0),
                    updated_at: new Date().toISOString()
                  })
                  .eq("id", line.enterprise_account_id);
              }
            }
          }
        }

        // Hard delete the booking transfer Roznamcha entry so it is completely removed
        await adminSupabase
          .from("roznamcha_entries")
          .delete()
          .eq("id", existingRoz.id);
      }
    }

    // 2. Revert ALL payments and their ledger/roznamcha entries
    await revertAllOrderPayments(params.id, supabase, adminSupabase);

    // Soft delete ALL remaining purchase order payments associated with this PO
    await requireSupabaseData(
      supabase
        .from("purchase_order_payments")
        .update({ 
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("purchase_order_id", params.id)
    );

    // Soft delete associated loading records
    await requireSupabaseData(
      supabase
        .from("purchase_loading_records")
        .update({ 
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("purchase_order_id", params.id)
    );

    // Soft delete the purchase order
    const deleted = await requireSupabaseData(
      supabase
        .from("purchase_orders")
        .update({ 
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", params.id)
        .select("id")
        .single()
    );

    await writeAuditLog({
      action: "delete",
      entityTable: "purchase_orders",
      entityId: params.id,
      before: row,
      after: { deleted_at: new Date().toISOString() },
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    return apiOk({ success: true, deletedId: params.id });
  } catch (error) {
    return handleApiError(error);
  }
}
