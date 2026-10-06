import fs from "node:fs";
import postgres from "postgres";

import { getDbUrl } from "../lib/db/local-postgres.ts";

let databaseUrl = getDbUrl();

const CATEGORIES_TO_SEED = [
  // Shipping Line & Clearing Agent domain categories
  {
    code: "FREIGHT",
    name: "Ocean & Air Freight",
    description: "International container, vessel and air cargo freight charges between countries",
    accountType: "Company",
    operationalDomain: "shipping",
    sortOrder: 10
  },
  {
    code: "CLEARING",
    name: "Customs Clearance & Border Duty",
    description: "Port customs documentation, border tariffs, clearing agent inspection fees",
    accountType: "Expenses Account",
    operationalDomain: "shipping",
    sortOrder: 11
  },
  {
    code: "DETENTION",
    name: "Container Demurrage & Detention",
    description: "Shipping line container detention, port demurrage, terminal storage charges",
    accountType: "Expenses Account",
    operationalDomain: "shipping",
    sortOrder: 12
  },
  {
    code: "PORT_THC",
    name: "Port & Terminal Handling Charges (THC)",
    description: "Stevedoring, wharfage, port crane, and terminal handling charges",
    accountType: "Expenses Account",
    operationalDomain: "shipping",
    sortOrder: 13
  },
  {
    code: "INTER_SHIPPING",
    name: "Inter-Country Shipping Line Settlement",
    description: "Overseas shipping line billing, cross-border branch freight settlements",
    accountType: "Company",
    operationalDomain: "shipping",
    sortOrder: 14
  },
  {
    code: "AGENT_DISBURSE",
    name: "Overseas Clearing Agent Disbursements",
    description: "Advances and disbursements paid to cross-border clearing agents",
    accountType: "Company",
    operationalDomain: "shipping",
    sortOrder: 15
  },

  // Business (Commercial ERP) domain categories
  {
    code: "INTER_TRADE",
    name: "Inter-Country Trade & Settlement",
    description: "Cross-border commercial trade settlements between countries (e.g. Dubai, Pakistan, Afghanistan)",
    accountType: "Customer",
    operationalDomain: "business",
    sortOrder: 16
  },
  {
    code: "INTER_TRANSFER",
    name: "Inter-Country Money Transfer",
    description: "Inter-country fund transfers, exchange settlements, and central holding balances",
    accountType: "Bank",
    operationalDomain: "business",
    sortOrder: 17
  }
];

async function main() {
  console.log("Connecting to database...");
  const sql = postgres(databaseUrl, { ssl: "require", max: 1 });
  try {
    await sql`ALTER TABLE public.account_categories ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0`;
    await sql`ALTER TABLE public.account_categories ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false`;

    for (const cat of CATEGORIES_TO_SEED) {
      const existing = await sql`
        SELECT id FROM public.account_categories
        WHERE (code = ${cat.code} OR lower(name) = lower(${cat.name}))
          AND operational_domain = ${cat.operationalDomain}
          AND deleted_at IS NULL
        LIMIT 1
      `;

      let catId;
      if (existing.length > 0) {
        catId = existing[0].id;
        console.log(`✓ Category ${cat.code} already exists (${catId})`);
      } else {
        const inserted = await sql`
          INSERT INTO public.account_categories (
            code, name, description, account_type, operational_domain, is_active, sort_order, is_system
          ) VALUES (
            ${cat.code}, ${cat.name}, ${cat.description}, ${cat.accountType}, ${cat.operationalDomain}, true, ${cat.sortOrder}, false
          )
          RETURNING id
        `;
        catId = inserted[0]?.id;
        console.log(`+ Inserted category ${cat.code} (${cat.name}) -> ${catId}`);
      }
    }

    const total = await sql`SELECT count(*)::int as count FROM public.account_categories WHERE deleted_at IS NULL`;
    console.log(`\n✅ Finished seeding! Total active account categories: ${total[0]?.count}`);
  } catch (err) {
    console.error("Error seeding categories:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
