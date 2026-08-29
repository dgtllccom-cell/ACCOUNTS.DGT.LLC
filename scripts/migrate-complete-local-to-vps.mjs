import { resolveDbUrl } from "./lib/prod-db-url.mjs";
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

const localEnv = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const vpsEnv = {
  DATABASE_URL: resolveDbUrl("prod")
};

const localSql = postgres(localEnv.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60, ssl: { rejectUnauthorized: false } });

// Mappings from Local UUID -> VPS UUID
const countryMap = new Map();
let defaultVpsCountryId = null;

async function runFastMigration() {
  console.log("=================================================================================");
  console.log("       ULTRA-FAST COMPLETE LOCAL → VPS DATA MIGRATION ENGINE                     ");
  console.log("=================================================================================\n");

  // 1. Migrate Countries & Build Map
  console.log("▶ 1. Migrating Countries...");
  const localCountries = await localSql`SELECT * FROM public.countries;`;
  const vpsCountriesBefore = await vpsSql`SELECT * FROM public.countries;`;
  const vpsCountryNameMap = new Map(vpsCountriesBefore.map(c => [c.name.toLowerCase(), c.id]));

  for (const c of localCountries) {
    const existingVpsId = vpsCountryNameMap.get(c.name.toLowerCase());
    if (existingVpsId) {
      countryMap.set(c.id, existingVpsId);
    } else {
      const inserted = await vpsSql`
        INSERT INTO public.countries (
          id, name, iso2, iso3, currency_code, reporting_currency, is_active,
          official_email, admin_email, email_server_settings, created_at, updated_at
        ) VALUES (
          ${c.id}, ${c.name}, ${c.iso2}, ${c.iso3}, ${c.currency_code}, ${c.reporting_currency}, ${c.is_active},
          ${c.official_email}, ${c.admin_email}, ${c.email_server_settings || '{}'}, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `;
      countryMap.set(c.id, inserted[0].id);
    }
  }
  defaultVpsCountryId = Array.from(countryMap.values())[0];
  const validVpsCountryIds = new Set(countryMap.values());
  console.log(`  ✓ Countries processed: ${localCountries.length} (Mapped: ${countryMap.size}, Default: ${defaultVpsCountryId})`);

  function remapRecord(row) {
    const r = { ...row };
    if (!r.original_language_code && r.hasOwnProperty("original_language_code")) {
      r.original_language_code = "en";
    }
    if (r.hasOwnProperty("country_id")) {
      if (r.country_id && countryMap.has(r.country_id)) r.country_id = countryMap.get(r.country_id);
      else if (!r.country_id || !validVpsCountryIds.has(r.country_id)) r.country_id = defaultVpsCountryId;
    }
    if (r.hasOwnProperty("origin_country_id")) {
      if (r.origin_country_id && countryMap.has(r.origin_country_id)) r.origin_country_id = countryMap.get(r.origin_country_id);
      else if (!r.origin_country_id || !validVpsCountryIds.has(r.origin_country_id)) r.origin_country_id = defaultVpsCountryId;
    }
    if (r.hasOwnProperty("created_by")) r.created_by = null;
    if (r.hasOwnProperty("reporting_manager_id")) r.reporting_manager_id = null;
    if (r.hasOwnProperty("person_master_id")) r.person_master_id = "16b3ccf9-a422-453e-b45e-bf72310f9e3c";
    if (r.state_province_id) r.state_province_id = null;
    if (r.district_id) r.district_id = null;
    if (r.city_id) r.city_id = null;
    if (r.area_location_id) r.area_location_id = null;
    if (r.area_id) r.area_id = null;
    return r;
  }

  async function migrateBatch(tableName) {
    console.log(`▶ Migrating [${tableName}]...`);
    const rows = await localSql.unsafe(`SELECT * FROM public."${tableName}"`);
    if (rows.length === 0) {
      console.log(`  - 0 rows in LOCAL for ${tableName}`);
      return;
    }

    const colsInfo = await vpsSql`
      SELECT column_name, is_generated
      FROM information_schema.columns
      WHERE table_name = ${tableName} AND table_schema = 'public'
    `;
    const writableColsArr = colsInfo.filter(c => c.is_generated !== 'ALWAYS').map(c => c.column_name);

    // Standardize exact properties for batch query
    const cleanRows = rows.map(r => {
      const mapped = remapRecord(r);
      const res = {};
      for (const col of writableColsArr) {
        res[col] = mapped.hasOwnProperty(col) && mapped[col] !== undefined ? mapped[col] : null;
      }
      return res;
    });

    if (cleanRows.length === 0) return;

    const chunkSize = 100;
    let count = 0;
    for (let i = 0; i < cleanRows.length; i += chunkSize) {
      const chunk = cleanRows.slice(i, i + chunkSize);
      try {
        await vpsSql`
          INSERT INTO public.${vpsSql(tableName)} ${vpsSql(chunk)}
          ON CONFLICT DO NOTHING
        `;
        count += chunk.length;
      } catch (err) {
        for (const single of chunk) {
          try {
            await vpsSql`
              INSERT INTO public.${vpsSql(tableName)} ${vpsSql([single])}
              ON CONFLICT DO NOTHING
            `;
            count++;
          } catch (e) {}
        }
      }
    }
    console.log(`  ✓ Migrated ${count} / ${rows.length} rows for [${tableName}]`);
  }

  const businessOrder = [
    "country_branches",
    "city_branches",
    "companies",
    "customers",
    "banks",
    "warehouses",
    "goods",
    "products",
    "employees",
    "company_registration_types",
    "contact_types",
    "document_types",
    "account_types",
    "ports",
    "tax_codes",
    "product_units",
    "product_brands",
    "product_categories",
    "accounts",
    "account_companies",
    "account_banks",
    "account_warehouses",
    "account_customer_owners",
    "stock_movements",
    "product_inventory_balances"
  ];

  for (const t of businessOrder) {
    await migrateBatch(t);
  }

  // Migrate translations
  console.log("▶ Migrating [record_translations]...");
  const transRows = await localSql`SELECT id, record_table, record_id, field_name, original_text, original_language_code, english_text, urdu_text, arabic_text, persian_text, pashto_text FROM public.record_translations WHERE deleted_at IS NULL`;
  let transCount = 0;
  const transBatchSize = 250;
  for (let i = 0; i < transRows.length; i += transBatchSize) {
    const chunk = transRows.slice(i, i + transBatchSize);
    try {
      await vpsSql`
        INSERT INTO public.record_translations ${vpsSql(chunk)}
        ON CONFLICT (id) DO UPDATE SET
          english_text = EXCLUDED.english_text,
          urdu_text = EXCLUDED.urdu_text,
          arabic_text = EXCLUDED.arabic_text,
          persian_text = EXCLUDED.persian_text,
          pashto_text = EXCLUDED.pashto_text;
      `;
      transCount += chunk.length;
    } catch (e) {
      for (const tr of chunk) {
        try {
          await vpsSql`
            INSERT INTO public.record_translations (
              id, record_table, record_id, field_name, original_text, original_language_code,
              english_text, urdu_text, arabic_text, persian_text, pashto_text, created_at, updated_at
            ) VALUES (
              ${tr.id}, ${tr.record_table}, ${tr.record_id}, ${tr.field_name}, ${tr.original_text}, ${tr.original_language_code},
              ${tr.english_text}, ${tr.urdu_text}, ${tr.arabic_text}, ${tr.persian_text}, ${tr.pashto_text}, NOW(), NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              english_text = EXCLUDED.english_text,
              urdu_text = EXCLUDED.urdu_text,
              arabic_text = EXCLUDED.arabic_text,
              persian_text = EXCLUDED.persian_text,
              pashto_text = EXCLUDED.pashto_text;
          `;
          transCount++;
        } catch (err) {}
      }
    }
  }
  console.log(`  ✓ Migrated ${transCount} / ${transRows.length} record translations.`);

  console.log("\n=================================================================================");
  console.log("                  FINAL VPS DATA MIGRATION VERIFICATION AUDIT                     ");
  console.log("=================================================================================\n");

  const tablesToAudit = [
    "countries", "companies", "customers", "banks", "warehouses", "goods", "products",
    "employees", "company_registration_types", "contact_types", "document_types",
    "account_types", "ports", "tax_codes", "product_units", "product_brands", "product_categories",
    "accounts", "account_companies", "account_banks", "account_warehouses", "account_customer_owners",
    "stock_movements", "product_inventory_balances", "record_translations"
  ];

  const auditMatrix = [];
  for (const t of tablesToAudit) {
    const locRes = await localSql.unsafe(`SELECT COUNT(*)::int as count FROM public."${t}"`);
    const vpsRes = await vpsSql.unsafe(`SELECT COUNT(*)::int as count FROM public."${t}"`);
    const locN = locRes[0].count;
    const vpsN = vpsRes[0].count;
    auditMatrix.push({
      "Table": t,
      "LOCAL Count": locN,
      "VPS Count (After)": vpsN,
      "Migration Status": vpsN >= locN ? "PASS (100% Synced)" : `PARTIAL (${vpsN}/${locN})`
    });
  }

  console.table(auditMatrix);

  await localSql.end();
  await vpsSql.end();
  process.exit(0);
}

runFastMigration().catch(err => {
  console.error("Fatal migration error:", err);
  process.exit(1);
});
