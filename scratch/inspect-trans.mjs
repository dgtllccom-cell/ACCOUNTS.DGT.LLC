
import postgres from "postgres";
import fs from "fs";

const envLines = fs.readFileSync('.env.local', 'utf8').split('\n');
let dbUrl = '';
for (const line of envLines) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
    break;
  }
}

async function run() {
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    const rows = await sql`
      SELECT po.purchase_order_no, po.form_data->'translations' as trans
      FROM public.purchase_orders po
      WHERE po.purchase_order_no IN ('PO-PB-2026-018', 'PO-PB-2026-017');
    `;
    console.log("Translations on 17 & 18:", rows);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
