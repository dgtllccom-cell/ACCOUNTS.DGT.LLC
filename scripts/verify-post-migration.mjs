import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const vpsSql = postgres(resolveDbUrl("prod"), { 
  ssl: { rejectUnauthorized: false },
  prepare: false 
});

async function verify() {
  const summary = [
    { Module: 'Companies Master', Table: 'companies', Count: (await vpsSql`SELECT count(*) FROM companies`)[0].count },
    { Module: 'Banks Master', Table: 'banks', Count: (await vpsSql`SELECT count(*) FROM banks`)[0].count },
    { Module: 'Warehouses Master', Table: 'warehouses', Count: (await vpsSql`SELECT count(*) FROM warehouses`)[0].count },
    { Module: 'Customers / Owners', Table: 'customers', Count: (await vpsSql`SELECT count(*) FROM customers`)[0].count },
    { Module: 'Accounts Master', Table: 'accounts', Count: (await vpsSql`SELECT count(*) FROM accounts`)[0].count },
    { Module: 'Goods Master', Table: 'goods', Count: (await vpsSql`SELECT count(*) FROM goods`)[0].count },
    { Module: 'Goods Variations', Table: 'goods_variations', Count: (await vpsSql`SELECT count(*) FROM goods_variations`)[0].count },
    { Module: 'Stock Movements', Table: 'stock_movements', Count: (await vpsSql`SELECT count(*) FROM stock_movements`)[0].count },
    { Module: 'Employees Master', Table: 'employees', Count: (await vpsSql`SELECT count(*) FROM employees`)[0].count },
    { Module: 'Ports / Border', Table: 'ports', Count: (await vpsSql`SELECT count(*) FROM ports`)[0].count },
    { Module: 'Countries Master', Table: 'countries', Count: (await vpsSql`SELECT count(*) FROM countries`)[0].count },
    { Module: 'States / Provinces', Table: 'states_provinces', Count: (await vpsSql`SELECT count(*) FROM states_provinces`)[0].count },
    { Module: 'Districts Master', Table: 'districts', Count: (await vpsSql`SELECT count(*) FROM districts`)[0].count },
    { Module: 'Cities Master', Table: 'cities', Count: (await vpsSql`SELECT count(*) FROM cities`)[0].count },
    { Module: 'Account Multi-Link (Company)', Table: 'account_companies', Count: (await vpsSql`SELECT count(*) FROM account_companies`)[0].count },
    { Module: 'Account Multi-Link (Customer)', Table: 'account_customer_owners', Count: (await vpsSql`SELECT count(*) FROM account_customer_owners`)[0].count },
    { Module: 'Account Multi-Link (Bank)', Table: 'account_banks', Count: (await vpsSql`SELECT count(*) FROM account_banks`)[0].count },
    { Module: 'Account Multi-Link (Warehouse)', Table: 'account_warehouses', Count: (await vpsSql`SELECT count(*) FROM account_warehouses`)[0].count },
    { Module: 'Multilingual Translations', Table: 'record_translations', Count: (await vpsSql`SELECT count(*) FROM record_translations`)[0].count }
  ];

  console.log("\n=== VPS POST-MIGRATION VERIFIED RECORD COUNTS ===");
  console.table(summary);
  await vpsSql.end();
}

verify().catch(console.error);
