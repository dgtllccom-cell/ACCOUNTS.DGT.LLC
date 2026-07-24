export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const transferSchema = z.object({
  purchaseId: z.string().uuid(),
});

/**
 * POST /api/erp/purchases/local-purchase/transfer
 * Transitions a local purchase bill from 'accepted' → 'posted'.
 * Creates full accounting chain:
 *   1. Journal Entry (journal_entries + journal_lines)
 *   2. Business Roznamcha Entry (roznamcha_entries + roznamcha_lines)
 *   3. Cash Business Roznamcha Entry (if payment mode is Cash)
 *   4. General Ledger posting
 * All entries are posted in Final Currency (local_currency).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const { purchaseId } = transferSchema.parse(body);

    const supabase = createSupabaseAdminClient();

    // Fetch the purchase record
    const { data: purchase, error: fetchErr } = await supabase
      .from("local_purchases")
      .select("*")
      .eq("id", purchaseId)
      .is("deleted_at", null)
      .single();

    if (fetchErr || !purchase) {
      return NextResponse.json(
        { ok: false, error: { message: "Purchase record not found." } },
        { status: 404 }
      );
    }

    // Verify status is 'accepted'
    if (purchase.status !== "accepted") {
      return NextResponse.json(
        { ok: false, error: { message: `Cannot transfer a bill with status '${purchase.status}'. Only accepted bills can be transferred.` } },
        { status: 400 }
      );
    }

    // Authorize scope
    authorizeApiScope(session, {
      resource: "purchases",
      action: "update",
      countryId: purchase.country_id,
      countryBranchId: purchase.country_branch_id,
      cityBranchId: purchase.city_branch_id ?? null,
    });

    const postingCurrency = purchase.local_currency || purchase.purchase_currency || "PKR";
    const finalAmount = Number(purchase.final_cost || 0);
    const purchaseAccountCode = purchase.purchase_account_no;
    const creditAccountCode = purchase.sales_account_no || purchase.broker_account_no;

    let journalEntryId: string | null = null;
    let roznamchaEntryId: string | null = null;

    // ──────────────────────────────────────────
    // 1. JOURNAL ENTRY (Debit + Credit)
    // ──────────────────────────────────────────
    if (purchaseAccountCode && creditAccountCode && finalAmount > 0) {
      try {
        const entryNoDr = `JV-DR-${purchase.debit_journal_serial || Date.now().toString(36).toUpperCase()}`;
        const entryNoCr = `JV-CR-${purchase.credit_journal_serial || Date.now().toString(36).toUpperCase()}`;
        const memoDr = `Local Purchase Debit (DR) - ${purchase.supplier_name || "Local Vendor"} (${purchase.goods_name}) [${purchase.payment_mode}]`;
        const memoCr = `Local Purchase Credit (CR) - ${purchase.supplier_name || "Local Vendor"} (${purchase.goods_name}) [${purchase.payment_mode}]`;

        // Resolve account IDs
        const { data: foundAccounts } = await supabase
          .from("accounts")
          .select("id, code")
          .in("code", [purchaseAccountCode, creditAccountCode]);

        const debitAccObj = foundAccounts?.find((a: any) => a.code === purchaseAccountCode);
        const creditAccObj = foundAccounts?.find((a: any) => a.code === creditAccountCode);

        if (debitAccObj && creditAccObj) {
          // 1. Post Debit Journal Entry
          const { data: journalEntryDr, error: jeErrDr } = await supabase
            .from("journal_entries")
            .insert({
              company_id: purchase.company_id,
              entry_no: entryNoDr,
              entry_date: new Date().toISOString().slice(0, 10),
              status: "posted",
              memo: memoDr,
              source_type: "local_purchase",
              source_id: purchase.id,
              posted_at: new Date().toISOString(),
              posted_by: session.userId,
            })
            .select()
            .single();

          if (jeErrDr) {
            console.error("Debit Journal entry creation failed:", jeErrDr);
          } else if (journalEntryDr) {
            journalEntryId = journalEntryDr.id; // Save one of them as primary reference
            await supabase.from("journal_lines").insert([
              {
                journal_entry_id: journalEntryDr.id,
                account_id: debitAccObj.id,
                description: `DR: Local Purchase - ${purchase.goods_name} (${purchase.quantity_kgs} ${purchase.quantity_name})`,
                debit: finalAmount,
                credit: 0,
              },
              {
                journal_entry_id: journalEntryDr.id,
                account_id: creditAccObj.id,
                description: `CR: Settlement Offset - ${purchase.supplier_name || "Vendor"}`,
                debit: 0,
                credit: finalAmount,
              }
            ]);
          }

          // 2. Post Credit Journal Entry
          const { data: journalEntryCr, error: jeErrCr } = await supabase
            .from("journal_entries")
            .insert({
              company_id: purchase.company_id,
              entry_no: entryNoCr,
              entry_date: new Date().toISOString().slice(0, 10),
              status: "posted",
              memo: memoCr,
              source_type: "local_purchase",
              source_id: purchase.id,
              posted_at: new Date().toISOString(),
              posted_by: session.userId,
            })
            .select()
            .single();

          if (jeErrCr) {
            console.error("Credit Journal entry creation failed:", jeErrCr);
          } else if (journalEntryCr) {
            await supabase.from("journal_lines").insert([
              {
                journal_entry_id: journalEntryCr.id,
                account_id: debitAccObj.id,
                description: `DR: Local Purchase Offset - ${purchase.goods_name}`,
                debit: finalAmount,
                credit: 0,
              },
              {
                journal_entry_id: journalEntryCr.id,
                account_id: creditAccObj.id,
                description: `CR: Settlement - ${purchase.supplier_name || "Vendor"} [${purchase.payment_mode}]`,
                debit: 0,
                credit: finalAmount,
              }
            ]);
          }
        }
      } catch (journalErr) {
        console.error("Journal entry posting error:", journalErr);
      }
    }

    // ──────────────────────────────────────────
    // 2. BUSINESS ROZNAMCHA ENTRY
    // ──────────────────────────────────────────
    try {
      const voucherNo = `LP-ROZ-${purchase.journal_serial_no || Date.now().toString(36).toUpperCase()}`;
      const narration = `Local Purchase Bill: ${purchase.goods_name} - ${purchase.supplier_name || "Local Vendor"} | ${postingCurrency} ${finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

      const { data: rozEntry, error: rozErr } = await supabase
        .from("roznamcha_entries")
        .insert({
          type: "business",
          country_id: purchase.country_id,
          country_branch_id: purchase.country_branch_id,
          city_branch_id: purchase.city_branch_id || null,
          voucher_no: voucherNo,
          entry_date: new Date().toISOString().slice(0, 10),
          narration: narration,
          status: "posted",
          source_module: "local_purchase",
          source_transaction_type: "local_purchase_transfer",
          source_transaction_id: purchase.id,
          source_reference_no: purchase.journal_serial_no || null,
          created_by: session.userId,
          posted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (rozErr) {
        console.error("Business Roznamcha entry creation failed:", rozErr);
      } else if (rozEntry) {
        roznamchaEntryId = rozEntry.id;

        // Roznamcha Lines: Debit + Credit in posting currency
        const rozLines: any[] = [
          {
            roznamcha_entry_id: rozEntry.id,
            payment_entry_type: "debit",
            debit: finalAmount,
            credit: 0,
            currency: postingCurrency,
            account_number: purchaseAccountCode,
            manual_reference_number: purchase.journal_serial_no,
          },
          {
            roznamcha_entry_id: rozEntry.id,
            payment_entry_type: "credit",
            debit: 0,
            credit: finalAmount,
            currency: postingCurrency,
            account_number: creditAccountCode,
            manual_reference_number: purchase.journal_serial_no,
          }
        ];

        await supabase.from("roznamcha_lines").insert(rozLines);
      }
    } catch (rozErr) {
      console.error("Business Roznamcha posting error:", rozErr);
    }

    // ──────────────────────────────────────────
    // 3. CASH BUSINESS ROZNAMCHA (if Cash payment)
    // ──────────────────────────────────────────
    if (purchase.payment_mode === "Cash" && finalAmount > 0) {
      try {
        const cashVoucherNo = `LP-CASH-${purchase.journal_serial_no || Date.now().toString(36).toUpperCase()}`;
        const cashNarration = `Cash Payment: Local Purchase - ${purchase.goods_name} | ${postingCurrency} ${finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

        const { data: cashRozEntry } = await supabase
          .from("roznamcha_entries")
          .insert({
            type: "cash_business",
            country_id: purchase.country_id,
            country_branch_id: purchase.country_branch_id,
            city_branch_id: purchase.city_branch_id || null,
            voucher_no: cashVoucherNo,
            entry_date: new Date().toISOString().slice(0, 10),
            narration: cashNarration,
            status: "posted",
            source_module: "local_purchase",
            source_transaction_type: "local_purchase_cash_payment",
            source_transaction_id: purchase.id,
            source_reference_no: purchase.journal_serial_no || null,
            created_by: session.userId,
            posted_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (cashRozEntry) {
          await supabase.from("roznamcha_lines").insert([
            {
              roznamcha_entry_id: cashRozEntry.id,
              payment_entry_type: "debit",
              debit: finalAmount,
              credit: 0,
              currency: postingCurrency,
              account_number: purchaseAccountCode,
            },
            {
              roznamcha_entry_id: cashRozEntry.id,
              payment_entry_type: "credit",
              debit: 0,
              credit: finalAmount,
              currency: postingCurrency,
              account_number: creditAccountCode,
            }
          ]);
        }
      } catch (cashErr) {
        console.error("Cash Roznamcha posting error:", cashErr);
      }
    }

    // ──────────────────────────────────────────
    // 4. GENERAL LEDGER ENTRY
    // ──────────────────────────────────────────
    if (purchaseAccountCode && creditAccountCode && finalAmount > 0) {
      try {
        await supabase.from("ledger_transactions").insert([
          {
            company_id: purchase.company_id,
            country_id: purchase.country_id,
            country_branch_id: purchase.country_branch_id,
            city_branch_id: purchase.city_branch_id || null,
            account_code: purchaseAccountCode,
            entry_date: new Date().toISOString().slice(0, 10),
            debit: finalAmount,
            credit: 0,
            currency: postingCurrency,
            narration: `DR: Local Purchase - ${purchase.goods_name}`,
            source_type: "local_purchase",
            source_id: purchase.id,
            reference_no: purchase.debit_journal_serial || purchase.journal_serial_no,
            created_by: session.userId,
          },
          {
            company_id: purchase.company_id,
            country_id: purchase.country_id,
            country_branch_id: purchase.country_branch_id,
            city_branch_id: purchase.city_branch_id || null,
            account_code: creditAccountCode,
            entry_date: new Date().toISOString().slice(0, 10),
            debit: 0,
            credit: finalAmount,
            currency: postingCurrency,
            narration: `CR: Settlement - ${purchase.supplier_name || "Vendor"}`,
            source_type: "local_purchase",
            source_id: purchase.id,
            reference_no: purchase.credit_journal_serial || purchase.journal_serial_no,
            created_by: session.userId,
          }
        ]);
      } catch (glErr) {
        console.error("General Ledger posting error (non-fatal):", glErr);
      }
    }

    // ──────────────────────────────────────────
    // 5. UPDATE PURCHASE RECORD → 'posted'
    // ──────────────────────────────────────────
    const { data: finalRecord, error: finalErr } = await supabase
      .from("local_purchases")
      .update({
        status: "posted",
        transferred_at: new Date().toISOString(),
        journal_entry_id: journalEntryId,
        roznamcha_entry_id: roznamchaEntryId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchaseId)
      .select()
      .single();

    if (finalErr) throw finalErr;

    return NextResponse.json({
      ok: true,
      data: {
        purchase: finalRecord,
        posting: {
          journalEntryId,
          roznamchaEntryId,
          status: "posted",
        }
      }
    });
  } catch (err: any) {
    console.error("[POST /api/erp/purchases/local-purchase/transfer] Error:", err);
    return NextResponse.json(
      { ok: false, error: { message: err.message || "Failed to transfer local purchase." } },
      { status: 500 }
    );
  }
}
