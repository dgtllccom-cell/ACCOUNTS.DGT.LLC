import postgres from 'postgres';

const PROD_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || "";
const DEV_URL = process.env.DEV_DATABASE_URL || "";

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
