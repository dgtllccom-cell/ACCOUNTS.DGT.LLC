import fs from 'node:fs';
import postgres from 'postgres';

async function verify() {
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    for (const f of ['.env.local', '.env']) {
      if (fs.existsSync(f)) {
        const c = fs.readFileSync(f, 'utf8');
        const m = c.match(/^DATABASE_URL\s*=\s*(.+)$/m);
        if (m) {
          dbUrl = m[1].trim().replace(/^["']|["']$/g, '');
          break;
        }
      }
    }
  }

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  const rows = await sql`
    SELECT id, code, name, account_kind, is_system 
    FROM public.account_types 
    WHERE deleted_at IS NULL
    ORDER BY created_at ASC;
  `;
  console.log('Account Types in Database:');
  console.table(rows);

  const trans = await sql`
    SELECT record_table, field_name, original_text, urdu_text, arabic_text, persian_text, pashto_text
    FROM public.record_translations
    WHERE record_table = 'account_types'
      AND deleted_at IS NULL;
  `;
  console.log('Record Translations for Account Types:');
  console.table(trans);

  await sql.end();
}

verify().catch(console.error);
