import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function resolveLedgerOrAccount(adminSupabase: any, term: string | null | undefined) {
  if (!term || typeof term !== "string") return null;
  const cleanTerm = term.trim();
  if (!cleanTerm) return null;

  const { data: ledger } = await adminSupabase
    .from("ledgers")
    .select("id, code, name")
    .or(`id.eq.${cleanTerm},code.eq.${cleanTerm}`)
    .is("deleted_at", null)
    .maybeSingle();

  if (ledger) return ledger;

  const { data: account } = await adminSupabase
    .from("accounts")
    .select("id, code, name")
    .or(`id.eq.${cleanTerm},code.eq.${cleanTerm}`)
    .is("deleted_at", null)
    .maybeSingle();

  if (account) return account;

  const { data: ledgerByName } = await adminSupabase
    .from("ledgers")
    .select("id, code, name")
    .ilike("name", `%${cleanTerm}%`)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (ledgerByName) return ledgerByName;

  const { data: accountByName } = await adminSupabase
    .from("accounts")
    .select("id, code, name")
    .ilike("name", `%${cleanTerm}%`)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (accountByName) return accountByName;

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const adminSupabase = createSupabaseAdminClient();
    
    // Find all transferred/posted orders
    const { data: orders, error } = await adminSupabase
      .from("purchase_orders")
      .select("id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id, order_total, currency_code, exchange_rate, form_data, ledger_posting_status, roznamcha_entry_id, advance_paid, remaining_due")
      .in("ledger_posting_status", ["transferred", "posted"])
      .is("deleted_at", null);

    if (error) throw error;

    const fixedOrders = [];
    const now = new Date().toISOString();

    for (const orderRow of orders || []) {
      const { data: payments } = await adminSupabase
        .from("purchase_order_payments")
        .select("id, status, roznamcha_entry_id")
        .eq("purchase_order_id", orderRow.id)
        .in("kind", ["booking", "credit"]);
      
      let needsFix = false;
      let roznamchaEntryId: string | null = orderRow.roznamcha_entry_id || null;

      if (!payments || payments.length === 0) {
        needsFix = true;
      } else {
        const p = payments[0];
        if (!p.roznamcha_entry_id) {
          needsFix = true;
        } else {
          const { data: roz } = await adminSupabase
            .from("roznamcha_entries")
            .select("id")
            .eq("id", p.roznamcha_entry_id)
            .maybeSingle();
          if (!roz) needsFix = true;
          else roznamchaEntryId = roz.id;
        }
      }

      if (needsFix) {
        const formData = orderRow.form_data || {};
        const form = formData.form || {};

        const systemBillNumber = String(orderRow.purchase_order_no || form.purchaseOrderNo || "").trim();
        const manualBillNumber = String(form.manualBillNumber || form.manual_bill_number || form.billNo || form.purchaseContractNo || orderRow.purchase_contract_no || "").trim();
        const referenceNo = [systemBillNumber, manualBillNumber].filter(Boolean).join(" / ") || systemBillNumber || manualBillNumber || null;
        const totalPurchaseAmount = Number(String(orderRow.order_total || formData.totals?.grandFinal || "0").replace(/,/g, "")) || 1;

        const purchaseAccountTerm = form.purchaseAccountNo || form.purchaseAccountNumber || form.purchaseAccountId || "UAE-001-AC-0001";
        const creditAccountTerm = form.salesAccountNo || form.salesAccountNumber || form.supplierAccountNo || form.supplierAccountId || "UAE-001-AC-0005";

        let debitAccountObj = await resolveLedgerOrAccount(adminSupabase, purchaseAccountTerm);
        let creditAccountObj = await resolveLedgerOrAccount(adminSupabase, creditAccountTerm);

        if (!debitAccountObj) {
          const { data: defaultDebit } = await adminSupabase.from("ledgers").select("id, code, name").is("deleted_at", null).limit(1).maybeSingle();
          debitAccountObj = defaultDebit;
        }

        if (!creditAccountObj) {
          const { data: defaultCredit } = await adminSupabase.from("ledgers").select("id, code, name").is("deleted_at", null).limit(1).maybeSingle();
          creditAccountObj = defaultCredit;
        }

        if (!debitAccountObj || !creditAccountObj) continue;

        const currencyCode = orderRow.currency_code || form.currencyType || "USD";
        const exRate = Number(orderRow.exchange_rate || form.exchangeRate || 1) || 1;
        const localAmount = totalPurchaseAmount * exRate;

        const effectiveCountryId = orderRow.country_id || debitAccountObj?.country_id || creditAccountObj?.country_id || null;
        const effectiveCountryBranchId = orderRow.country_branch_id || debitAccountObj?.country_branch_id || creditAccountObj?.country_branch_id || null;
        const effectiveCityBranchId = orderRow.city_branch_id || debitAccountObj?.city_branch_id || creditAccountObj?.city_branch_id || null;

        let rozType = "super_admin";
        if (effectiveCityBranchId) rozType = "branch";
        else if (effectiveCountryBranchId || effectiveCountryId) rozType = "country";

        // Create Roznamcha Entry
        if (!roznamchaEntryId) {
          const { data: newRoz } = await adminSupabase
            .from("roznamcha_entries")
            .insert({
              country_id: effectiveCountryId,
              country_branch_id: effectiveCountryBranchId,
              city_branch_id: effectiveCityBranchId,
              type: rozType,
              journal_no: `JO-PURCHASE-${systemBillNumber}`,
              voucher_no: `VO-PURCHASE-${systemBillNumber}`,
              entry_date: now.slice(0, 10),
              reference_no: referenceNo,
              narration: `Purchase Booking Transfer: ${referenceNo}`,
              status: "posted",
              source_module: "purchase",
              source_transaction_type: "purchase_booking_transfer",
              source_transaction_id: orderRow.id,
              created_at: now,
              updated_at: now
            })
            .select("id")
            .single();

          if (newRoz?.id) {
            roznamchaEntryId = newRoz.id;

            await adminSupabase.from("roznamcha_lines").insert([
              {
                roznamcha_entry_id: roznamchaEntryId,
                ledger_id: debitAccountObj.id,
                debit: localAmount,
                credit: 0,
                currency: currencyCode,
                exchange_rate: exRate,
                usd_rate: exRate,
                usd_amount: totalPurchaseAmount,
                description: `DR: Purchase Account (${systemBillNumber})`
              },
              {
                roznamcha_entry_id: roznamchaEntryId,
                ledger_id: creditAccountObj.id,
                debit: 0,
                credit: localAmount,
                currency: currencyCode,
                exchange_rate: exRate,
                usd_rate: exRate,
                usd_amount: totalPurchaseAmount,
                description: `CR: Payable Account (${systemBillNumber})`
              }
            ]);
          }
        }

        // Create Journal Entry
        const { data: existingJE } = await adminSupabase
          .from("journal_entries")
          .select("id")
          .eq("source_id", orderRow.id)
          .maybeSingle();

        if (!existingJE) {
          const { data: newJE } = await adminSupabase
            .from("journal_entries")
            .insert({
              entry_no: `JV-PURCHASE-${systemBillNumber}`,
              entry_date: now.slice(0, 10),
              status: "posted",
              memo: `Purchase Transfer - ${systemBillNumber}`,
              source_type: "purchase_order",
              source_id: orderRow.id,
              posted_at: now
            })
            .select("id")
            .single();

          if (newJE?.id) {
            await adminSupabase.from("journal_lines").insert([
              {
                journal_entry_id: newJE.id,
                account_id: debitAccountObj.id,
                description: `DR: Purchase Account (${systemBillNumber})`,
                debit: localAmount,
                credit: 0,
              },
              {
                journal_entry_id: newJE.id,
                account_id: creditAccountObj.id,
                description: `CR: Payable Account (${systemBillNumber})`,
                debit: 0,
                credit: localAmount,
              }
            ]);
          }
        }

        // Create Payment record
        await adminSupabase
          .from("purchase_order_payments")
          .insert({
            purchase_order_id: orderRow.id,
            kind: "booking",
            entry_date: now.slice(0, 10),
            amount: totalPurchaseAmount,
            currency_code: currencyCode,
            exchange_rate: exRate,
            debit_ledger_id: debitAccountObj.id,
            credit_ledger_id: creditAccountObj.id,
            roznamcha_entry_id: roznamchaEntryId,
            status: "posted",
            reference_no: referenceNo,
            narration: `Purchase Booking Transfer: ${referenceNo}`,
            source_module: "purchase",
            source_transaction_type: "purchase_booking_transfer",
            created_at: now,
            updated_at: now
          });

        // Update purchase order
        await adminSupabase
          .from("purchase_orders")
          .update({
            ledger_posting_status: "posted",
            roznamcha_entry_id: roznamchaEntryId,
            is_edited_since_transfer: false,
            updated_at: now
          })
          .eq("id", orderRow.id);

        fixedOrders.push(orderRow.purchase_order_no);
      }
    }

    return apiOk({
      message: `Successfully checked ${orders?.length || 0} orders and generated missing Roznamcha/Ledger postings for ${fixedOrders.length} transferred orders.`,
      fixedOrders
    });
  } catch (error) {
    return handleApiError(error);
  }
}

