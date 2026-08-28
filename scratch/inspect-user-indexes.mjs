import postgres from 'postgres';

const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
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
