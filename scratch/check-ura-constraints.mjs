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
const sql = postgres(dbUrl, { max: 2, prepare: false });

async function checkConstraint() {
  const checkConstraints = await sql`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.user_role_assignments'::regclass;
  `;
  console.log("Constraints on user_role_assignments:", checkConstraints);

  const existingRoles = await sql`
    SELECT DISTINCT role, ledger_visibility FROM user_role_assignments;
  `;
  console.log("Distinct roles & ledger_visibility:", existingRoles);

  await sql.end();
}

checkConstraint().catch(console.error);
