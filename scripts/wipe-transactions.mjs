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

async function wipeTransactions() {
  try {
    console.log("Starting Transaction Data Wipe...");
    console.log("WARNING: This will permanently delete all transactions, ledgers, and purchase data.");
    
    await sql.begin(async sql => {
      // Helper function to safely delete tables if they exist
      const tryDelete = async (table) => {
        try {
          const [{ exists }] = await sql`SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = ${table}
          )`;
          if (exists) {
            console.log(`Deleting ${table}...`);
            await sql.unsafe(`DELETE FROM ${table}`);
          }
        } catch (e) {
          console.log(`Failed to delete ${table}: ${e.message}`);
        }
      };

      // 1. Delete Child / Detail Tables First
      await tryDelete('audit_logs');
      await tryDelete('erp_activity_events');
      await tryDelete('erp_record_transfers');
      
      // Purchases
      await tryDelete('purchase_loading_records');
      await tryDelete('purchase_order_payments');
      await tryDelete('purchase_order_expenses');
      await tryDelete('purchase_order_items');
      await tryDelete('purchase_order_reports');
      await tryDelete('purchase_orders');

      // Sales
      await tryDelete('sales_order_payments');
      await tryDelete('sales_orders');

      // Shipping
      await tryDelete('shipping_line_records');
      await tryDelete('shipping_bl_records');
      await tryDelete('shipment_documents');

      // Accounting and Journals (Child before parent)
      await tryDelete('ledger_transaction_audit_trail');
      await tryDelete('inter_branch_ledger_transfers');
      await tryDelete('roznamcha_reversals');
      await tryDelete('journal_reversals');
      await tryDelete('ledger_posting_lines');
      await tryDelete('ledger_posting_batches');
      
      await tryDelete('roznamcha_lines');
      await tryDelete('roznamcha_entries');
      
      await tryDelete('ledger_entries');
      await tryDelete('journal_lines');
      await tryDelete('journal_entries');
      
      await tryDelete('ledger_balances');
      await tryDelete('ledger_opening_balances');
      
      await tryDelete('transactions');
      await tryDelete('cash_transactions');

      // 2. Reset Ledger Totals
      console.log("Resetting Ledger Totals to 0...");
      try {
        await sql`UPDATE ledgers SET debit_total = 0, credit_total = 0, current_balance = 0`;
      } catch (e) {}

      console.log("Resetting Enterprise Accounts Balances to 0...");
      try {
        await sql`UPDATE enterprise_accounts SET current_balance = 0`;
      } catch (e) {}

      console.log("Transaction Data Wipe Complete! Master data preserved.");
    });
    
  } catch(e) {
    console.error("Error during wipe:", e);
  } finally {
    await sql.end();
  }
}

wipeTransactions();
