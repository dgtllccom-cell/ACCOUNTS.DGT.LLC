import fs from "node:fs";
import postgres from "postgres";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });

async function dumpFunc() {
  try {
    const res = await sql`
      SELECT prosrc 
      FROM pg_proc 
      WHERE proname = 'post_purchase_booking_transfer'
    `;
    console.log(res[0]?.prosrc || "Not found");
  } finally {
    await sql.end();
  }
}

dumpFunc();
