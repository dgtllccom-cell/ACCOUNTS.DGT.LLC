import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function run() {
  const users = await sql`
    SELECT u.id, u.email, p.user_code, p.full_name, ura.role, ura.operational_domain
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.user_role_assignments ura ON ura.user_id = u.id
    ORDER BY u.created_at ASC
  `;
  console.log('ALL USERS IN DB (' + users.length + '):');
  for (const u of users) {
    console.log(`${u.id} | email: ${u.email} | code: ${u.user_code} | role: ${u.role} | domain: ${u.operational_domain}`);
  }
  await sql.end();
}
run();
