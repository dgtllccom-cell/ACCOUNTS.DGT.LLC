import fs from 'fs';
import postgres from 'postgres';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const lines = envContent.split('\n');
let dbUrl = '';
for (const line of lines) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=')[1].trim();
    // remove quotes if any
    if (dbUrl.startsWith('"')) dbUrl = dbUrl.substring(1, dbUrl.length - 1);
    break;
  }
}

if (!dbUrl) {
  console.error("Could not find DATABASE_URL in .env.local");
  process.exit(1);
}

const sql = postgres(dbUrl);

async function run() {
  try {
    await sql`
      create table if not exists tax_codes (
        id uuid primary key default gen_random_uuid(),
        tax_name text not null,
        tax_pct numeric not null default 0,
        country_name text not null,
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `;
    console.log("tax_codes table created successfully.");

    await sql`alter table tax_codes enable row level security;`;
    
    // Drop policies if exist to recreate them
    try { await sql`drop policy if exists "Enable read access for authenticated users on tax_codes" on tax_codes;`; } catch(e){}
    try { await sql`drop policy if exists "Enable insert access for authenticated users on tax_codes" on tax_codes;`; } catch(e){}
    try { await sql`drop policy if exists "Enable delete access for authenticated users on tax_codes" on tax_codes;`; } catch(e){}
    try { await sql`drop policy if exists "Enable update access for authenticated users on tax_codes" on tax_codes;`; } catch(e){}

    await sql`
      create policy "Enable read access for authenticated users on tax_codes"
        on tax_codes for select
        to authenticated
        using (true);
    `;
    await sql`
      create policy "Enable insert access for authenticated users on tax_codes"
        on tax_codes for insert
        to authenticated
        with check (true);
    `;
    await sql`
      create policy "Enable delete access for authenticated users on tax_codes"
        on tax_codes for delete
        to authenticated
        using (true);
    `;
    await sql`
      create policy "Enable update access for authenticated users on tax_codes"
        on tax_codes for update
        to authenticated
        using (true)
        with check (true);
    `;
    console.log("RLS policies created successfully.");

  } catch (error) {
    console.error("Error setting up DB:", error);
  } finally {
    await sql.end();
  }
}

run();
