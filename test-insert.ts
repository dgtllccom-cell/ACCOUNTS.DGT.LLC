import { createClient } from "@supabase/supabase-js";
// @ts-ignore
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
  console.log("Testing insert...");
  const scope = "main_branch";
  const { data: newAcc, error: accErr } = await supabase
    .from("enterprise_accounts")
    .insert({
      scope,
      country_id: null,
      country_branch_id: null,
      city_branch_id: null,
      code: "TEST-001",
      account_number: "TEST-001",
      customer_number: "CUST-TEST-001",
      account_serial_number: 1,
      country_serial_number: "TEST-1",
      branch_serial_number: "TEST-1-1",
      branch_code: "TEST",
      branch_account_sequence: 1,
      name: "TEST Fallback Account",
      kind: "liability",
      currency: "PKR",
      status: "active",
      is_control_account: false,
      opening_balance: 0,
      current_balance: 0,
      creation_date: new Date().toISOString(),
      created_by: null
    })
    .select("id, code, name");

  if (accErr) {
    console.error("Failed creating fallback acc", accErr);
  } else {
    console.log("Success", newAcc);
  }
}

test();
