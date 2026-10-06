import postgres from "postgres";
import fs from "fs";

let envContent = fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
let dbUrl = "";
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^["']/, "").replace(/["']$/, "");
  }
}

const sql = postgres(dbUrl, { max: 1 });

async function main() {
  const acts = await sql`
    SELECT pid, client_port, state, wait_event_type, wait_event, query, now() - state_change as duration
    FROM pg_stat_activity
    WHERE client_port = 55008 OR (state != 'idle' AND pid != pg_backend_pid())
  `;
  console.log("QUERIES:", JSON.stringify(acts, null, 2));
  await sql.end();
}

main().catch(console.error);
