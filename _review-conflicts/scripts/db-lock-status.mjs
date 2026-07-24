import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

try {
  const rows = await sql`
    select
      pid,
      usename,
      application_name,
      state,
      wait_event_type,
      wait_event,
      now() - query_start as age,
      left(regexp_replace(query, '\\s+', ' ', 'g'), 180) as query_preview
    from pg_stat_activity
    where datname = current_database()
      and pid <> pg_backend_pid()
    order by query_start nulls last
    limit 25
  `;
  console.log(JSON.stringify({ status: "success", activeConnections: rows }, null, 2));
} finally {
  await sql.end();
}
