import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const admin = createSupabaseAdminClient();
    
    // 1. Get the PO
    const { data: po } = await admin.from("purchase_orders").select("*").eq("purchase_order_no", "PUR-000002").single();
    if (!po) return NextResponse.json({ error: "PO not found" });

    // 2. Update PO
    const correctRate = 287;
    const originalUsdAmount = po.order_total / po.exchange_rate;
    const newTotal = originalUsdAmount * correctRate;
    
    // Update formData if possible
    let newFormData = po.form_data;
    if (newFormData && newFormData.form) {
      newFormData.form.exchangeRate = correctRate;
    }
    if (newFormData && newFormData.goodsEntries) {
      newFormData.goodsEntries = newFormData.goodsEntries.map((g: any) => ({
        ...g,
        exchangeRate: correctRate,
        finalAmount: (g.totalAmount || 0) * correctRate
      }));
      newFormData.totals = {
        ...newFormData.totals,
        grandFinal: newTotal
      };
    }

    await admin.from("purchase_orders").update({
      exchange_rate: correctRate,
      order_total: newTotal,
      remaining_due: newTotal - (po.advance_paid || 0),
      form_data: newFormData
    }).eq("id", po.id);

    // 3. Update payments
    const { data: payments } = await admin.from("purchase_order_payments").select("*").eq("purchase_order_id", po.id);
    if (payments && payments.length > 0) {
      for (const pay of payments) {
        const payUsd = pay.amount / pay.exchange_rate;
        const newPayLocal = payUsd * correctRate;
        await admin.from("purchase_order_payments").update({
          exchange_rate: correctRate,
          amount: newPayLocal
        }).eq("id", pay.id);
      }
    }

    // 4. Update Roznamcha entries
    const { data: roz } = await admin.from("roznamcha_entries").select("*").ilike("narration", "%PUR-000002%");
    if (roz && roz.length > 0) {
      for (const r of roz) {
        const rateToUse = r.exchange_rate || 3.67;
        const usdAmt = (r.debit_amount || r.credit_amount) / rateToUse;
        const newAmt = usdAmt * correctRate;
        await admin.from("roznamcha_entries").update({
          debit_amount: r.debit_amount > 0 ? newAmt : 0,
          credit_amount: r.credit_amount > 0 ? newAmt : 0,
          exchange_rate: correctRate
        }).eq("id", r.id);
      }
    }

    // 5. Update advance_paid on PO now that payments are updated
    const { data: updatedPayments } = await admin.from("purchase_order_payments").select("amount").eq("purchase_order_id", po.id);
    const totalAdvance = updatedPayments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
    await admin.from("purchase_orders").update({
      advance_paid: totalAdvance,
      remaining_due: newTotal - totalAdvance
    }).eq("id", po.id);

    return NextResponse.json({ success: true, originalUsdAmount, newTotal });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
