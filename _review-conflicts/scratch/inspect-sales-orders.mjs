import fs from "node:fs";
import postgres from "postgres";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });

async function main() {
  try {
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sales_orders'
    `;
    console.log("sales_orders columns:");
    console.log(cols.map(c => `${c.column_name} (${c.data_type})`).join('\n'));
    
    const rows = await sql`
      SELECT id, sales_order_no, form_data 
      FROM sales_orders 
      LIMIT 3
    `;
    console.log("\nSome sales_orders rows:");
    rows.forEach(r => {
      console.log(`Order: ${r.sales_order_no}`);
      const fd = r.form_data || {};
      const form = fd.form || {};
      console.log('form_data keys:', Object.keys(fd));
      console.log('form keys:', Object.keys(form));
      // print potential salesman keys
      const allKeys = [...Object.keys(fd), ...Object.keys(form)];
      const matchKeys = allKeys.filter(k => /sales|agent|user|person|man|buyer|staff/i.test(k));
      console.log('Matching keys:', matchKeys);
      matchKeys.forEach(k => {
        console.log(`  ${k} =`, fd[k] !== undefined ? fd[k] : form[k]);
      });
    });
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

main();
