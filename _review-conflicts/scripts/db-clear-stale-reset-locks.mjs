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
    select pid, state, application_name, now() - query_start as age, pg_terminate_backend(pid) as terminated
    from pg_stat_activity
    where datname = current_database()
      and pid <> pg_backend_pid()
      and usename = current_user
      and application_name = 'Supavisor'
      and state = 'idle in transaction'
      and now() - query_start > interval '1 minute'
  `;
  console.log(JSON.stringify({ status: "success", terminated: rows }, null, 2));
} finally {
  await sql.end();
}
