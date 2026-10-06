import postgres from "postgres";
import fs from "fs";

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

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function checkLocks() {
  const locks = await sql`
    SELECT pid, query, state, age(clock_timestamp(), query_start) 
    FROM pg_stat_activity 
    WHERE state != 'idle' AND pid != pg_backend_pid()
  `;
  console.log("Active locks / queries:", locks);

  // Terminate any stuck backends if any
  for (const row of locks) {
    if (row.query && row.query.includes("ports")) {
      console.log("Terminating stuck backend:", row.pid);
      await sql`SELECT pg_terminate_backend(${row.pid})`;
    }
  }
  await sql.end();
}

checkLocks();
