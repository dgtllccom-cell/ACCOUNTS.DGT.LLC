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
  const pos = await sql`select id, purchase_order_no, form_data from purchase_orders where form_data->'form'->>'totalAmount' is not null limit 1`;
  if (pos[0]) {
    console.log("Full PO form_data:", JSON.stringify(pos[0].form_data, null, 2));
  } else {
    const all = await sql`select id, purchase_order_no, form_data from purchase_orders limit 3`;
    console.log("All sample form_data:", JSON.stringify(all, null, 2));
  }
  await sql.end();
}

main().catch(console.error);
