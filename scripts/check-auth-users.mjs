import postgres from 'postgres';

const PROD_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || "";
const DEV_URL = process.env.DEV_DATABASE_URL || "";

async function check(label, url) {
  console.log(`\n=== ${label} ===`);
  const sql = postgres(url, { ssl: 'require', max: 1 });
  try {
    const users = await sql`
      select p.id, p.full_name, p.user_code, u.email, p.raw_password
      from profiles p
      left join auth.users u on p.id = u.id
      where p.deleted_at is null
        and (p.user_code ilike '%admin%' or p.full_name ilike '%admin%' or u.email ilike '%admin%' or p.user_code ilike '%super%' or p.full_name ilike '%super%' or u.email ilike '%super%')
      limit 25
    `;
    console.table(users);
  } catch (e) {
    console.error(e.message);
  } finally {
    await sql.end();
  }
}

async function main() {
  await check("PROD AUTH.USERS", PROD_URL);
  await check("DEV AUTH.USERS", DEV_URL);
}

main();
