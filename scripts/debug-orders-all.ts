import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.from("purchase_orders").select("id, purchase_order_no, ledger_posting_status, form_data");
  if (error) console.error(error);
  else {
    console.log("Total Orders:", data.length);
    data.forEach((p: any) => {
      console.log(p.purchase_order_no, "Status:", p.ledger_posting_status, "Advance %:", p.form_data?.form?.advancePercent, "Items length:", p.form_data?.goodsEntries?.length);
    });
  }
}
run();
