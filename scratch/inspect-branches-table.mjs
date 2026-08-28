import postgres from 'postgres';

const devUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(devUrl, { ssl: 'require' });

async function main() {
  try {
    const branches = await sql`
      SELECT id, name, code, country_id FROM public.branches LIMIT 5;
    `;
    console.log("Branches sample:\n", branches);

    const cityBranches = await sql`
      SELECT id, name, code, country_id FROM public.city_branches LIMIT 5;
    `;
    console.log("City Branches sample:\n", cityBranches);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

main();
