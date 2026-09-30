import postgres from 'postgres';

const PROD_URL = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const DEV_URL = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";

async function check(label, url) {
  console.log(`\n=== ${label} ===`);
  const sql = postgres(url, { ssl: 'require', max: 1 });
  try {
    const profiles = await sql`
      select *
      from profiles
      limit 5
    `;
    console.table(profiles);
  } catch (e) {
    console.error(e.message);
  } finally {
    await sql.end();
  }
}

async function main() {
  await check("PROD PROFILES", PROD_URL);
  await check("DEV PROFILES", DEV_URL);
}

main();
