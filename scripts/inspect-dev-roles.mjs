import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

async function run() {
  const users = await sql`
    select ura.user_id, p.full_name, ura.role, c.name as country_name, cb.name as branch_name
    from public.user_role_assignments ura
    join public.profiles p on p.id = ura.user_id
    left join public.countries c on c.id = ura.country_id
    left join public.country_branches cb on cb.id = ura.country_branch_id
    where ura.is_active = true and ura.deleted_at is null
    limit 20
  `;
  console.table(users);
  await sql.end();
}

run().catch(console.error);
