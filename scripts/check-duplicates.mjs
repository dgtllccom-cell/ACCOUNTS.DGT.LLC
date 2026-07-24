import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase
    .from("purchase_loading_records")
    .select("id, loading_record_no, purchase_order_no, container_number, loading_status, deleted_at")
    .is("deleted_at", null);
    
  if (error) {
    console.error(error);
  } else {
    console.log("Active loading records in DB:", data.length);
    data.forEach((r) => {
      console.log(`ID: ${r.id} | No: ${r.loading_record_no} | PO: ${r.purchase_order_no} | Container: ${r.container_number} | Status: ${r.loading_status}`);
    });
  }
}
run();
