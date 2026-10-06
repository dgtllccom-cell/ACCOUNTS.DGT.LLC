import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPaths = ['.env.local', '.env.production', '.env'];
  for (const envFile of envPaths) {
    const fullPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

async function main() {
  const sql = postgres(getDbUrl(), { max: 1 });
  const [po] = await sql`select * from purchase_orders order by created_at desc limit 1`;
  console.log("Sample PO Columns:", Object.keys(po));
  console.log("Sample PO Form Data:", JSON.stringify(po.form_data, null, 2));
  await sql.end();
}

main().catch(console.error);
