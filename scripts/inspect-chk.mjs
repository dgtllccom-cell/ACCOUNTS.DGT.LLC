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

async function inspectConstraint() {
  const enums = await sql`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'app_role'::regtype;`;
  console.log("APP_ROLE ENUM VALUES:", enums.map(e => e.enumlabel));

  await sql.end();
}

inspectConstraint().catch(console.error);
