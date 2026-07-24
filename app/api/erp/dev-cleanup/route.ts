import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import * as fs from "fs";
import * as path from "path";

const TABLES_TO_CLEAN = [
  "purchase_order_expenses",
  "purchase_order_items",
  "purchase_loading_records",
  "purchase_order_reports",
  "purchase_orders",
  "sales_order_payments",
  "sales_order_items",
  "sales_orders",
  "shipment_documents",
  "shipping_bl_records",
  "shipping_line_records",
  "journal_lines",
  "journal_entries",
  "roznamcha_entries",
  "ledger_posting_batches",
  "ledger_entries",
  "ledger_transactions",
  "enterprise_account_history",
  "exchange_rate_history",
  "audit_logs",
  "erp_email_messages",
  "erp_multilingual_events",
  "purchase_order_payments",
  "transactions",
  "transaction_serial_sequences"
];

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const backupData: Record<string, any> = {};

  try {
    // 1. BACKUP DATA
    for (const table of TABLES_TO_CLEAN) {
      const { data, error } = await supabase.from(table).select("*");
      if (error && error.code !== "42P01") { // Ignore relation does not exist
        console.warn(`Error backing up table ${table}:`, error);
      } else if (data) {
        backupData[table] = data;
      }
    }

    const backupDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `database_backup_${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf8");

    // 2. DELETE DATA
    for (const table of TABLES_TO_CLEAN) {
      // Execute delete on all records
      const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error && error.code !== "42P01") {
        console.warn(`Error deleting from ${table}:`, error);
      }
    }

    // 3. RESET BALANCES
    const { error: resetError } = await supabase.from("enterprise_accounts").update({ current_balance: 0 }).neq("id", "00000000-0000-0000-0000-000000000000");
    if (resetError) {
      console.warn("Error resetting account balances:", resetError);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Database cleanup completed successfully.",
      backupPath
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
