import fs from 'node:fs';
import postgres from 'postgres';
function readDbUrl() { if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim(); for (const f of ['.env.local','.env']) { if (fs.existsSync(f)) { const c = fs.readFileSync(f,'utf8'); const m = c.match(/^DATABASE_URL\s*=\s*(.+)$/m); if (m) return m[1].trim().replace(/^['"]|['"]$/g,''); } } throw new Error('DATABASE_URL not found'); }
const sql = postgres(readDbUrl(), { max: 1, prepare: false });
try {
  const rows = await sql`
    select id, title, file_name, file_url, file_type, file_size, company_id, company_code, company_name, account_id, account_code, account_name, person_account_id, person_account_code, person_account_name, person_account_type, module_type, document_type, source_module, source_record_id, source_record_no, document_path, storage_key, category, tags, metadata, scanned_at, created_by, deleted_at, created_at, updated_at
    from public.office_documents
    where title like 'DEV TEST Document %'
    order by created_at desc
    limit 5`;
  console.log(JSON.stringify(rows, null, 2));
} finally { await sql.end({ timeout: 5 }); }
