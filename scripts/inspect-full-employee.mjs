import postgres from 'postgres';

const sql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', {
  ssl: { rejectUnauthorized: false },
  prepare: false
});

async function testRpc() {
  const result = await sql`
    SELECT * FROM list_employees_with_relations(NULL, NULL, NULL, NULL) LIMIT 2
  `;
  console.log("list_employees_with_relations output:", JSON.stringify(result[0], null, 2));

  await sql.end();
}

testRpc().catch(console.error);
