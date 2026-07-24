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
 *
 * Creates a SINGLE balanced accounting chain:
 *   1. ONE Journal Entry with DR + CR lines (Purchase DR, Payable CR)
 *   2. ONE Roznamcha Entry with matching DR + CR lines
 *   3. General Ledger posting (DR + CR)
 *
 * Accounting Rules:
 *   - Purchase Account = Debit (DR)  — increases expense/asset
 *   - Sales/Payable Account = Credit (CR) — increases liability
 *   - Every entry is always balanced: total DR = total CR
 *
 * Idempotency:
 *   - If the purchase is already 'posted' or has a roznamcha_entry_id, the
 *     request is rejected to prevent duplicate accounting entries.
 *   - Re-transfer after reversal is allowed (status would be reset to 'accepted').
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const { purchaseId } = transferSchema.parse(body);

    const supabase = createSupabaseAdminClient();

    // ── Fetch the purchase record ──
    const { data: purchase, error: fetchErr } = await (supabase as any)
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

    // ── Idempotency Guard: Prevent duplicate posting ──
    if (purchase.status === "posted") {
      return NextResponse.json(
        { ok: false, error: { message: "This purchase has already been posted. Duplicate posting is not allowed." } },
        { status: 400 }
      );
    }

    if (purchase.roznamcha_entry_id) {
      return NextResponse.json(
        { ok: false, error: { message: "This purchase already has a linked roznamcha entry. Duplicate posting is not allowed." } },
        { status: 400 }
      );
    }

    // ── Status Guard: Only accepted bills can be transferred ──
    if (purchase.status !== "accepted") {
      return NextResponse.json(
        { ok: false, error: { message: `Cannot transfer a bill with status '${purchase.status}'. Only accepted bills can be transferred.` } },
        { status: 400 }
      );
    }

    // ── Source-level duplicate check: verify no existing roznamcha for this purchase ──
    const { data: existingRoznamcha } = await (supabase as any)
      .from("roznamcha_entries")
      .select("id")
      .eq("source_module", "local_purchase")
      .eq("source_transaction_id", purchase.id)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .limit(1);

    if (existingRoznamcha && existingRoznamcha.length > 0) {
      return NextResponse.json(
        { ok: false, error: { message: "A roznamcha entry already exists for this purchase. Duplicate posting is not allowed." } },
        { status: 400 }
      );
    }

    // ── Authorize scope ──
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
    const journalSerial = purchase.journal_serial_no || `LP-JRN-${Date.now().toString(36).toUpperCase()}`;
    const entryDate = new Date().toISOString().slice(0, 10);

    // ── Balance assertion: amount must be positive ──
    if (finalAmount <= 0) {
      return NextResponse.json(
        { ok: false, error: { message: "Cannot post a purchase with zero or negative amount." } },
        { status: 400 }
      );
    }

    let journalEntryId: string | null = null;
    let roznamchaEntryId: string | null = null;

    // ──────────────────────────────────────────
    // 1. SINGLE BALANCED JOURNAL ENTRY
    //    Purchase Account = DR, Payable Account = CR
    // ──────────────────────────────────────────
    if (purchaseAccountCode && creditAccountCode) {
      try {
        // Resolve account IDs from account codes
        const { data: foundAccounts } = await (supabase as any)
          .from("accounts")
          .select("id, code")
          .in("code", [purchaseAccountCode, creditAccountCode]);

        const debitAccObj = foundAccounts?.find((a: any) => a.code === purchaseAccountCode);
        const creditAccObj = foundAccounts?.find((a: any) => a.code === creditAccountCode);

        if (debitAccObj && creditAccObj) {
          // Create ONE journal entry with both DR and CR lines
          const { data: journalEntry, error: jeErr } = await (supabase as any)
            .from("journal_entries")
            .insert({
              company_id: purchase.company_id,
              entry_no: `JV-${journalSerial}`,
              entry_date: entryDate,
              status: "posted",
              memo: `Local Purchase - ${purchase.supplier_name || "Local Vendor"} (${purchase.goods_name}) [${purchase.payment_mode}]`,
              source_type: "local_purchase",
              source_id: purchase.id,
              posted_at: new Date().toISOString(),
              posted_by: session.userId,
            })
            .select()
            .single();

          if (jeErr) {
            console.error("Journal entry creation failed:", jeErr);
          } else if (journalEntry) {
            journalEntryId = journalEntry.id;

            // Insert BOTH lines into the SAME journal entry
            // Line 1: Purchase Account = DEBIT (increases expense)
            // Line 2: Payable Account = CREDIT (increases liability)
            await (supabase as any).from("journal_lines").insert([
              {
                journal_entry_id: journalEntry.id,
                account_id: debitAccObj.id,
                description: `DR: Local Purchase - ${purchase.goods_name} (${purchase.quantity_kgs} ${purchase.quantity_name})`,
                debit: finalAmount,
                credit: 0,
              },
              {
                journal_entry_id: journalEntry.id,
                account_id: creditAccObj.id,
                description: `CR: Payable - ${purchase.supplier_name || "Vendor"} [${purchase.payment_mode}]`,
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
    // 2. SINGLE ROZNAMCHA ENTRY (DR + CR)
    //    No separate "cash business" entry — payment mode is tracked
    //    on the entry itself via source_transaction_type
    // ──────────────────────────────────────────
    try {
      const voucherNo = `LP-ROZ-${journalSerial}`;
      const transactionType = purchase.payment_mode === "Cash"
        ? "local_purchase_cash"
        : purchase.payment_mode === "Bank" || purchase.payment_mode === "Cheque"
          ? "local_purchase_bank"
          : "local_purchase_transfer";

      const narration = `Local Purchase: ${purchase.goods_name} - ${purchase.supplier_name || "Local Vendor"} | ${postingCurrency} ${finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} [${purchase.payment_mode}]`;

      const { data: rozEntry, error: rozErr } = await (supabase as any)
        .from("roznamcha_entries")
        .insert({
          type: "branch",
          country_id: purchase.country_id,
          country_branch_id: purchase.country_branch_id,
          city_branch_id: purchase.city_branch_id || null,
          journal_no: `JV-${journalSerial}`,
          voucher_no: voucherNo,
          entry_date: entryDate,
          narration: narration,
          status: "posted",
          source_module: "local_purchase",
          source_transaction_type: transactionType,
          source_transaction_id: purchase.id,
          source_reference_no: journalSerial,
          entry_serial_number: journalSerial,
          created_by: session.userId,
          posted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (rozErr) {
        console.error("Roznamcha entry creation failed:", rozErr);
      } else if (rozEntry) {
        roznamchaEntryId = rozEntry.id;

        // Insert BOTH debit and credit lines into the SAME roznamcha entry
        await (supabase as any).from("roznamcha_lines").insert([
          {
            roznamcha_entry_id: rozEntry.id,
            payment_entry_type: "debit",
            debit: finalAmount,
            credit: 0,
            currency: postingCurrency,
            account_number: purchaseAccountCode,
            manual_reference_number: journalSerial,
            entry_serial_number: journalSerial,
          },
          {
            roznamcha_entry_id: rozEntry.id,
            payment_entry_type: "credit",
            debit: 0,
            credit: finalAmount,
            currency: postingCurrency,
            account_number: creditAccountCode,
            manual_reference_number: journalSerial,
            entry_serial_number: journalSerial,
          }
        ]);
      }
    } catch (rozErr) {
      console.error("Roznamcha posting error:", rozErr);
    }

    // ──────────────────────────────────────────
    // 3. GENERAL LEDGER ENTRY (DR + CR)
    // ──────────────────────────────────────────
    if (purchaseAccountCode && creditAccountCode && finalAmount > 0) {
      try {
        await (supabase as any).from("ledger_transactions").insert([
          {
            company_id: purchase.company_id,
            country_id: purchase.country_id,
            country_branch_id: purchase.country_branch_id,
            city_branch_id: purchase.city_branch_id || null,
            account_code: purchaseAccountCode,
            entry_date: entryDate,
            debit: finalAmount,
            credit: 0,
            currency: postingCurrency,
            narration: `DR: Local Purchase - ${purchase.goods_name}`,
            source_type: "local_purchase",
            source_id: purchase.id,
            reference_no: journalSerial,
            created_by: session.userId,
          },
          {
            company_id: purchase.company_id,
            country_id: purchase.country_id,
            country_branch_id: purchase.country_branch_id,
            city_branch_id: purchase.city_branch_id || null,
            account_code: creditAccountCode,
            entry_date: entryDate,
            debit: 0,
            credit: finalAmount,
            currency: postingCurrency,
            narration: `CR: Payable - ${purchase.supplier_name || "Vendor"}`,
            source_type: "local_purchase",
            source_id: purchase.id,
            reference_no: journalSerial,
            created_by: session.userId,
          }
        ]);
      } catch (glErr) {
        console.error("General Ledger posting error (non-fatal):", glErr);
      }
    }

    // ──────────────────────────────────────────
    // 4. UPDATE PURCHASE RECORD → 'posted'
    // ──────────────────────────────────────────
    const { data: finalRecord, error: finalErr } = await (supabase as any)
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
          journalSerialNo: journalSerial,
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
