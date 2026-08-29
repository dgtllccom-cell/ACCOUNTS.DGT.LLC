import postgres from 'postgres';

import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
const prodUrl = resolveDbUrl("prod");
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const chk = await sql`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'user_role_assignments';
    `;
    console.log("Constraints on user_role_assignments:", chk);
  } finally {
    await sql.end();
  }
}

main();
