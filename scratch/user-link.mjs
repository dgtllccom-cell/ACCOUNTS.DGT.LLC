import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const t = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%user%' OR table_name ILIKE '%profile%' OR table_name ILIKE '%person%') ORDER BY table_name`;
  console.log("user/person tables:", t.map(x=>x.table_name).join(", "));
  for (const tn of ["user_profiles","erp_users","app_users","user_person_links","person_master"]) {
    const c = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=${tn} ORDER BY ordinal_position`;
    if (c.length) console.log(`\n${tn}:`, c.map(x=>x.column_name).join(", "));
  }
  // how do existing user assignments reference a person?
  const ura = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name ILIKE '%role_assignment%'`;
  console.log("\nrole_assignment cols:", ura.map(x=>x.column_name).join(", "));
});
process.exit(0);
