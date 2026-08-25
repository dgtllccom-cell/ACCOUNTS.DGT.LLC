import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
);
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

try {
  const tables = [
    "import_truck_loadings", "transit_truck_loadings", "clearing_agent_custom_entries",
    "clearing_payment_bills", "trucks", "purchase_loading_records", "local_purchases",
    "money_exchange_entries"
  ];
  const rlsStatus = await sql`
    select relname, relrowsecurity, relforcerowsecurity
    from pg_class where relname = any(${tables}) and relkind = 'r'
    order by relname
  `;
  console.log("-- RLS enabled? --");
  console.table(rlsStatus);

  const policies = await sql`
    select tablename, policyname, cmd, roles
    from pg_policies where tablename = any(${tables})
    order by tablename
  `;
  console.log("-- Policies (empty = no policy at all) --");
  console.table(policies);
} finally {
  await sql.end();
}
