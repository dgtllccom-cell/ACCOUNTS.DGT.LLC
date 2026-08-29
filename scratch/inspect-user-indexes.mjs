import postgres from 'postgres';

import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
const prodUrl = resolveDbUrl("prod");
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const indexes = await sql`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('profiles', 'user_role_assignments', 'user_permission_sets')
      ORDER BY tablename, indexname;
    `;
    console.log("Indexes:", indexes);
  } finally {
    await sql.end();
  }
}

main();
