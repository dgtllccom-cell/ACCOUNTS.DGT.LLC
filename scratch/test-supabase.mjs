import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabasePublicKey } from "../lib/supabase/config.ts";

async function testSupabaseQueries() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://csesvyxxjivnkkozgopt.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  console.log("Connecting to Supabase at:", url);
  if (!key) {
    console.log("No ANON key provided in env, skipping direct call.");
    return;
  }
  const supabase = createClient(url, key);
  const res = await supabase.from("enterprise_accounts").select("id, name, code").limit(5);
  console.log("Supabase res error:", res.error);
  console.log("Supabase res count:", res.data?.length);
}

testSupabaseQueries();
