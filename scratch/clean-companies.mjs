
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
    console.log("Cleaning legacy company references and nullifying supplier_company_id...");
    await sql`UPDATE public.purchase_orders SET supplier_company_id = NULL;`;
    console.log("Updated supplier_company_id to NULL on all purchase_orders.");
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
