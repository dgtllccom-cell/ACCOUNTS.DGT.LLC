import postgres from 'postgres';

const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const funcs = await sql`
      SELECT pg_get_function_identity_arguments(p.oid) as signature, p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname LIKE '%entity_serial%'
    `;
    console.log("Entity serial functions in prod:");
    console.table(funcs);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
