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

async function factoryReset() {
  try {
    console.log("Starting Factory Reset...");
    console.log("WARNING: This will permanently delete all transactions, ledgers, and extra master data.");
    
    await sql.begin(async sql => {
      
      // 1. Delete transactions
      console.log("Deleting Transactions...");
      
      const tables = [
        "purchase_order_payments",
        "purchase_orders",
        "sales_orders",
        "roznamcha_lines",
        "roznamcha_entries",
        "ledger_entries",
        "journal_lines",
        "journal_entries",
        "cash_transactions",
        "transactions"
      ];

      for (const table of tables) {
        try {
          await sql.unsafe(`DELETE FROM ${table}`);
          console.log(`Cleared ${table}`);
        } catch(e) {
          // Table might not exist or error, continue
        }
      }

      // 2. Reset ledgers and enterprise_accounts balances to 0
      console.log("Resetting Balances to 0...");
      try {
        await sql`UPDATE ledgers SET debit_total = 0, credit_total = 0, current_balance = 0`;
        await sql`UPDATE enterprise_accounts SET current_balance = 0`;
        await sql`DELETE FROM ledger_balances`;
      } catch (e) {}

      // 3. Clear Audit Logs for transactions
      console.log("Clearing Audit Logs for transactions...");
      try {
        await sql`DELETE FROM audit_logs WHERE entity_table IN ('purchase_orders', 'purchase_order_payments', 'roznamcha_entries', 'ledgers', 'enterprise_accounts', 'transactions')`;
      } catch(e) {}

      // 4. Delete Extra Master Data (Keep only 1)
      console.log("Pruning Master Data...");
      
      try {
        // Keep only first Super Admin user
        const superAdmins = await sql`SELECT id FROM profiles WHERE role IN ('super_admin', 'superadmin') ORDER BY created_at ASC LIMIT 1`;
        if (superAdmins.length > 0) {
          await sql`DELETE FROM profiles WHERE id != ${superAdmins[0].id}`;
          await sql`DELETE FROM auth.users WHERE id != ${superAdmins[0].id}`; // Note: depends on permissions
        }
      } catch(e) { console.error("Could not prune profiles"); }

      try {
        // Keep only 1 country
        const countries = await sql`SELECT id FROM countries ORDER BY created_at ASC LIMIT 1`;
        if (countries.length > 0) {
          await sql`DELETE FROM countries WHERE id != ${countries[0].id}`;
        }
      } catch(e) { console.error("Could not prune countries"); }

      try {
        // Keep only 1 branch
        const branches = await sql`SELECT id FROM country_branches ORDER BY created_at ASC LIMIT 1`;
        if (branches.length > 0) {
          await sql`DELETE FROM country_branches WHERE id != ${branches[0].id}`;
        }
        const cityBranches = await sql`SELECT id FROM city_branches ORDER BY created_at ASC LIMIT 1`;
        if (cityBranches.length > 0) {
          await sql`DELETE FROM city_branches WHERE id != ${cityBranches[0].id}`;
        }
      } catch(e) { console.error("Could not prune branches"); }

      try {
        // Keep only 1 Cash Account
        const accounts = await sql`SELECT id FROM enterprise_accounts WHERE type = 'Cash' OR name ILIKE '%cash%' ORDER BY created_at ASC LIMIT 1`;
        if (accounts.length > 0) {
          await sql`DELETE FROM enterprise_accounts WHERE id != ${accounts[0].id}`;
        } else {
           // Fallback if no cash account found
           const firstAcc = await sql`SELECT id FROM enterprise_accounts ORDER BY created_at ASC LIMIT 1`;
           if (firstAcc.length > 0) await sql`DELETE FROM enterprise_accounts WHERE id != ${firstAcc[0].id}`;
        }
      } catch(e) { console.error("Could not prune enterprise accounts"); }

      try {
        // Keep only 1 Ledger
        const ledgers = await sql`SELECT id FROM ledgers ORDER BY created_at ASC LIMIT 1`;
        if (ledgers.length > 0) {
          await sql`DELETE FROM ledgers WHERE id != ${ledgers[0].id}`;
        }
      } catch(e) { console.error("Could not prune ledgers"); }

      console.log("Factory Reset Complete!");
    });
    
  } catch(e) {
    console.error("Error during reset:", e);
  } finally {
    await sql.end();
  }
}

factoryReset();
