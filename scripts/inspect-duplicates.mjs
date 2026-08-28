import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const sql = postgres(env.DATABASE_URL, { max: 1 });

try {
  const rows = await sql`
    select c.id, c.person_code, c.customer_name, c.father_name, co.name as country_name,
           c.mobile, c.email, c.created_at, c.notes
    from customers c
    left join countries co on co.id = c.country_id
    where c.deleted_at is null and c.person_code in ('PER-000001', 'PER-000002', 'PER-000003', 'PER-000004', 'PER-000005', 'PER-000006', 'PER-000007', 'PER-000008', 'PER-000009', 'PER-000010', 'PER-000011', 'PER-000012', 'PER-00000012')
    order by c.person_code asc
  `;
  console.log("Matched Rows:", rows.length);
  for (const r of rows) {
    console.log(JSON.stringify(r, null, 2));
  }
} catch (e) {
  console.error(e);
} finally {
  await sql.end();
}
