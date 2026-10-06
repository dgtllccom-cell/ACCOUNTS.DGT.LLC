import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const vpsSql = postgres(resolveDbUrl("prod"), { 
  ssl: { rejectUnauthorized: false },
  max: 5,
  prepare: false 
});

async function runComprehensiveAudit() {
  console.log("==========================================================================================");
  console.log("            COMPREHENSIVE VPS DATABASE & MULTILINGUAL ERP AUDIT REPORT                   ");
  console.log("==========================================================================================\n");

  // 1. Total Active Translations Count
  const totalTrans = await vpsSql`SELECT count(*) as count FROM record_translations WHERE deleted_at IS NULL`;
  const totalDeleted = await vpsSql`SELECT count(*) as count FROM record_translations WHERE deleted_at IS NOT NULL`;
  console.log(`[1] RECORD TRANSLATIONS SUMMARY:`);
  console.log(`    - Active Translations:   ${Number(totalTrans[0].count).toLocaleString()}`);
  console.log(`    - Soft Deleted:          ${Number(totalDeleted[0].count).toLocaleString()}`);
  console.log(`    - Total DB Rows:         ${(Number(totalTrans[0].count) + Number(totalDeleted[0].count)).toLocaleString()}\n`);

  // 2. 5-Language Coverage Grouped by Record Table
  const coverage = await vpsSql`
    SELECT 
      record_table,
      COUNT(DISTINCT record_id) as unique_records,
      COUNT(*) FILTER (WHERE english_text IS NOT NULL AND english_text != '') as en,
      COUNT(*) FILTER (WHERE urdu_text IS NOT NULL AND urdu_text != '') as ur,
      COUNT(*) FILTER (WHERE arabic_text IS NOT NULL AND arabic_text != '') as ar,
      COUNT(*) FILTER (WHERE persian_text IS NOT NULL AND persian_text != '') as fa,
      COUNT(*) FILTER (WHERE pashto_text IS NOT NULL AND pashto_text != '') as ps,
      COUNT(*) as total_rows
    FROM record_translations
    WHERE deleted_at IS NULL
    GROUP BY record_table
    ORDER BY total_rows DESC;
  `;
  console.log(`[2] 5-LANGUAGE TRANSLATION COVERAGE BY TABLE:`);
  console.table(coverage);

  // 3. Check for Orphan Translations (Translations whose parent record does not exist in master table)
  console.log(`\n[3] ORPHAN & INTEGRITY AUDIT:`);
  const tablesInTranslations = await vpsSql`
    SELECT DISTINCT record_table 
    FROM record_translations 
    WHERE deleted_at IS NULL;
  `;

  const orphanResults = [];
  for (const row of tablesInTranslations) {
    const tbl = row.record_table;
    try {
      // Check if table exists in public schema
      const tblCheck = await vpsSql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = ${tbl};
      `;

      if (tblCheck.length === 0) {
        orphanResults.push({ Table: tbl, Status: 'Table does not exist in DB', OrphanCount: 'N/A' });
        continue;
      }

      // Check if primary key is id or uuid
      const orphans = await vpsSql`
        SELECT COUNT(*) as count 
        FROM record_translations rt
        LEFT JOIN ${vpsSql(tbl)} p ON rt.record_id::text = p.id::text
        WHERE rt.record_table = ${tbl} 
          AND rt.deleted_at IS NULL 
          AND p.id IS NULL;
      `;
      orphanResults.push({
        Table: tbl,
        Status: Number(orphans[0].count) === 0 ? 'CLEAN (0 Orphans)' : 'WARNING: Contains Orphans',
        OrphanCount: Number(orphans[0].count)
      });
    } catch (err) {
      orphanResults.push({ Table: tbl, Status: `Check Error: ${err.message}`, OrphanCount: 'ERR' });
    }
  }
  console.table(orphanResults);

  // 4. Check for Duplicates in record_translations
  const duplicates = await vpsSql`
    SELECT record_table, record_id, field_name, COUNT(*) as duplicate_count
    FROM record_translations
    WHERE deleted_at IS NULL
    GROUP BY record_table, record_id, field_name
    HAVING COUNT(*) > 1;
  `;
  console.log(`\n[4] DUPLICATE CHECK IN record_translations:`);
  if (duplicates.length === 0) {
    console.log(`    ✓ 0 Duplicates found. All (record_table, record_id, field_name) triples are UNIQUE.`);
  } else {
    console.log(`    ⚠ Found ${duplicates.length} duplicate entries:`);
    console.table(duplicates.slice(0, 10));
  }

  // 5. Complete Database Tables & Row Counts
  const allTables = await vpsSql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  console.log(`\n[5] ALL DATABASE TABLES & ROW COUNTS (${allTables.length} Tables Total):`);
  const tableCounts = [];
  for (const t of allTables) {
    const tName = t.table_name;
    try {
      const res = await vpsSql`SELECT count(*) as count FROM ${vpsSql(tName)}`;
      tableCounts.push({
        "Table Name": tName,
        "Row Count": Number(res[0].count),
        "Status": "ACTIVE"
      });
    } catch (err) {
      tableCounts.push({
        "Table Name": tName,
        "Row Count": -1,
        "Status": `Error: ${err.message}`
      });
    }
  }
  console.table(tableCounts);

  // 6. Master & Core Tables Summary
  console.log(`\n[6] CORE MASTER & MULTI-LINKING VERIFICATION:`);
  const coreEntities = [
    { module: "Accounts", table: "accounts" },
    { module: "Companies", table: "companies" },
    { module: "Banks", table: "banks" },
    { module: "Warehouses", table: "warehouses" },
    { module: "Customers", table: "customers" },
    { module: "Goods / Items", table: "goods" },
    { module: "Goods Variations", table: "goods_variations" },
    { module: "Stock Movements", table: "stock_movements" },
    { module: "Employees", table: "employees" },
    { module: "Ports / Borders", table: "ports" },
    { module: "Company Reg Types", table: "company_registration_types" },
    { module: "Contact Types", table: "contact_types" },
    { module: "Document Types", table: "document_types" },
    { module: "Account Types", table: "account_types" },
    { module: "Tax Codes", table: "tax_codes" },
    { module: "Product Units", table: "product_units" },
    { module: "Product Brands", table: "product_brands" },
    { module: "Product Categories", table: "product_categories" },
    { module: "Countries", table: "countries" },
    { module: "States/Provinces", table: "states_provinces" },
    { module: "Districts", table: "districts" },
    { module: "Cities", table: "cities" },
    { module: "Account-Company Links", table: "account_companies" },
    { module: "Account-Customer Links", table: "account_customer_owners" },
    { module: "Account-Bank Links", table: "account_banks" },
    { module: "Account-Warehouse Links", table: "account_warehouses" }
  ];

  const coreReport = [];
  for (const item of coreEntities) {
    try {
      const c = await vpsSql`SELECT count(*) as count FROM ${vpsSql(item.table)}`;
      const tr = await vpsSql`
        SELECT count(*) as count 
        FROM record_translations 
        WHERE record_table = ${item.table} AND deleted_at IS NULL;
      `;
      coreReport.push({
        "Module": item.module,
        "Table": item.table,
        "DB Rows": Number(c[0].count),
        "Translations": Number(tr[0].count),
        "Health": "OK"
      });
    } catch (err) {
      coreReport.push({
        "Module": item.module,
        "Table": item.table,
        "DB Rows": "MISSING",
        "Translations": 0,
        "Health": `ERROR: ${err.message}`
      });
    }
  }
  console.table(coreReport);

  await vpsSql.end();
}

runComprehensiveAudit().catch(console.error);
