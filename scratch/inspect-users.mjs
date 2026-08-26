import postgres from 'postgres';

const devUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

async function inspectUsers(name, url) {
  const sql = postgres(url, { ssl: 'require' });
  try {
    console.log(`=== Inspecting ${name} Users ===`);
    const users = await sql`
      SELECT u.id, u.email, p.full_name, p.user_code, a.role, a.country_id, a.country_branch_id, a.city_branch_id
      FROM auth.users u
      LEFT JOIN public.user_profiles p ON p.id = u.id
      LEFT JOIN public.user_branch_assignments a ON a.user_id = u.id
    `;
    console.log(`${name} Users count: ${users.length}`, users);
  } finally {
    await sql.end();
  }
}

async function main() {
  await inspectUsers("DEV", devUrl);
  await inspectUsers("PROD", prodUrl);
}

main();
