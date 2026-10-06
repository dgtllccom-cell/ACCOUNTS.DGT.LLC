import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
);
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

try {
  const r1 = await sql`delete from clearing_agent_custom_entries where customs_declaration_no = 'TEST-GD-SUBPHASEB-001' returning id`;
  console.log("deleted agent_custom_entries:", r1.length);
} finally {
  await sql.end();
}
