import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase.from("erp_purchase_orders").select("id, purchase_order_no, ledger_posting_status, form_data");
  if (error) console.error(error);
  else {
    const posted = data.filter((d: any) => d.ledger_posting_status?.toLowerCase() === "posted");
    console.log("Total Posted:", posted.length);
    posted.forEach((p: any) => {
      console.log(p.purchase_order_no, "Advance %:", p.form_data?.form?.advancePercent, "Items length:", p.form_data?.goodsEntries?.length);
    });
  }
}
run();
