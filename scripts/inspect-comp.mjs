import { withLocalPg } from "./lib/db/local-postgres.js";

async function main() {
  const rows = await withLocalPg((sql) =>
    sql`select id, name, company_code, contacts, phone, mobile, address, city_name, country_name from public.companies where name ilike '%importr%' or name ilike '%impotr%' limit 2`
  );
  console.log("Rows:", JSON.stringify(rows, null, 2));
}
main().catch(console.error).finally(() => process.exit(0));
