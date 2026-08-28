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
    order by c.created_at asc
  `;
  console.log("All Customers count:", rows.length);
  const duplicates = new Map();
  for (const r of rows) {
    const key = (r.customer_name || "").trim().toLowerCase();
    if (!duplicates.has(key)) duplicates.set(key, []);
    duplicates.get(key).push(r);
  }

  for (const [name, list] of duplicates.entries()) {
    if (list.length > 1) {
      console.log(`\nDUPLICATE [${name}] x${list.length}:`);
      for (const item of list) {
        console.log(`  - ID: ${item.id} | Code: ${item.person_code} | Country: ${item.country_name} | Father: ${item.father_name || "-"} | Created: ${item.created_at}`);
      }
    }
  }
} catch (e) {
  console.error(e);
} finally {
  await sql.end();
}
