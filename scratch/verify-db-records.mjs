import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, idle_timeout: 5 });

async function checkModuleRecords(moduleName, tableName, fieldName) {
  console.log(`\n========================================`);
  console.log(`MODULE: ${moduleName} (Table: ${tableName}, Field: ${fieldName})`);
  console.log(`========================================`);

  try {
    const baseRows = await sql.unsafe(
      `select id from "${tableName}" limit 3`
    );

    if (baseRows.length === 0) {
      console.log(`No rows found in ${tableName}`);
      return;
    }

    for (const r of baseRows) {
      const id = r.id;
      const transRows = await sql.unsafe(
        `select 
          e.text as en_text,
          u.text as ur_text,
          a.text as ar_text,
          fa.text as fa_text,
          ps.text as ps_text
         from translations_english e
         left join translations_urdu u on u.record_table = e.record_table and u.record_id = e.record_id and u.field_name = e.field_name
         left join translations_arabic a on a.record_table = e.record_table and a.record_id = e.record_id and a.field_name = e.field_name
         left join translations_persian fa on fa.record_table = e.record_table and fa.record_id = e.record_id and fa.field_name = e.field_name
         left join translations_pashto ps on ps.record_table = e.record_table and ps.record_id = e.record_id and ps.field_name = e.field_name
         where e.record_table = $1 and e.record_id = $2 and e.field_name = $3`,
        [tableName, id, fieldName]
      );

      console.log(`\nRecord ID: ${id}`);
      if (transRows.length > 0) {
        console.log(`EN: "${transRows[0].en_text}"`);
        console.log(`UR: "${transRows[0].ur_text}"`);
        console.log(`AR: "${transRows[0].ar_text}"`);
        console.log(`FA: "${transRows[0].fa_text}"`);
        console.log(`PS: "${transRows[0].ps_text}"`);
      } else {
        console.log(`[No translation row yet in record_translations]`);
      }
    }
  } catch (e) {
    console.error(`Error querying ${tableName}:`, e.message);
  }
}

async function main() {
  await checkModuleRecords("Accounts / Ledgers", "ledgers", "name");
  await checkModuleRecords("Cash Entry / Roznamcha", "roznamcha_entries", "narration");
  await checkModuleRecords("Expenses Bills", "expenses_bills", "bill_title");
  await checkModuleRecords("Purchases (Local)", "local_purchases", "goods_name");
  await checkModuleRecords("Sales Orders", "sales_orders", "customer_name");
  await checkModuleRecords("Employee / Profiles", "profiles", "full_name");
  await checkModuleRecords("Companies", "companies", "name");
  await checkModuleRecords("Customers", "customers", "customer_name");
  await sql.end();
}

main();
