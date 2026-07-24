import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revertAllOrderPayments } from "@/lib/services/purchase-payment-reversal";

export async function GET(request: NextRequest) {
  try {
    const adminSupabase = createSupabaseAdminClient() as any;

    // Fetch all active purchase orders
    const { data: orders, error } = await adminSupabase
      .from("purchase_orders")
      .select("id, purchase_order_no")
      .is("deleted_at", null);

    if (error) throw error;

    const cleanedOrders: string[] = [];

    for (const order of orders || []) {
      // 1. Revert and delete all payments, ledger balances, and roznamcha entries for this PO
      await revertAllOrderPayments(order.id, adminSupabase, adminSupabase);

      // 2. Delete any remaining payments (soft deleted or others)
      await adminSupabase
        .from("purchase_order_payments")
        .delete()
        .eq("purchase_order_id", order.id);

      // 3. Delete loading records associated with this PO
      await adminSupabase
        .from("purchase_loading_records")
        .delete()
        .eq("purchase_order_id", order.id);

      // 4. Delete the purchase order itself
      await adminSupabase
        .from("purchase_orders")
        .delete()
        .eq("id", order.id);

      cleanedOrders.push(order.purchase_order_no);
    }

    return apiOk({
      message: `Successfully cleaned up and deleted all test purchase orders and reverted all accounting entries.`,
      cleanedOrders
    });
  } catch (error) {
    return handleApiError(error);
  }
}
