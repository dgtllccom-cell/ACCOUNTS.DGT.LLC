import postgres from 'postgres';

const devUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(devUrl, { ssl: 'require' });

async function main() {
  try {
    const countries = await sql`SELECT id, name, iso2, iso3 FROM public.countries LIMIT 10`;
    console.log("Countries sample in DEV:");
    console.table(countries);

    const cBranches = await sql`SELECT id, name, code, country_id FROM public.country_branches LIMIT 10`;
    console.log("\nCountry branches sample in DEV:");
    console.table(cBranches);

    const cityBranches = await sql`SELECT id, name, code, country_branch_id FROM public.city_branches LIMIT 10`;
    console.log("\nCity branches sample in DEV:");
    console.table(cityBranches);

  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
