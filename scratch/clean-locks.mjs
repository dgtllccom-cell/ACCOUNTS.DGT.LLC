import postgres from 'postgres';
import fs from 'fs';

function loadEnv() {
  if (fs.existsSync(".env.local")) {
    const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        process.env.DATABASE_URL = line.slice(line.indexOf("=") + 1).trim();
      }
    }
  }
}
loadEnv();

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
const sql = postgres(dbUrl);

async function run() {
  const activities = await sql`
    SELECT pid, usename, client_addr, state, query, age(clock_timestamp(), query_start) as duration
    FROM pg_stat_activity
    WHERE pid != pg_backend_pid() AND state != 'idle';
  `;
  console.log("=== Active / Stuck Activities ===", activities);

  for (const a of activities) {
    if (a.state === 'idle in transaction' || a.query?.includes('countries') || a.query?.includes('city_branches')) {
      console.log(`Terminating pid ${a.pid}...`);
      await sql`SELECT pg_terminate_backend(${a.pid});`;
    }
  }

  await sql.end();
}

run().catch(console.error);
