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
    where c.deleted_at is null
    order by c.customer_name, c.created_at asc
  `;
  console.log("Total Customers:", rows.length);
  for (const r of rows) {
    console.log(`- [${r.person_code}] "${r.customer_name}" (Father: ${r.father_name || "-"}) | Country: ${r.country_name || "-"} | ID: ${r.id}`);
  }
} catch (e) {
  console.error(e);
} finally {
  await sql.end();
}
