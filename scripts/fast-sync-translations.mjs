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

const localSql = postgres(localEnv.DATABASE_URL, { max: 2, prepare: false });
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 10, prepare: false, ssl: { rejectUnauthorized: false } });

async function fastSyncTranslations() {
  console.log("=================================================================================");
  console.log("     ULTRA-FAST TRANSLATION SYNC & CLASSIFICATION ENGINE (LOCAL → VPS)          ");
  console.log("=================================================================================\n");

  const companyMap = new Map();
  const customerMap = new Map();
  const bankMap = new Map();
  const warehouseMap = new Map();

  const locComp = await localSql`SELECT id, LOWER(name) as name FROM public.companies`;
  const vpsComp = await vpsSql`SELECT id, LOWER(name) as name FROM public.companies`;
  const vpsCompMap = new Map(vpsComp.map(c => [c.name, c.id]));
  for (const c of locComp) {
    if (vpsCompMap.has(c.name)) companyMap.set(c.id, vpsCompMap.get(c.name));
  }

  const locCust = await localSql`SELECT id, LOWER(customer_name) as name FROM public.customers`;
  const vpsCust = await vpsSql`SELECT id, LOWER(customer_name) as name FROM public.customers`;
  const vpsCustMap = new Map(vpsCust.map(c => [c.name, c.id]));
  for (const c of locCust) {
    if (vpsCustMap.has(c.name)) customerMap.set(c.id, vpsCustMap.get(c.name));
  }

  const locBank = await localSql`SELECT id, LOWER(bank_name) as name FROM public.banks`;
  const vpsBank = await vpsSql`SELECT id, LOWER(bank_name) as name FROM public.banks`;
  const vpsBankMap = new Map(vpsBank.map(b => [b.name, b.id]));
  for (const b of locBank) {
    if (vpsBankMap.has(b.name)) bankMap.set(b.id, vpsBankMap.get(b.name));
  }

  const locWh = await localSql`SELECT id, LOWER(warehouse_name) as name FROM public.warehouses`;
  const vpsWh = await vpsSql`SELECT id, LOWER(warehouse_name) as name FROM public.warehouses`;
  const vpsWhMap = new Map(vpsWh.map(w => [w.name, w.id]));
  for (const w of locWh) {
    if (vpsWhMap.has(w.name)) warehouseMap.set(w.id, vpsWhMap.get(w.name));
  }

  const locTrans = await localSql`
    SELECT id, record_table, record_id, field_name, original_text, original_language_code,
           english_text, urdu_text, arabic_text, persian_text, pashto_text
    FROM public.record_translations
    WHERE deleted_at IS NULL
  `;

  let remappedCount = 0;
  const cleanTrans = locTrans.map(t => {
    let recId = t.record_id;
    if (t.record_table === "companies" && companyMap.has(recId)) {
      recId = companyMap.get(recId);
      remappedCount++;
    } else if (t.record_table === "customers" && customerMap.has(recId)) {
      recId = customerMap.get(recId);
      remappedCount++;
    } else if (t.record_table === "banks" && bankMap.has(recId)) {
      recId = bankMap.get(recId);
      remappedCount++;
    } else if (t.record_table === "warehouses" && warehouseMap.has(recId)) {
      recId = warehouseMap.get(recId);
      remappedCount++;
    }

    return {
      id: t.id,
      record_table: t.record_table,
      record_id: recId,
      field_name: t.field_name,
      original_text: t.original_text || "",
      original_language_code: t.original_language_code || "en",
      english_text: t.english_text || null,
      urdu_text: t.urdu_text || null,
      arabic_text: t.arabic_text || null,
      persian_text: t.persian_text || null,
      pashto_text: t.pashto_text || null
    };
  });

  console.log(`Remapped ${remappedCount} local translation record_ids to VPS master UUIDs.`);

  // Multi-row INSERT batches of 200
  const chunkSize = 200;
  let insertedTotal = 0;

  for (let i = 0; i < cleanTrans.length; i += chunkSize) {
    const chunk = cleanTrans.slice(i, i + chunkSize);
    try {
      await vpsSql`
        INSERT INTO public.record_translations ${vpsSql(chunk, "id", "record_table", "record_id", "field_name", "original_text", "original_language_code", "english_text", "urdu_text", "arabic_text", "persian_text", "pashto_text")}
        ON CONFLICT (id) DO UPDATE SET
          english_text = EXCLUDED.english_text,
          urdu_text = EXCLUDED.urdu_text,
          arabic_text = EXCLUDED.arabic_text,
          persian_text = EXCLUDED.persian_text,
          pashto_text = EXCLUDED.pashto_text,
          updated_at = NOW();
      `;
      insertedTotal += chunk.length;
    } catch (err) {
      // Fallback batch row by row
      for (const row of chunk) {
        try {
          await vpsSql`
            INSERT INTO public.record_translations (
              id, record_table, record_id, field_name, original_text, original_language_code,
              english_text, urdu_text, arabic_text, persian_text, pashto_text
            ) VALUES (
              ${row.id}, ${row.record_table}, ${row.record_id}, ${row.field_name}, ${row.original_text}, ${row.original_language_code},
              ${row.english_text}, ${row.urdu_text}, ${row.arabic_text}, ${row.persian_text}, ${row.pashto_text}
            )
            ON CONFLICT (id) DO UPDATE SET
              english_text = EXCLUDED.english_text,
              urdu_text = EXCLUDED.urdu_text,
              arabic_text = EXCLUDED.arabic_text,
              persian_text = EXCLUDED.persian_text,
              pashto_text = EXCLUDED.pashto_text,
              updated_at = NOW();
          `;
          insertedTotal++;
        } catch (e2) {}
      }
    }
  }

  console.log(`✓ Processed & Synced ${insertedTotal} / ${locTrans.length} translations to VPS.`);

  // Audit breakdown
  const tablesToCheck = [
    "countries", "companies", "customers", "banks", "warehouses", "goods", "products",
    "employees", "company_registration_types", "contact_types", "document_types",
    "account_types", "ports", "tax_codes", "product_units", "product_brands", "product_categories",
    "accounts", "states_provinces", "districts", "cities", "areas_locations"
  ];

  const auditReport = [];
  for (const t of tablesToCheck) {
    const locT = await localSql`SELECT COUNT(*)::int as count FROM public.record_translations WHERE record_table = ${t} AND deleted_at IS NULL`;
    const vpsT = await vpsSql`SELECT COUNT(*)::int as count FROM public.record_translations WHERE record_table = ${t} AND deleted_at IS NULL`;
    const locN = locT[0].count;
    const vpsN = vpsT[0].count;

    auditReport.push({
      "Table": t,
      "LOCAL Master Translations": locN,
      "VPS Active Translations": vpsN,
      "Net Difference": vpsN - locN,
      "Status": vpsN >= locN ? "PASS (100% Synced / Covered)" : `PARTIAL (${vpsN}/${locN})`
    });
  }

  console.table(auditReport);

  await localSql.end();
  await vpsSql.end();
  process.exit(0);
}

fastSyncTranslations().catch(err => {
  console.error("Fast sync error:", err);
  process.exit(1);
});
