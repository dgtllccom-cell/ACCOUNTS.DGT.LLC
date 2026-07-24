import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createApiSupabaseClient } from "@/lib/api/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createApiSupabaseClient();
    
    // Find all transferred/posted orders
    const { data: orders, error } = await supabase
      .from("purchase_orders")
      .select("id, purchase_order_no, ledger_posting_status")
      .in("ledger_posting_status", ["transferred", "posted"])
      .is("deleted_at", null);

    if (error) throw error;

    const brokenOrders = [];

    for (const order of orders) {
      const { data: payments } = await supabase
        .from("purchase_order_payments")
        .select("id, status, roznamcha_entry_id")
        .eq("purchase_order_id", order.id)
        .in("kind", ["booking", "credit"]);
      
      if (!payments || payments.length === 0) {
        brokenOrders.push(order);
      } else {
        const p = payments[0];
        if (!p.roznamcha_entry_id) {
          brokenOrders.push(order);
        } else {
          const { data: roz } = await supabase
            .from("roznamcha_entries")
            .select("id")
            .eq("id", p.roznamcha_entry_id)
            .single();
          if (!roz) brokenOrders.push(order);
        }
      }
    }

    // Fix them by reverting status to pending
    for (const order of brokenOrders) {
      await supabase
        .from("purchase_orders")
        .update({ 
          ledger_posting_status: "pending", 
          payment_status: "pending",
          is_edited_since_transfer: true 
        })
        .eq("id", order.id);
    }

    return apiOk({
      message: `Found and fixed ${brokenOrders.length} broken transfers.`,
      fixedOrders: brokenOrders.map(o => o.purchase_order_no)
    });
  } catch (error) {
    return handleApiError(error);
  }
}
