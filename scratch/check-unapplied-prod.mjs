import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const prodUrl = resolveDbUrl("prod");
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const appliedRows = await sql`SELECT name FROM erp_schema_migrations`;
    const appliedSet = new Set(appliedRows.map(r => r.name));

    const files = fs.readdirSync('supabase/migrations')
      .filter(f => f.endsWith('.sql'))
      .sort();

    const unapplied = files.filter(f => !appliedSet.has(f.replace('.sql', '')));
    console.log("Unapplied migrations count:", unapplied.length);
    console.log("Unapplied migrations list:", unapplied);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
