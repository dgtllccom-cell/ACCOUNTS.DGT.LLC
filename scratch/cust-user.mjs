import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const c = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND (column_name ILIKE '%user%' OR column_name ILIKE '%profile%' OR column_name ILIKE '%email%' OR column_name ILIKE '%person%' OR column_name ILIKE '%auth%')`;
  console.log("customers user/link cols:", c.map(x=>x.column_name).join(", "));
  // any link tables employee<->user
  const lt = await sql`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='employee_id' AND table_name IN (SELECT table_name FROM information_schema.columns WHERE column_name='user_id')`;
  console.log("tables with both employee_id and user_id:", [...new Set(lt.map(x=>x.table_name))].join(", "));
  // check FK target of employees.person_master_id
  const fk = await sql`
    SELECT ccu.table_name AS ref_table, ccu.column_name AS ref_col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_name='employees' AND kcu.column_name='person_master_id'`;
  console.log("employees.person_master_id FK →", JSON.stringify(fk));
});
process.exit(0);
