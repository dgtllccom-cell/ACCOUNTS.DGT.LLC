import postgres from "postgres";
const sql = postgres("postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres", { ssl: "require" });
const rows = await sql`select id, entry_serial, goods_name, created_at from public.transit_entries where entry_serial = 'TE-TESTFIX01'`;
console.log(JSON.stringify(rows));
await sql.end();
