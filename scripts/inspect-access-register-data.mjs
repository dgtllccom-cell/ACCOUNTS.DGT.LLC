import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const sql = postgres(resolveDbUrl("prod"), {
  ssl: { rejectUnauthorized: false },
  prepare: false
});

async function listHierarchy() {
  const rows = await sql`
    SELECT 
      c.name as country_name,
      c.currency_code,
      cb.name as main_branch_name,
      cb.code as main_branch_code,
      cib.name as city_branch_name,
      cib.code as city_branch_code,
      cib.city_name
    FROM countries c
    LEFT JOIN country_branches cb ON cb.country_id = c.id
    LEFT JOIN city_branches cib ON cib.country_branch_id = cb.id
    ORDER BY c.name, cb.name, cib.name
  `;
  console.log("Hierarchy rows:", rows.length);
  console.table(rows);
  await sql.end();
}

listHierarchy().catch(console.error);
