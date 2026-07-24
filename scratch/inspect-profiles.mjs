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

async function main() {
  try {
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'profiles'
    `;
    console.log("profiles columns:");
    console.log(cols.map(c => `${c.column_name} (${c.data_type})`).join('\n'));
    
    const rows = await sql`
      SELECT * 
      FROM profiles 
      LIMIT 10
    `;
    console.log("\nSome profiles rows:");
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

main();
