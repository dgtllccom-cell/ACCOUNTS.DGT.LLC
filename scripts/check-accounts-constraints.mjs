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
if (!env.DATABASE_URL) process.exit(1);

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });

try {
  const columns = await sql`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='accounts'
    ORDER BY ordinal_position;
  `;

  console.log("Accounts Table Columns with Constraints:");
  columns.forEach(col => {
    const nullable = col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL';
    const def = col.column_default ? ` DEFAULT ${col.column_default}` : '';
    console.log(`${col.column_name.padEnd(20)} ${nullable.padEnd(10)}${def}`);
  });

  // Get a default company to use
  const companies = await sql`SELECT id, name FROM companies LIMIT 1`;
  if (companies.length > 0) {
    console.log(`\nDefault company available: ${companies[0].id} (${companies[0].name})`);
  }

  process.exit(0);
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
