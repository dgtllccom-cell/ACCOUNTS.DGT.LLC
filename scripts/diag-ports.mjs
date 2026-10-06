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

async function diag() {
  const transCols = await sql`
    SELECT column_name, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'ports_ur'
  `;
  console.log("ports_ur columns:", transCols);
  await sql.end();
}

diag();
