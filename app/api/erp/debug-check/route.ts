import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createApiSupabaseClient } from "@/lib/api/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createApiSupabaseClient();
    
    const { data: purchaseOrders, error: poError } = await supabase
      .from("purchase_orders")
      .select("id, purchase_order_no, ledger_posting_status, order_total, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(3);

    if (poError) throw new Error("PO Fetch Error: " + poError.message);

    const { data: roznamcha, error: rozError } = await supabase
      .from("roznamcha_entries")
      .select(`
        id, journal_no, voucher_no, entry_date, status, created_at,
        roznamcha_lines (
          id, payment_entry_type, debit, credit, description, enterprise_account_id, ledger_id, created_at
        )
      `)
      .order("created_at", { ascending: false })
      .limit(5);
      
    if (rozError) throw new Error("Roznamcha Fetch Error: " + rozError.message);

    return apiOk({
      message: "Here is the latest data from the database tables to verify your transfer",
      latestPurchaseOrders: purchaseOrders,
      latestRoznamchaEntries: roznamcha
    });
  } catch (error) {
    return handleApiError(error);
  }
}
