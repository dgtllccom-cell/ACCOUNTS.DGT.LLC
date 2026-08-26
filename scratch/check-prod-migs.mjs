import postgres from 'postgres';

const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const migs = await sql`
      SELECT name, status, applied_at FROM erp_schema_migrations ORDER BY name DESC LIMIT 20;
    `;
    console.table(migs);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
