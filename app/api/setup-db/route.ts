import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/service-role";
import postgres from "postgres";

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("Missing DATABASE_URL");

    const sql = postgres(dbUrl);

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

    await sql`alter table tax_codes enable row level security;`;
    
    // Add is_edited_since_transfer to purchase_orders if it doesn't exist
    try {
      await sql`alter table purchase_orders add column if not exists is_edited_since_transfer boolean default false;`;
    } catch(e){}
    
    // Drop existing policies if any
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

    await sql.end();

    return NextResponse.json({ success: true, message: "DB setup complete." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
