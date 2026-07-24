import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables
if (fs.existsSync(".env.local")) {
  const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("id, purchase_order_no, city_branch_id, country_branch_id, ledger_posting_status, created_at, deleted_at, status")
    .order("created_at", { ascending: false })
    .limit(30);
    
  if (error) {
    fs.writeFileSync("C:/Users/dgtll/.gemini/antigravity-ide/brain/c4fdabdb-8609-4f8d-a44c-bd39723326e1/scratch/orders_dump.json", JSON.stringify({ error }, null, 2));
  } else {
    fs.writeFileSync("C:/Users/dgtll/.gemini/antigravity-ide/brain/c4fdabdb-8609-4f8d-a44c-bd39723326e1/scratch/orders_dump.json", JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
