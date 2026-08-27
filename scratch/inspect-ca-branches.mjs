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
  const caBranchCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clearing_agent_branches';`;
  console.log("=== clearing_agent_branches columns ===", caBranchCols.map(c => `${c.column_name} (${c.data_type})`));

  const caBranches = await sql`SELECT * FROM clearing_agent_branches LIMIT 20;`;
  console.log("=== clearing_agent_branches rows ===", caBranches);

  const branchesCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'branches';`;
  console.log("=== branches columns ===", branchesCols.map(c => `${c.column_name} (${c.data_type})`));

  await sql.end();
}

run().catch(console.error);
