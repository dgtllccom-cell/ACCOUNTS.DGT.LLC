import { createClient } from "@supabase/supabase-js";
// @ts-ignore
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fixing advance_paid for purchase orders...");

  // Update advance_paid to 0 and remaining_due to order_total for all purchase orders
  // that have not actually been paid through the payment module.
  // We can just reset all since the user just created new test ones.
  const { data: orders, error: fetchErr } = await supabase
    .from("purchase_orders")
    .select("id, purchase_order_no, order_total");

  if (fetchErr) {
    console.error("Error fetching orders:", fetchErr);
    return;
  }

  console.log(`Found ${orders.length} orders.`);

  for (const order of orders) {
    const { error: updateErr } = await supabase
      .from("purchase_orders")
      .update({
        advance_paid: 0,
        remaining_due: order.order_total,
        payment_status: "pending"
      })
      .eq("id", order.id);

    if (updateErr) {
      console.error(`Error updating order ${order.purchase_order_no}:`, updateErr);
    } else {
      console.log(`Reset advance for order ${order.purchase_order_no}`);
    }
  }

  console.log("Done.");
}

main().catch(console.error);
