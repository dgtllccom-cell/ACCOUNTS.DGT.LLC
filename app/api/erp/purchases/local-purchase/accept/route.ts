export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const acceptSchema = z.object({
  purchaseId: z.string().uuid(),
});

/**
 * POST /api/erp/purchases/local-purchase/accept
 * Transitions a local purchase bill from 'draft' → 'accepted'.
 * Generates journal_serial_no, country_serial_no, and branch_serial_no.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const { purchaseId } = acceptSchema.parse(body);

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

    // Verify status is 'draft'
    if (purchase.status !== "draft") {
      return NextResponse.json(
        { ok: false, error: { message: `Cannot accept a bill with status '${purchase.status}'. Only draft bills can be accepted.` } },
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

    // Generate serial numbers using RPC or fallback
    let journalSerialNo: string;
    let countrySerialNo: string;
    let branchSerialNo: string;
    let debitJournalSerial: string;
    let creditJournalSerial: string;

    try {
      const { data: globalSerial } = await supabase.rpc("next_transaction_serial", {
        p_scope_type: "global",
        p_scope_key: "global",
        p_prefix: "LP-JRN"
      });
      journalSerialNo = globalSerial ? String(globalSerial) : `LP-JRN-${Date.now().toString(36).toUpperCase()}`;
    } catch {
      journalSerialNo = `LP-JRN-${Date.now().toString(36).toUpperCase()}`;
    }

    try {
      const { data: ctySerial } = await supabase.rpc("next_transaction_serial", {
        p_scope_type: "country",
        p_scope_key: purchase.country_id || "global",
        p_prefix: "LP-CTY"
      });
      countrySerialNo = ctySerial ? String(ctySerial) : `LP-CTY-${Date.now().toString(36).toUpperCase()}`;
    } catch {
      countrySerialNo = `LP-CTY-${Date.now().toString(36).toUpperCase()}`;
    }

    try {
      const { data: brSerial } = await supabase.rpc("next_transaction_serial", {
        p_scope_type: "branch",
        p_scope_key: purchase.country_branch_id || "global",
        p_prefix: "LP-BR"
      });
      branchSerialNo = brSerial ? String(brSerial) : `LP-BR-${Date.now().toString(36).toUpperCase()}`;
    } catch {
      branchSerialNo = `LP-BR-${Date.now().toString(36).toUpperCase()}`;
    }

    try {
      const { data: drSerial } = await supabase.rpc("next_transaction_serial", {
        p_scope_type: "branch",
        p_scope_key: purchase.country_branch_id || "global",
        p_prefix: "LP-DR"
      });
      debitJournalSerial = drSerial ? String(drSerial) : `LP-DR-${Date.now().toString(36).toUpperCase()}`;
    } catch {
      debitJournalSerial = `LP-DR-${Date.now().toString(36).toUpperCase()}`;
    }

    try {
      const { data: crSerial } = await supabase.rpc("next_transaction_serial", {
        p_scope_type: "branch",
        p_scope_key: purchase.country_branch_id || "global",
        p_prefix: "LP-CR"
      });
      creditJournalSerial = crSerial ? String(crSerial) : `LP-CR-${Date.now().toString(36).toUpperCase()}`;
    } catch {
      creditJournalSerial = `LP-CR-${Date.now().toString(36).toUpperCase()}`;
    }

    // Update the purchase record
    const { data: updated, error: updateErr } = await supabase
      .from("local_purchases")
      .update({
        status: "accepted",
        journal_serial_no: journalSerialNo,
        country_serial_no: countrySerialNo,
        branch_serial_no: branchSerialNo,
        debit_journal_serial: debitJournalSerial,
        credit_journal_serial: creditJournalSerial,
        accepted_at: new Date().toISOString(),
        accepted_by: session.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchaseId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      ok: true,
      data: {
        purchase: updated,
        serials: {
          journalSerialNo,
          countrySerialNo,
          branchSerialNo,
          debitJournalSerial,
          creditJournalSerial
        }
      }
    });
  } catch (err: any) {
    console.error("[POST /api/erp/purchases/local-purchase/accept] Error:", err);
    return NextResponse.json(
      { ok: false, error: { message: err.message || "Failed to accept local purchase." } },
      { status: 500 }
    );
  }
}
