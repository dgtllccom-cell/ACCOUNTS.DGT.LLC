import postgres from "postgres";

const PROD_URL = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

async function main() {
  const sql = postgres(PROD_URL, { max: 1, ssl: "require" });

  const allUsers = await sql`
    SELECT u.id, u.email, u.banned_until, p.user_code, p.full_name, p.deleted_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    ORDER BY u.created_at ASC
  `;

  console.log(`TOTAL AUTH USERS IN PRODUCTION: ${allUsers.length}\n`);
  for (const u of allUsers) {
    console.log(`- Email: ${u.email} | Code: ${u.user_code} | Name: ${u.full_name} | Banned: ${Boolean(u.banned_until)} | Deleted: ${Boolean(u.deleted_at)}`);
  }

  await sql.end();
}

main().catch(console.error);
