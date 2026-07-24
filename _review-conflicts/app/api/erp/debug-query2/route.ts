import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/api/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createApiSupabaseClient();
    
    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select('id, purchase_order_no, ledger_posting_status, payment_status, advance_paid, remaining_due, super_admin_serial_number, country_transaction_serial_number, created_at, form_data')
      .order('created_at', { ascending: false })
      .limit(10);

    const activeMode = "advance";
    
    function rowForm(row: any) {
      return row.form_data?.form || {};
    }

    function orderTotal(row: any) {
      const form = rowForm(row);
      const goods = row.form_data?.goodsEntries || [];
      const totals = row.form_data?.totals || {};
      if (Number(row.order_total || 0) > 0) return Number(row.order_total || 0);
      if (Number(totals.grandFinal || 0) > 0) return Number(totals.grandFinal || 0);
      if (Array.isArray(goods) && goods.length) return goods.reduce((sum: number, g: any) => sum + Number(g.finalAmount || g.localAmount || g.totalAmount || 0), 0);
      return Number(form.totalAmount || form.grandFinal || 0);
    }

    const filtered = (po || []).map(row => {
      const form = rowForm(row);
      const postingStatus = row.ledger_posting_status?.toLowerCase();
      const workflowTransferStatus = row.form_data?.workflow?.transferStatus?.toLowerCase();
      const hasTransferAudit = Boolean(row.form_data?.form?.transferAudit);
      const isEligibleForPayment = postingStatus === "posted" || postingStatus === "transferred" || workflowTransferStatus === "transferred" || hasTransferAudit;
      
      const finalAmount = orderTotal(row);
      const advancePercent = Number(form.advancePercent || 0);
      const requiredAdvance = (finalAmount * advancePercent) / 100;
      const paidAdvance = Number(row.advance_paid || 0);
      const remainingAdvance = requiredAdvance - paidAdvance;
      
      const isFullyPaid = (row.payment_status || "").toLowerCase() === "paid" || (row.payment_status || "").toLowerCase() === "completed";
      
      let advanceStatus = "SHOW";
      if (!isEligibleForPayment) advanceStatus = "NOT_ELIGIBLE";
      else if (isFullyPaid) advanceStatus = "FULLY_PAID";
      else if (advancePercent > 0 && remainingAdvance <= 0.01) advanceStatus = "ADVANCE_CLEARED";
      
      return {
        po: row.purchase_order_no,
        sa: row.super_admin_serial_number,
        isEligibleForPayment,
        isFullyPaid,
        advancePercent,
        finalAmount,
        requiredAdvance,
        paidAdvance,
        remainingAdvance,
        advanceStatus,
        postingStatus,
        workflowTransferStatus,
        hasTransferAudit,
        paymentStatus: row.payment_status
      };
    });

    return NextResponse.json({ filtered });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
