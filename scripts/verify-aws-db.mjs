import postgres from 'postgres';

const url = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";

async function main() {
  const sql = postgres(url, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });
  try {
    const hostInfo = await sql`SELECT inet_server_addr(), current_database(), current_user, version()`;
    console.log('Connected to Cloud DB:', hostInfo[0]);

    const branches = await sql`
      select 
        b.id,
        b.code,
        b.name,
        b.city_name,
        b.local_currency,
        b.status,
        c.name as country_name,
        b.created_at
      from public.city_branches b
      join public.countries c on c.id = b.country_id
      where b.code in ('PAK-QUE-001', 'PAK-CHM-001', 'UAE-DEI-001', 'AFG-KDH-001', 'IND-BOM-001')
      order by b.created_at desc
    `;
    console.log('\nActual AWS PostgreSQL rows in public.city_branches:\n', JSON.stringify(branches, null, 2));

    const translations = await sql`
      select record_id, field_name, original_text, urdu_text, arabic_text, pashto_text, persian_text
      from public.record_translations
      where record_table = 'city_branches' and record_id in ${sql(branches.map(b => b.id))}
    `;
    console.log('\nActual AWS PostgreSQL rows in public.record_translations:\n', JSON.stringify(translations, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
