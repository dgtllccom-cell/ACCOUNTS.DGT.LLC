import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

async function run() {
  const cols = await sql`select column_name from information_schema.columns where table_name = 'profiles'`;
  console.log('Profile columns:', cols.map(c => c.column_name).join(', '));
  const users = await sql`select id, email, full_name, role from profiles where email is not null limit 15`;
  console.log('DEV users:');
  console.table(users);
  await sql.end();
}

run().catch(console.error);
