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

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

function maskEmail(email) {
  if (!email) return "";
  const [local, domain] = String(email).split("@");
  if (!domain) return "***";
  if (local.length <= 2) return `${local[0] || "*"}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

try {
  const [countRow] = await sql`select count(*)::int as count from auth.users`;
  const rows = await sql`
    select id, email, created_at
    from auth.users
    order by created_at desc
    limit 20
  `;

  console.log(`auth.users count: ${countRow.count}`);
  for (const row of rows) {
    console.log(`${row.created_at.toISOString()}  ${maskEmail(row.email)}  ${row.id}`);
  }
} catch (error) {
  console.error("Failed to list auth users:");
  console.error(error?.message || error);
  process.exit(1);
} finally {
  await sql.end();
}

