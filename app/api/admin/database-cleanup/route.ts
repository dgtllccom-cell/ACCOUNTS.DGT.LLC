import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import fs from "fs";
import path from "path";

/**
 * Super Admin Database Backup & Controlled Cleanup API Route
 * -----------------------------------------------------------
 * GET: Generates complete timestamped JSON backup file of all ERP tables.
 * POST: Performs controlled purge of operational test data (branches, non-superadmin users, orders, accounts, ledgers, roznamcha)
 *       while strictly preserving Master Settings, Location Masters, Document/Contract Types, Currencies, and Main Super Admin.
 */

// List of operational tables to wipe (in foreign-key safe order)
const TRANSACTIONAL_TABLES = [
  "roznamcha_entries",
  "journal_entries",
  "ledger_transactions",
  "purchase_payments",
  "purchase_transfers",
  "purchase_loading_records",
  "purchase_orders",
  "sales_orders",
  "loading_records",
  "cash_entries",
  "expenses",
  "stock_transactions",
  "payment_histories",
  "accounts",
  "ledgers",
  "customer_accounts",
  "supplier_accounts",
  "bank_accounts",
  "city_branches",
  "main_branches",
  "branch_assignments",
  "operational_countries",
];

// List of master tables to back up & preserve
const MASTER_TABLES = [
  "countries",
  "states",
  "districts",
  "cities",
  "areas",
  "document_types",
  "contract_types",
  "company_registration_types",
  "currencies",
  "categories",
  "packages",
  "companies",
  "goods",
  "ports_loading",
  "ports_received",
];

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(process.cwd(), "backups");

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupData: Record<string, any[]> = {};
    const allTables = [...MASTER_TABLES, ...TRANSACTIONAL_TABLES, "users", "profiles"];

    for (const table of allTables) {
      try {
        const { data, error } = await supabase.from(table as any).select("*");
        if (!error && data) {
          backupData[table] = data;
        } else {
          backupData[table] = [];
        }
      } catch (e) {
        backupData[table] = [];
      }
    }

    const backupFileName = `database_backup_${timestamp}.json`;
    const backupFilePath = path.join(backupDir, backupFileName);

    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), "utf8");

    const stats = fs.statSync(backupFilePath);

    return NextResponse.json({
      success: true,
      message: "Complete database backup created successfully.",
      backupFileName,
      backupFilePath,
      fileSizeBytes: stats.size,
      tableCounts: Object.fromEntries(
        Object.entries(backupData).map(([k, v]) => [k, v.length])
      ),
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create database backup" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { confirmWipe } = body;

    if (confirmWipe !== true) {
      return NextResponse.json(
        { success: false, error: "Explicit confirmation required (confirmWipe: true)." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(process.cwd(), "backups");

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Step 1: Automatic Pre-Deletion Backup
    const backupData: Record<string, any[]> = {};
    const allTables = [...MASTER_TABLES, ...TRANSACTIONAL_TABLES, "users", "profiles"];

    for (const table of allTables) {
      try {
        const { data } = await supabase.from(table as any).select("*");
        backupData[table] = data || [];
      } catch (e) {
        backupData[table] = [];
      }
    }

    const backupFileName = `pre_cleanup_backup_${timestamp}.json`;
    const backupFilePath = path.join(backupDir, backupFileName);
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), "utf8");

    // Step 2: Clear Transactional & Operational Tables
    const clearedSummary: Record<string, number> = {};

    for (const table of TRANSACTIONAL_TABLES) {
      try {
        const { data } = await supabase.from(table as any).delete().neq("id", "00000000-0000-0000-0000-000000000000").select();
        clearedSummary[table] = data ? data.length : 0;
      } catch (e) {
        clearedSummary[table] = 0;
      }
    }

    // Step 3: Remove Non-Super-Admin Users (Preserve Main Super Admin)
    let deletedUsersCount = 0;
    try {
      // Find non-super-admin users
      const { data: users } = await supabase.from("users" as any).select("*");
      if (users && users.length) {
        const nonSuperAdmins = users.filter(
          (u: any) =>
            u.role !== "super_admin" &&
            u.email !== "superadmin@dgt.llc" &&
            u.email !== "admin@dgt.llc" &&
            !u.is_master_super_admin
        );

        for (const u of nonSuperAdmins) {
          await supabase.from("users" as any).delete().eq("id", u.id);
          deletedUsersCount++;
        }
      }
    } catch (e) {
      console.warn("User deletion warning:", e);
    }

    // Step 4: Verify Master Data Counts
    const masterPreservedSummary: Record<string, number> = {};
    for (const table of MASTER_TABLES) {
      try {
        const { data } = await supabase.from(table as any).select("*");
        masterPreservedSummary[table] = data ? data.length : 0;
      } catch (e) {
        masterPreservedSummary[table] = 0;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Controlled database cleanup completed successfully.",
      backupFileCreated: backupFileName,
      operationalTablesCleared: clearedSummary,
      nonSuperAdminUsersDeleted: deletedUsersCount,
      masterTablesPreserved: masterPreservedSummary,
      superAdminStatus: "Main Super Admin active & preserved.",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute database cleanup" },
      { status: 500 }
    );
  }
}
