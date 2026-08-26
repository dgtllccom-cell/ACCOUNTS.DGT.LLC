import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
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
