import postgres from 'postgres';

const devUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

async function inspectProfiles(name, url) {
  const sql = postgres(url, { ssl: 'require' });
  try {
    console.log(`=== Inspecting ${name} Profiles & Assignments ===`);
    const profiles = await sql`
      SELECT p.id, p.full_name, p.user_code, p.raw_password, a.role, a.country_id, a.country_branch_id, a.city_branch_id
      FROM public.profiles p
      LEFT JOIN public.user_role_assignments a ON a.user_id = p.id
      WHERE p.deleted_at IS NULL
    `;
    console.log(`${name} Profiles (${profiles.length}):\n`, profiles);
  } finally {
    await sql.end();
  }
}

async function main() {
  await inspectProfiles("DEV", devUrl);
  await inspectProfiles("PROD", prodUrl);
}

main();
