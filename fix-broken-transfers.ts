import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Checking for broken purchase order transfers...");

  const { data: orders, error } = await supabase
    .from("purchase_orders")
    .select("id, purchase_order_no, ledger_posting_status, is_edited_since_transfer")
    .in("ledger_posting_status", ["transferred", "posted"])
    .is("deleted_at", null);

  if (error) {
    console.error("Error fetching orders:", error);
    return;
  }

  console.log(`Found ${orders.length} transferred/posted orders.`);

  let brokenCount = 0;

  for (const order of orders) {
    const { data: payments, error: pError } = await supabase
      .from("purchase_order_payments")
      .select("id, status, roznamcha_entry_id")
      .eq("purchase_order_id", order.id)
      .eq("kind", "booking");

    if (pError) {
      console.error("Error fetching payments for order:", order.id, pError);
      continue;
    }

    if (!payments || payments.length === 0) {
      console.log(`❌ BROKEN ORDER FOUND: ${order.purchase_order_no} (${order.id}) - Status is ${order.ledger_posting_status} but NO booking payment entry exists!`);
      brokenCount++;
    } else {
      const p = payments[0];
      if (!p.roznamcha_entry_id) {
        console.log(`❌ BROKEN ORDER FOUND: ${order.purchase_order_no} (${order.id}) - Payment entry exists but NO roznamcha_entry_id!`);
        brokenCount++;
      } else {
        // Check if roznamcha_entry actually exists
        const { data: roz } = await supabase
          .from("roznamcha_entries")
          .select("id")
          .eq("id", p.roznamcha_entry_id)
          .single();
          
        if (!roz) {
            console.log(`❌ BROKEN ORDER FOUND: ${order.purchase_order_no} (${order.id}) - Roznamcha entry deleted!`);
            brokenCount++;
        }
      }
    }
  }

  console.log(`\nFound ${brokenCount} broken orders out of ${orders.length} transferred/posted orders.`);
}

main();
