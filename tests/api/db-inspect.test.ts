import { describe, it } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

describe("Database Inspect", () => {
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  (isConfigured ? it : it.skip)("prints all enterprise accounts", async () => {
    const supabase = createSupabaseAdminClient();
    const { data: accounts, error } = await supabase
      .from("enterprise_accounts")
      .select("id, name, code, scope, created_at, deleted_at");
      
    if (error) {
      console.error("DB Error:", error);
    } else {
      console.log("DB Accounts count:", accounts?.length);
      console.log("DB Accounts details:", JSON.stringify(accounts, null, 2));
    }
  });
});

