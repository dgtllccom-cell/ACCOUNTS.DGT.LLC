import postgres from "postgres";
import fs from "fs";

function getDbUrl() {
  const files = [
    "/var/www/dgt-nextjs/.env.local",
    "/var/www/dgt-nextjs/.env",
    "/var/www/dgt-nextjs/.env.production"
  ];
  for (const f of files) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("DATABASE_URL=") && !trimmed.includes("USER:PASSWORD")) {
          return trimmed.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  }
  return null;
}

const dbUrl = getDbUrl();
if (!dbUrl) {
  console.error("No valid DATABASE_URL found");
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: "require", max: 5 });

async function audit() {
  console.log("=== AUDITING PROD DATABASE ===");
  console.log("Connected to:", dbUrl.split("@")[1]);
  
  const tables = [
    "countries",
    "country_branches",
    "city_branches",
    "profiles",
    "enterprise_accounts",
    "ledgers",
    "roznamcha_entries",
    "purchase_orders",
    "purchase_loading_records",
    "sales_orders",
    "shipping_bl_records",
    "shipping_line_records",
    "crm_action_items"
  ];

  for (const t of tables) {
    try {
      const [{ count }] = await sql`SELECT count(*)::int FROM ${sql(t)} WHERE deleted_at IS NULL`;
      console.log(`Table ${t}: ${count} active rows`);
    } catch (e) {
      try {
        const [{ count }] = await sql`SELECT count(*)::int FROM ${sql(t)}`;
        console.log(`Table ${t} (no deleted_at): ${count} rows`);
      } catch (err) {
        console.log(`Table ${t}: ERROR ${err.message}`);
      }
    }
  }

  // Check AE-001-0003
  const po = await sql`SELECT id, purchase_order_no, status, ledger_posting_status, payment_status, form_data->'workflow' as workflow, form_data->'form'->>'paymentType' as payment_type FROM purchase_orders WHERE purchase_order_no = 'AE-001-0003'`;
  console.log("\nAE-001-0003 in DB:", JSON.stringify(po, null, 2));

  // Check purchase loading records
  const plr = await sql`SELECT id, loading_record_no, purchase_order_no, loading_status FROM purchase_loading_records WHERE purchase_order_no = 'AE-001-0003'`;
  console.log("\nLoading records for AE-001-0003 in DB:", JSON.stringify(plr, null, 2));

  // Check crm_action_items contents
  try {
    const crmItems = await sql`SELECT id, item_type, reference_no, party_name, remaining_amount, currency FROM crm_action_items LIMIT 5`;
    console.log("\nSample CRM Action Items in DB:", JSON.stringify(crmItems, null, 2));
  } catch (e) {
    console.log("\nCRM Action Items query error:", e.message);
  }

  // Check shipping_bl_records contents
  try {
    const bls = await sql`SELECT id, bl_number, shipping_line_name, container_number, shipment_status FROM shipping_bl_records LIMIT 5`;
    console.log("\nSample Shipping BL Records in DB:", JSON.stringify(bls, null, 2));
  } catch (e) {
    console.log("\nShipping BL Records query error:", e.message);
  }

  await sql.end();
}

audit().catch(console.error);
