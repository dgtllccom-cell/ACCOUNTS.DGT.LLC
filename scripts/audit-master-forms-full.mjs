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
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

async function auditMasterForms() {
  console.log("==========================================================================================");
  console.log("                COMPREHENSIVE MASTER FORMS & REGISTRIES AUDIT SUITE                       ");
  console.log("==========================================================================================\n");

  const modules = [
    { name: "Accounts & Multi-Linking", dbTable: "accounts", pagePath: "app/dashboard/settings/accounts/page.tsx", apiPath: "app/api/erp/accounts/route.ts" },
    { name: "Company", dbTable: "companies", pagePath: "app/dashboard/settings/company/page.tsx", apiPath: "app/api/erp/companies/route.ts" },
    { name: "Bank", dbTable: "banks", pagePath: "app/dashboard/settings/bank/page.tsx", apiPath: "app/api/erp/banks/route.ts" },
    { name: "Warehouse", dbTable: "warehouses", pagePath: "app/dashboard/settings/warehouse/page.tsx", apiPath: "app/api/erp/warehouses/route.ts" },
    { name: "Customer / Owner", dbTable: "customers", pagePath: "app/dashboard/settings/customers/page.tsx", apiPath: "app/api/erp/customers/route.ts" },
    { name: "Location", dbTable: "countries", pagePath: "app/dashboard/settings/locations/page.tsx", apiPath: "app/api/erp/locations/route.ts" },
    { name: "Employee", dbTable: "employees", pagePath: "app/dashboard/settings/employees/page.tsx", apiPath: "app/api/erp/employees/route.ts" },
    { name: "Company Registration Type", dbTable: "company_registration_types", pagePath: "app/dashboard/settings/company-registration-type/page.tsx", apiPath: "app/api/erp/company-registration-types/route.ts" },
    { name: "Contact Type", dbTable: "contact_types", pagePath: "app/dashboard/settings/contact-type/page.tsx", apiPath: "app/api/erp/contact-types/route.ts" },
    { name: "Document Type", dbTable: "document_types", pagePath: "app/dashboard/settings/document-type/page.tsx", apiPath: "app/api/erp/document-types/route.ts" },
    { name: "Account Type", dbTable: "account_types", pagePath: "app/dashboard/settings/account-type/page.tsx", apiPath: "app/api/erp/account-types/route.ts" },
    { name: "Goods Master", dbTable: "goods", pagePath: "app/dashboard/settings/goods-master/page.tsx", apiPath: "app/api/erp/goods/route.ts" },
    { name: "Port / Boundary Master", dbTable: "ports", pagePath: "app/dashboard/settings/ports/page.tsx", apiPath: "app/api/erp/ports/route.ts" },
    { name: "Tax Code Master", dbTable: "tax_codes", pagePath: "app/dashboard/settings/tax/page.tsx", apiPath: "app/api/erp/tax/route.ts" },
    { name: "Product Units", dbTable: "product_units", pagePath: "app/dashboard/settings/product-units/page.tsx", apiPath: "app/api/erp/master-data/product-units/route.ts" },
    { name: "Product Brands", dbTable: "product_brands", pagePath: "app/dashboard/settings/product-brands/page.tsx", apiPath: "app/api/erp/master-data/product-brands/route.ts" },
    { name: "Product Categories", dbTable: "product_categories", pagePath: "app/dashboard/settings/product-categories/page.tsx", apiPath: "app/api/erp/master-data/product-categories/route.ts" }
  ];

  const results = [];

  for (const m of modules) {
    let formExists = fs.existsSync(m.pagePath);
    let apiExists = fs.existsSync(m.apiPath);
    let tableExists = false;
    let dbConnected = false;
    let count = 0;

    try {
      const res = await sql`
        SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=${m.dbTable}) as exists;
      `;
      tableExists = res[0].exists;

      if (tableExists) {
        const countRes = await sql.unsafe(`SELECT COUNT(*) as count FROM public."${m.dbTable}"`);
        count = Number(countRes[0].count);
        dbConnected = true;
      }
    } catch (e) {
      dbConnected = false;
    }

    results.push({
      name: m.name,
      formExists: formExists ? "YES" : "NO",
      tableExists: tableExists ? "YES" : "NO",
      apiExists: apiExists ? "YES" : "NO",
      dbConnected: dbConnected ? "YES" : "NO",
      recordCount: count
    });
  }

  console.table(results);

  // Check Junction tables for Account Multi-Linking specifically
  console.log("\n=== ACCOUNT MULTI-LINKING JUNCTION TABLES AUDIT ===");
  const junctions = ['account_companies', 'account_banks', 'account_warehouses', 'account_customer_owners'];
  for (const j of junctions) {
    const res = await sql`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=${j}) as exists;`;
    console.log(`Junction Table [${j}]: ${res[0].exists ? "✓ EXISTS" : "✗ MISSING"}`);
  }

  process.exit(0);
}

auditMasterForms();
