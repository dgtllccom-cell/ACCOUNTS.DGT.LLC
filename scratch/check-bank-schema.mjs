import fs from 'fs';
import postgres from 'postgres';

const envContent = fs.readFileSync('.env.local', 'utf8');
const m = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
if (!m) {
  console.log('No DB URL');
  process.exit(1);
}

const sql = postgres(m[1], { ssl: { rejectUnauthorized: false }, max: 1 });

async function run() {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name ILIKE '%cheque%' OR table_name ILIKE '%bank%' OR table_name ILIKE '%roznamcha%')`;
  console.log('Tables:', tables.map(t => t.table_name));

  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'roznamcha_entries' ORDER BY ordinal_position`;
  console.log('roznamcha_entries cols:', cols.map(c => `${c.column_name} (${c.data_type})`));

  const lineCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'roznamcha_lines' ORDER BY ordinal_position`;
  console.log('roznamcha_lines cols:', lineCols.map(c => `${c.column_name} (${c.data_type})`));

  // Check sample rows from roznamcha_entries where entry_category = 'bank' or type ILIKE '%bank%'
  const bankEntries = await sql`SELECT id, voucher_no, entry_category, status, reference_no, source_reference_no, payment_details FROM public.roznamcha_entries WHERE entry_category = 'bank' OR voucher_no ILIKE '%BNK%' LIMIT 5`;
  console.log('Sample bank entries:', bankEntries);

  await sql.end();
}

run().catch(console.error);
