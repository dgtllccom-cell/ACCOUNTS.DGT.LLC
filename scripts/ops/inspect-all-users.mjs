import postgres from "postgres";

const PROD_URL = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

async function main() {
  const sql = postgres(PROD_URL, { max: 1, ssl: "require" });

  const users = await sql`
    SELECT u.id, u.email, substring(u.encrypted_password, 1, 15) as prefix, length(u.encrypted_password) as len, u.created_at, u.updated_at
    FROM auth.users u
    WHERE u.email IN ('alras.shipping@dgt.llc', 'chaman.shipping@dgt.llc', 'business.superadmin@dgt.llc', 'shipping.superadmin@dgt.llc', 'superadmin@dgt.llc');
  `;
  console.log(users);
  await sql.end();
}

main().catch(console.error);
